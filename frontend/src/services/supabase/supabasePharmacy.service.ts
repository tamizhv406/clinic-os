import { supabase } from "../../lib/supabaseClient";
import type { InventoryRecord, MedicineRecord, PharmacyOrderRecord, StockStatus } from "../../shared/types/domain";
import type { Json, Tables, TablesInsert, TablesUpdate } from "../../shared/types/database.types";
import type { DispenseOrderInput, MedicineFilters, PharmacyDomainService, PharmacyQueueItem } from "../interfaces";
import type { PharmacyBill, StockMovementRecord } from "../../modules/pharmacy/types";
import { istDayStartISO, localDateISO } from "../../utils/formatDate";
import { logAuditEvent } from "./auditLogger";
import { supabaseAuthService } from "./supabaseAuth.service";

type MedicineRow = Tables<"medicines">;
type BatchRow = Tables<"medicine_stock_batches">;
type OrderRow = Tables<"pharmacy_orders">;

let channelSequence = 0;

const QUEUE_SELECT = "*, pharmacy_order_items(*), prescriptions(*, prescription_items(*)), patients(*), doctor_profiles(*, staff_profiles(full_name))";

function toQueueItem(row: Record<string, unknown>): PharmacyQueueItem {
  const { pharmacy_order_items, prescriptions, patients, doctor_profiles, ...order } = row as Record<string, unknown> & {
    pharmacy_order_items?: unknown[]; prescriptions?: unknown; patients?: unknown; doctor_profiles?: unknown;
  };
  return {
    ...(order as OrderRow),
    items: (pharmacy_order_items ?? []) as PharmacyQueueItem["items"],
    prescription: (prescriptions ?? null) as PharmacyQueueItem["prescription"],
    patient: (patients ?? null) as PharmacyQueueItem["patient"],
    doctor: (doctor_profiles ?? null) as PharmacyQueueItem["doctor"],
  };
}

function mapMedicine(row: MedicineRow): MedicineRecord {
  return {
    id: row.id,
    name: row.name,
    category: row.category ?? "general",
    form: row.unit ?? row.strength ?? "",
    manufacturer: row.manufacturer ?? "",
  };
}

function stockStatus(batch: BatchRow, medicine?: MedicineRow | null): StockStatus {
  if (batch.expiry_date && batch.expiry_date < new Date().toISOString().slice(0, 10)) return "expired";
  if ((batch.quantity_available ?? 0) <= 0) return "out_of_stock";
  if ((batch.quantity_available ?? 0) <= (medicine?.reorder_level ?? 0)) return "low_stock";
  return "in_stock";
}

function mapInventory(row: BatchRow & { medicines?: MedicineRow | null }): InventoryRecord {
  return {
    id: row.id,
    medicineId: row.medicine_id,
    branchId: row.branch_id ?? "",
    batchNumber: row.batch_no,
    quantity: row.quantity_available ?? 0,
    reorderLevel: row.medicines?.reorder_level ?? 0,
    expiryDate: row.expiry_date ?? "",
    status: stockStatus(row, row.medicines) as InventoryRecord["status"],
  };
}

function mapOrder(row: OrderRow): PharmacyOrderRecord {
  return {
    id: row.id,
    prescriptionId: row.prescription_id,
    patientId: row.patient_id,
    branchId: row.branch_id ?? "",
    status: row.status === "dispensed" ? "dispensed" : row.status === "cancelled" ? "cancelled" : row.status === "partially_dispensed" ? "preparing" : "received",
    paymentStatus: "pending",
    unavailableItems: [],
  };
}

function cleanSearch(query: string) {
  return query.replace(/[%_,]/g, " ").trim();
}

async function currentContext() {
  return supabaseAuthService.getCurrentAuthContext();
}

export const supabasePharmacyDomainService: PharmacyDomainService = {
  async getMedicines(filters?: MedicineFilters) {
    let query = supabase.from("medicines").select("*").order("name", { ascending: true });
    if (filters?.clinicId) query = query.eq("clinic_id", filters.clinicId);
    if (filters?.branchId) query = query.or(`branch_id.is.null,branch_id.eq.${filters.branchId}`);
    if (filters?.status) query = query.eq("status", filters.status);
    if (filters?.query) {
      const search = cleanSearch(filters.query);
      if (search) query = query.or(`name.ilike.%${search}%,generic_name.ilike.%${search}%,manufacturer.ilike.%${search}%`);
    }
    const { data, error } = await query;
    if (error) throw error;
    return (data ?? []).map(mapMedicine);
  },

  async getMedicineById(id) {
    const { data, error } = await supabase.from("medicines").select("*").eq("id", id).maybeSingle();
    if (error) throw error;
    return data;
  },

  async getMedicineCatalog(options) {
    let query = supabase.from("medicines").select("*").order("name", { ascending: true });
    if (options?.status) query = query.eq("status", options.status);
    const { data, error } = await query;
    if (error) throw error;
    return data ?? [];
  },

  async createMedicine(input: TablesInsert<"medicines">) {
    const context = await currentContext();
    const payload: TablesInsert<"medicines"> = {
      ...input,
      clinic_id: input.clinic_id || context.clinic_id || "",
      branch_id: input.branch_id ?? context.branch_id,
      status: input.status ?? "active",
    };
    const { data, error } = await supabase.from("medicines").insert(payload).select("*").single();
    if (error) throw error;
    return data;
  },

  async updateMedicine(id, input: TablesUpdate<"medicines">) {
    const { data, error } = await supabase.from("medicines").update(input).eq("id", id).select("*").single();
    if (error) throw error;
    return data;
  },

  async getStockBatches(medicineId) {
    let query = supabase.from("medicine_stock_batches").select("*").order("expiry_date", { ascending: true });
    if (medicineId) query = query.eq("medicine_id", medicineId);
    const { data, error } = await query;
    if (error) throw error;
    return data ?? [];
  },

  async addStockBatch(input: TablesInsert<"medicine_stock_batches">) {
    const context = await currentContext();
    const payload: TablesInsert<"medicine_stock_batches"> = {
      ...input,
      clinic_id: input.clinic_id || context.clinic_id || "",
      branch_id: input.branch_id ?? context.branch_id,
      status: input.status ?? "active",
    };
    const { data, error } = await supabase.from("medicine_stock_batches").insert(payload).select("*").single();
    if (error) throw error;
    await this.refreshLowStockAlerts(payload.clinic_id, payload.branch_id ?? undefined);
    return data;
  },

  async adjustStock(input) {
    const payload = {
      batch_id: input.batchId,
      movement_type: input.movementType,
      quantity: input.quantity,
      reason: input.reason,
      reference_type: input.referenceType,
      reference_id: input.referenceId,
    };
    const { data, error } = await supabase.rpc("adjust_medicine_stock", { input: payload as Json });
    if (error) throw error;
    logAuditEvent({ clinicId: data.clinic_id, branchId: data.branch_id, eventType: "pharmacy_stock_adjusted", entityType: "medicine_stock_batches", entityId: data.id, action: "stock_adjust", status: "success", severity: "info", message: "Medicine stock adjusted.", metadata: { movement_type: input.movementType, quantity: input.quantity } });
    return data;
  },

  async getPharmacyQueue(options) {
    let query = supabase
      .from("pharmacy_orders")
      .select(QUEUE_SELECT)
      .order("created_at", { ascending: false })
      .limit(options?.limit ?? 300);
    if (options?.statuses?.length) query = query.in("status", options.statuses);
    if (options?.createdSince) query = query.gte("created_at", options.createdSince);
    if (options?.dispensedSince) query = query.gte("dispensed_at", options.dispensedSince);
    const { data, error } = await query;
    if (error) throw error;
    return (data ?? []).map(toQueueItem);
  },

  async getPharmacyQueueItem(orderId) {
    const { data, error } = await supabase.from("pharmacy_orders").select(QUEUE_SELECT).eq("id", orderId).maybeSingle();
    if (error) throw error;
    return data ? toQueueItem(data) : null;
  },

  async acknowledgeOrder(orderId) {
    const { error } = await supabase.rpc("acknowledge_pharmacy_order", { order_id: orderId });
    if (error) throw error;
  },

  async markOrderItemUnavailable(orderItemId, reason) {
    const { error } = await supabase.rpc("mark_pharmacy_order_item_unavailable", { input: { order_item_id: orderItemId, reason: reason ?? null } as Json });
    if (error) throw error;
  },

  async syncRoutedPrescriptions() {
    const { data: routed, error } = await supabase
      .from("prescriptions")
      .select("id")
      .eq("send_to_pharmacy", true)
      .neq("status", "cancelled")
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) throw error;
    const ids = (routed ?? []).map((row) => row.id);
    if (ids.length === 0) return 0;
    const { data: orders, error: orderError } = await supabase.from("pharmacy_orders").select("prescription_id").in("prescription_id", ids);
    if (orderError) throw orderError;
    const withOrder = new Set((orders ?? []).map((order) => order.prescription_id));
    const missing = ids.filter((id) => !withOrder.has(id));
    for (const id of missing) {
      const { error: createError } = await supabase.rpc("create_pharmacy_order_from_prescription", { prescription_id: id });
      if (createError) throw createError;
    }
    return missing.length;
  },

  async createCounterSale(input) {
    const payload = {
      patient_id: input.patientId,
      payment_mode: input.paymentMode,
      discount_amount: input.discountAmount ?? 0,
      paid_amount: input.paidAmount ?? null,
      notes: input.notes ?? null,
      items: input.items.map((item) => ({ medicine_id: item.medicineId, quantity: item.quantity, batch_id: item.batchId ?? null })),
    };
    const { data, error } = await supabase.rpc("create_pharmacy_counter_sale", { input: payload as Json });
    if (error) throw error;
    const result = (data ?? {}) as Record<string, unknown>;
    return {
      invoiceId: String(result.invoice_id ?? ""),
      invoiceNumber: String(result.invoice_number ?? ""),
      subtotal: Number(result.subtotal ?? 0),
      discountAmount: Number(result.discount_amount ?? 0),
      totalAmount: Number(result.total_amount ?? 0),
      paidAmount: Number(result.paid_amount ?? 0),
      paymentStatus: String(result.payment_status ?? ""),
    };
  },

  async getRecentMovements(options) {
    let query = supabase
      .from("stock_movements")
      .select("*, medicines(name), medicine_stock_batches(batch_no), staff_profiles(full_name)")
      .order("created_at", { ascending: false })
      .limit(options?.limit ?? 10);
    if (options?.movementType) query = query.eq("movement_type", options.movementType);
    if (options?.since) query = query.gte("created_at", options.since);
    const { data, error } = await query;
    if (error) throw error;
    return (data ?? []).map((row) => ({
      id: row.id,
      medicineId: row.medicine_id,
      medicineName: row.medicines?.name ?? "Medicine",
      movementType: row.movement_type,
      quantity: row.quantity,
      direction: row.movement_type === "add_stock" ? ("in" as const) : ("out" as const),
      reason: row.reason ?? "",
      batchNumber: row.medicine_stock_batches?.batch_no ?? "",
      by: row.staff_profiles?.full_name ?? "",
      at: row.created_at ?? "",
      referenceType: row.reference_type ?? "",
    }));
  },

  async getMedicineAvailability() {
    const today = localDateISO();
    const [{ data: medicines, error }, { data: batches, error: batchError }] = await Promise.all([
      supabase.from("medicines").select("id,name").eq("status", "active").order("name", { ascending: true }),
      supabase.from("medicine_stock_batches").select("medicine_id,quantity_available,expiry_date,status").eq("status", "active").gt("quantity_available", 0),
    ]);
    if (error) throw error;
    if (batchError) throw batchError;
    const units = new Map<string, number>();
    for (const batch of batches ?? []) {
      if (batch.expiry_date && batch.expiry_date < today) continue;
      units.set(batch.medicine_id, (units.get(batch.medicine_id) ?? 0) + batch.quantity_available);
    }
    return (medicines ?? []).map((medicine) => ({ id: medicine.id, name: medicine.name, availableUnits: units.get(medicine.id) ?? 0 }));
  },

  async countOpenPharmacyOrders() {
    const { count, error } = await supabase
      .from("pharmacy_orders")
      .select("id", { count: "exact", head: true })
      .in("status", ["pending", "partially_dispensed"]);
    if (error) throw error;
    return count ?? 0;
  },

  subscribeToPharmacyOrders(clinicId, onChange) {
    // Each subscriber gets its own channel so one unmount never tears down another's.
    channelSequence += 1;
    const channel = supabase
      .channel(`pharmacy-orders-${clinicId}-${channelSequence}`)
      .on<OrderRow>("postgres_changes", { event: "*", schema: "public", table: "pharmacy_orders", filter: `clinic_id=eq.${clinicId}` }, (payload) => {
        const order = payload.eventType === "DELETE" ? null : payload.new;
        onChange({ eventType: payload.eventType, order });
      })
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  },

  async createOrderFromPrescription(prescriptionId) {
    const { data, error } = await supabase.rpc("create_pharmacy_order_from_prescription", { prescription_id: prescriptionId });
    if (error) throw error;
    return data;
  },

  async dispenseOrder(input: DispenseOrderInput) {
    const payload = {
      order_id: input.orderId,
      items: input.items.map((item) => ({ order_item_id: item.orderItemId, batch_id: item.batchId, quantity: item.quantity })),
    };
    const { data, error } = await supabase.rpc("dispense_pharmacy_order", { input: payload as Json });
    if (error) throw error;
    logAuditEvent({ clinicId: data.clinic_id, branchId: data.branch_id, eventType: "pharmacy_order_dispensed", entityType: "pharmacy_orders", entityId: data.id, action: "dispense", status: "success", severity: "info", message: "Pharmacy order dispensed.", metadata: { item_count: input.items.length, patient_id: data.patient_id } });
    return data;
  },

  async getLowStockAlerts() {
    const { data, error } = await supabase.from("low_stock_alerts").select("*").eq("status", "active").order("created_at", { ascending: false });
    if (error) throw error;
    return data ?? [];
  },

  async refreshLowStockAlerts(clinicId, branchId) {
    const context = await currentContext();
    const { data, error } = await supabase.rpc("refresh_low_stock_alerts", {
      clinic_id: clinicId || context.clinic_id || "",
      branch_id: branchId,
    });
    if (error) throw error;
    return data ?? 0;
  },

  async getStockMovements(medicineId) {
    let query = supabase.from("stock_movements").select("*").order("created_at", { ascending: false });
    if (medicineId) query = query.eq("medicine_id", medicineId);
    const { data, error } = await query;
    if (error) throw error;
    return data ?? [];
  },

  async getMedicineMovements(medicineId, limit = 200) {
    const { data, error } = await supabase
      .from("stock_movements")
      .select("*, medicine_stock_batches(batch_no), staff_profiles(full_name)")
      .eq("medicine_id", medicineId)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) throw error;
    return (data ?? []).map((row): StockMovementRecord => ({
      id: row.id,
      movementType: row.movement_type,
      quantity: row.quantity,
      direction: row.movement_type === "add_stock" ? "in" : "out",
      reason: row.reason ?? "",
      batchNumber: row.medicine_stock_batches?.batch_no ?? "",
      by: row.staff_profiles?.full_name ?? "",
      at: row.created_at ?? "",
      referenceType: row.reference_type ?? "",
    }));
  },

  async setBatchStatus(batchId, action, reason) {
    const { data, error } = await supabase.rpc("set_medicine_batch_status", { input: { batch_id: batchId, action, reason: reason ?? null } as Json });
    if (error) throw error;
    return data;
  },

  async getInventory(branchId) {
    let query = supabase.from("medicine_stock_batches").select("*, medicines(*)").order("expiry_date", { ascending: true });
    if (branchId) query = query.eq("branch_id", branchId);
    const { data, error } = await query;
    if (error) throw error;
    return ((data ?? []) as Array<BatchRow & { medicines?: MedicineRow | null }>).map(mapInventory);
  },

  async getPharmacyOrders(branchId) {
    let query = supabase.from("pharmacy_orders").select("*").order("created_at", { ascending: false });
    if (branchId) query = query.eq("branch_id", branchId);
    const { data, error } = await query;
    if (error) throw error;
    return (data ?? []).map(mapOrder);
  },

  async getPharmacyBills(dateFrom, limit = 50) {
    let query = supabase.from("invoices").select("*").eq("invoice_type", "pharmacy").neq("invoice_status", "cancelled").order("created_at", { ascending: false }).limit(limit);
    // A bare date means the start of that day in the clinic's time zone (IST), not UTC.
    if (dateFrom) query = query.gte("created_at", /^\d{4}-\d{2}-\d{2}$/.test(dateFrom) ? istDayStartISO(dateFrom) : dateFrom);
    const { data: invoices, error } = await query;
    if (error) throw error;
    const rows = invoices ?? [];
    if (rows.length === 0) return [];

    const invoiceIds = rows.map((row) => row.id);
    const [{ data: items }, { data: patients }, { data: payments }] = await Promise.all([
      supabase.from("invoice_items").select("*").in("invoice_id", invoiceIds),
      supabase.from("patients").select("id,full_name").in("id", Array.from(new Set(rows.map((row) => row.patient_id)))),
      supabase.from("manual_payment_records").select("invoice_id,payment_mode").in("invoice_id", invoiceIds),
    ]);
    const patientNames = new Map((patients ?? []).map((patient) => [patient.id, patient.full_name]));
    const modes = new Map((payments ?? []).map((payment) => [payment.invoice_id, payment.payment_mode]));

    return rows.map((row): PharmacyBill => ({
      id: row.invoice_number || row.id,
      patientName: patientNames.get(row.patient_id) ?? "Patient",
      doctorName: "",
      prescriptionId: row.prescription_id ?? undefined,
      subtotal: row.subtotal ?? 0,
      discount: row.discount_amount ?? 0,
      total: row.total_amount ?? 0,
      paymentMode: (modes.get(row.id) ?? "cash") as PharmacyBill["paymentMode"],
      paymentStatus: row.payment_status === "paid" ? "paid" : row.payment_status === "partial" ? "partial" : "pending",
      createdAt: row.created_at ? new Date(row.created_at).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" }) : "",
      items: (items ?? [])
        .filter((item) => item.invoice_id === row.id)
        .map((item) => ({
          medicineName: item.description,
          quantity: item.quantity ?? 1,
          unitPrice: item.unit_price ?? 0,
          discount: item.discount_amount ?? 0,
        })),
    }));
  },
};
