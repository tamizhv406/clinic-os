import { supabase } from "../../lib/supabaseClient";
import type { Json, Tables, TablesInsert, TablesUpdate } from "../../shared/types/database.types";
import type { LabTest, Medicine as FavoriteMedicine, PrescriptionTemplate } from "../../modules/doctor/types";
import type { PurchaseEntry, StockPurchaseLine, StockPurchaseRecord, Supplier } from "../../modules/pharmacy/types";
import type { Refund, RefundStatus } from "../../modules/billing/types";
import type { CatalogService, CreatePurchaseEntryInput, CreateRefundInput } from "../interfaces";
import { supabaseAuthService } from "./supabaseAuth.service";

type TemplateRow = Tables<"prescription_templates">;
type TemplateItemRow = Tables<"prescription_template_items">;
type PurchaseRow = Tables<"stock_purchases">;
type BatchRow = Tables<"medicine_stock_batches">;
type RefundRow = Tables<"invoice_refunds">;

async function clinicScope() {
  const context = await supabaseAuthService.getCurrentAuthContext();
  return { clinicId: context.clinic_id, branchId: context.branch_id, staffId: context.staffProfileId };
}

function toTemplate(row: TemplateRow, items: TemplateItemRow[]): PrescriptionTemplate {
  return {
    id: row.id,
    name: row.name,
    advice: row.advice ?? "",
    medicines: items
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((item) => ({
        id: item.id,
        medicineName: item.medicine_name,
        dosage: item.dosage ?? "",
        frequency: item.frequency ?? "",
        timing: item.timing ?? "",
        duration: item.duration ?? "",
        instructions: item.instructions ?? undefined,
        quantity: item.quantity ?? undefined,
      })),
  };
}

function toPurchaseEntry(row: PurchaseRow, batches: BatchRow[], medicineNames: Map<string, string>): PurchaseEntry {
  return {
    id: row.id,
    supplierName: row.supplier_name,
    invoiceNumber: row.invoice_number,
    purchaseDate: row.purchase_date,
    totalAmount: row.total_amount ?? 0,
    status: row.status === "draft" ? "draft" : "saved",
    items: batches.map((batch) => ({
      medicineName: medicineNames.get(batch.medicine_id) ?? "Medicine",
      batchNumber: batch.batch_no,
      expiryDate: batch.expiry_date ?? "",
      quantity: batch.quantity_available ?? 0,
      purchasePrice: batch.purchase_price ?? 0,
      sellingPrice: batch.selling_price ?? 0,
      mrp: batch.mrp ?? batch.selling_price ?? 0,
    })),
  };
}

function toRefund(row: RefundRow, invoiceNumber: string, patientName: string): Refund {
  return {
    id: row.id,
    patientName,
    invoiceNumber,
    originalAmount: row.original_amount ?? 0,
    refundAmount: row.refund_amount ?? 0,
    reason: row.reason,
    status: row.status as RefundStatus,
    date: row.created_at?.slice(0, 10) ?? "",
  };
}

export const supabaseCatalogService: CatalogService = {
  async getClinicServices(clinicId) {
    let query = supabase.from("clinic_services").select("*").eq("status", "active").order("sort_order", { ascending: true }).order("name", { ascending: true });
    if (clinicId) query = query.eq("clinic_id", clinicId);
    const { data, error } = await query;
    if (error) throw error;
    return data ?? [];
  },

  async createClinicService(input: TablesInsert<"clinic_services">) {
    const scope = await clinicScope();
    const { data, error } = await supabase
      .from("clinic_services")
      .insert({ ...input, clinic_id: input.clinic_id || scope.clinicId || "", created_by: input.created_by ?? scope.staffId })
      .select("*")
      .single();
    if (error) throw error;
    return data;
  },

  async updateClinicService(id, input: TablesUpdate<"clinic_services">) {
    const { data, error } = await supabase.from("clinic_services").update(input).eq("id", id).select("*").single();
    if (error) throw error;
    return data;
  },

  async getPrescriptionTemplates(doctorId) {
    let query = supabase.from("prescription_templates").select("*").eq("status", "active").order("name", { ascending: true });
    // A template with no doctor_id is shared across the clinic.
    if (doctorId) query = query.or(`doctor_id.eq.${doctorId},doctor_id.is.null`);
    const { data: templates, error } = await query;
    if (error) throw error;
    if (!templates || templates.length === 0) return [];
    const { data: items, error: itemsError } = await supabase
      .from("prescription_template_items")
      .select("*")
      .in("template_id", templates.map((template) => template.id));
    if (itemsError) throw itemsError;
    return templates.map((template) => toTemplate(template, (items ?? []).filter((item) => item.template_id === template.id)));
  },

  async getLabTests() {
    const { data, error } = await supabase.from("lab_tests").select("*").eq("status", "active").order("sort_order", { ascending: true }).order("name", { ascending: true });
    if (error) throw error;
    return (data ?? []).map((row): LabTest => ({ id: row.id, name: row.name }));
  },

  async getFavoriteMedicines(doctorId) {
    let query = supabase.from("doctor_favorite_medicines").select("*").order("usage_count", { ascending: false }).order("sort_order", { ascending: true }).limit(12);
    if (doctorId) query = query.or(`doctor_id.eq.${doctorId},doctor_id.is.null`);
    const { data, error } = await query;
    if (error) throw error;
    return (data ?? []).map((row): FavoriteMedicine => ({ id: row.id, name: row.medicine_name, form: row.default_dosage ?? "" }));
  },

  async recordMedicineUsage(doctorId, medicineNames) {
    const names = Array.from(new Set(medicineNames.map((name) => name.trim()).filter(Boolean)));
    if (names.length === 0) return;
    const scope = await clinicScope();
    if (!scope.clinicId) return;
    const { data: existing, error } = await supabase
      .from("doctor_favorite_medicines")
      .select("id,medicine_name,usage_count")
      .eq("clinic_id", scope.clinicId)
      .eq("doctor_id", doctorId)
      .in("medicine_name", names);
    if (error) throw error;
    const byName = new Map((existing ?? []).map((row) => [row.medicine_name, row]));
    const inserts = names.filter((name) => !byName.has(name)).map((name) => ({ clinic_id: scope.clinicId!, doctor_id: doctorId, medicine_name: name, usage_count: 1 }));
    if (inserts.length > 0) {
      const { error: insertError } = await supabase.from("doctor_favorite_medicines").insert(inserts);
      if (insertError) throw insertError;
    }
    await Promise.all(
      (existing ?? []).map((row) =>
        supabase.from("doctor_favorite_medicines").update({ usage_count: (row.usage_count ?? 0) + 1 }).eq("id", row.id),
      ),
    );
  },

  async getPurchaseEntries() {
    const { data: purchases, error } = await supabase.from("stock_purchases").select("*").order("purchase_date", { ascending: false }).limit(20);
    if (error) throw error;
    if (!purchases || purchases.length === 0) return [];
    const { data: batches, error: batchError } = await supabase
      .from("medicine_stock_batches")
      .select("*")
      .in("purchase_id", purchases.map((purchase) => purchase.id));
    if (batchError) throw batchError;
    const medicineIds = Array.from(new Set((batches ?? []).map((batch) => batch.medicine_id)));
    const { data: medicines, error: medicineError } = medicineIds.length
      ? await supabase.from("medicines").select("id,name").in("id", medicineIds)
      : { data: [], error: null };
    if (medicineError) throw medicineError;
    const names = new Map((medicines ?? []).map((medicine) => [medicine.id, medicine.name]));
    return purchases.map((purchase) => toPurchaseEntry(purchase, (batches ?? []).filter((batch) => batch.purchase_id === purchase.id), names));
  },

  async createPurchaseEntry(input: CreatePurchaseEntryInput) {
    // One atomic, permission-checked database call: the RPC validates every row,
    // adds (never replaces) batch quantities and writes stock movements. Clinic and
    // branch come from the caller's staff profile on the server.
    const payload = {
      supplier_name: input.supplierName,
      supplier_phone: input.supplierPhone ?? null,
      invoice_number: input.invoiceNumber,
      purchase_date: input.purchaseDate,
      notes: input.notes ?? null,
      source: input.source ?? "manual",
      items: input.items.map((item) => ({
        medicine_name: item.medicineName,
        batch_no: item.batchNumber,
        expiry_date: item.expiryDate,
        quantity: item.quantity,
        purchase_price: item.purchasePrice,
        selling_price: item.sellingPrice,
        mrp: item.mrp ?? null,
        category: item.category ?? null,
        generic_name: item.genericName ?? null,
        manufacturer: item.manufacturer ?? null,
        strength: item.strength ?? null,
        unit: item.unit ?? null,
        hsn_code: item.hsnCode ?? null,
        gst_rate: item.gstRate ?? null,
        reorder_level: item.reorderLevel ?? null,
      })),
    };
    const { data, error } = await supabase.rpc("create_stock_purchase", { input: payload as Json });
    if (error) throw error;
    const summary = (data ?? {}) as Record<string, unknown>;
    return {
      purchaseId: String(summary.purchase_id ?? ""),
      items: Number(summary.items ?? 0),
      medicinesCreated: Number(summary.medicines_created ?? 0),
      batchesCreated: Number(summary.batches_created ?? 0),
      batchesToppedUp: Number(summary.batches_topped_up ?? 0),
      totalAmount: Number(summary.total_amount ?? 0),
    };
  },

  async getSuppliers() {
    const { data, error } = await supabase
      .from("stock_purchases")
      .select("supplier_name, supplier_phone, purchase_date")
      .order("purchase_date", { ascending: false })
      .limit(500);
    if (error) throw error;
    const seen = new Map<string, Supplier>();
    for (const row of data ?? []) {
      const key = row.supplier_name.trim().toLowerCase();
      if (!key || seen.has(key)) continue;
      seen.set(key, { id: key, name: row.supplier_name.trim(), phone: row.supplier_phone ?? "" });
    }
    return Array.from(seen.values());
  },

  async getStockPurchases(filters) {
    let query = supabase.from("stock_purchases").select("*").order("purchase_date", { ascending: false }).order("created_at", { ascending: false }).limit(500);
    if (filters?.from) query = query.gte("purchase_date", filters.from);
    if (filters?.to) query = query.lte("purchase_date", filters.to);
    const supplier = filters?.supplier?.trim();
    if (supplier) query = query.ilike("supplier_name", `%${supplier.replace(/[%_\\]/g, "\\$&")}%`);
    const { data: purchases, error } = await query;
    if (error) throw error;
    const rows = purchases ?? [];

    // Purchases saved before create_stock_purchase have no item_count; count their batches instead.
    const legacyIds = rows.filter((row) => typeof (row.metadata as { item_count?: unknown } | null)?.item_count !== "number").map((row) => row.id);
    const legacyCounts = new Map<string, number>();
    if (legacyIds.length) {
      const { data: batches, error: batchError } = await supabase.from("medicine_stock_batches").select("purchase_id").in("purchase_id", legacyIds);
      if (batchError) throw batchError;
      for (const batch of batches ?? []) if (batch.purchase_id) legacyCounts.set(batch.purchase_id, (legacyCounts.get(batch.purchase_id) ?? 0) + 1);
    }

    return rows.map((row): StockPurchaseRecord => {
      const metadata = (row.metadata ?? {}) as { source?: string; item_count?: number };
      const source = metadata.source === "excel" || metadata.source === "manual" ? metadata.source : "legacy";
      return {
        id: row.id,
        purchaseDate: row.purchase_date,
        supplierName: row.supplier_name,
        supplierPhone: row.supplier_phone ?? "",
        invoiceNumber: row.invoice_number,
        itemCount: typeof metadata.item_count === "number" ? metadata.item_count : legacyCounts.get(row.id) ?? 0,
        totalAmount: Number(row.total_amount ?? 0),
        source,
        status: row.status,
        notes: row.notes ?? "",
        createdAt: row.created_at ?? "",
      };
    });
  },

  async getStockPurchaseLines(purchaseId) {
    const { data: movements, error } = await supabase
      .from("stock_movements")
      .select("id, medicine_id, batch_id, quantity")
      .eq("reference_id", purchaseId)
      .in("reference_type", ["stock_purchase", "stock_purchases"])
      .eq("movement_type", "add_stock")
      .order("created_at", { ascending: true });
    if (error) throw error;

    let batches: BatchRow[];
    if (movements && movements.length) {
      const batchIds = Array.from(new Set(movements.map((movement) => movement.batch_id).filter((value): value is string => Boolean(value))));
      const { data, error: batchError } = batchIds.length ? await supabase.from("medicine_stock_batches").select("*").in("id", batchIds) : { data: [], error: null };
      if (batchError) throw batchError;
      batches = data ?? [];
    } else {
      const { data, error: batchError } = await supabase.from("medicine_stock_batches").select("*").eq("purchase_id", purchaseId);
      if (batchError) throw batchError;
      batches = data ?? [];
    }

    const medicineIds = Array.from(new Set([...(movements ?? []).map((movement) => movement.medicine_id), ...batches.map((batch) => batch.medicine_id)]));
    const { data: medicines, error: medicineError } = medicineIds.length
      ? await supabase.from("medicines").select("id,name").in("id", medicineIds)
      : { data: [], error: null };
    if (medicineError) throw medicineError;
    const names = new Map((medicines ?? []).map((medicine) => [medicine.id, medicine.name]));
    const batchById = new Map(batches.map((batch) => [batch.id, batch]));

    const line = (batch: BatchRow | undefined, medicineId: string, quantityReceived: number | null): StockPurchaseLine => ({
      batchId: batch?.id ?? null,
      medicineName: names.get(medicineId) ?? "Medicine",
      batchNumber: batch?.batch_no ?? "-",
      expiryDate: batch?.expiry_date ?? "",
      quantityReceived,
      currentQuantity: batch?.quantity_available ?? 0,
      purchasePrice: Number(batch?.purchase_price ?? 0),
      sellingPrice: Number(batch?.selling_price ?? 0),
      mrp: Number(batch?.mrp ?? 0),
      batchStatus: batch?.status ?? "",
    });

    if (movements && movements.length) {
      return movements.map((movement) => line(movement.batch_id ? batchById.get(movement.batch_id) : undefined, movement.medicine_id, movement.quantity));
    }
    return batches.map((batch) => line(batch, batch.medicine_id, null));
  },

  async getRefunds() {
    const { data: refunds, error } = await supabase.from("invoice_refunds").select("*").order("created_at", { ascending: false });
    if (error) throw error;
    if (!refunds || refunds.length === 0) return [];
    const [{ data: invoices }, { data: patients }] = await Promise.all([
      supabase.from("invoices").select("id,invoice_number").in("id", refunds.map((refund) => refund.invoice_id)),
      supabase.from("patients").select("id,full_name").in("id", refunds.map((refund) => refund.patient_id)),
    ]);
    const invoiceNumbers = new Map((invoices ?? []).map((invoice) => [invoice.id, invoice.invoice_number]));
    const patientNames = new Map((patients ?? []).map((patient) => [patient.id, patient.full_name]));
    return refunds.map((refund) => toRefund(refund, invoiceNumbers.get(refund.invoice_id) ?? refund.invoice_id, patientNames.get(refund.patient_id) ?? "Patient"));
  },

  async createRefund(input: CreateRefundInput) {
    const scope = await clinicScope();
    const { data: invoice, error: invoiceError } = await supabase.from("invoices").select("*").eq("id", input.invoiceId).single();
    if (invoiceError) throw invoiceError;

    const { data, error } = await supabase
      .from("invoice_refunds")
      .insert({
        clinic_id: invoice.clinic_id,
        branch_id: invoice.branch_id,
        invoice_id: invoice.id,
        patient_id: invoice.patient_id,
        original_amount: invoice.total_amount ?? 0,
        refund_amount: input.refundAmount,
        refund_mode: input.refundMode ?? "cash",
        reason: input.reason,
        status: "requested",
        requested_by: scope.staffId,
      })
      .select("*")
      .single();
    if (error) throw error;

    const { data: patient } = await supabase.from("patients").select("full_name").eq("id", invoice.patient_id).maybeSingle();
    return toRefund(data, invoice.invoice_number, patient?.full_name ?? "Patient");
  },

  async updateRefundStatus(id, status) {
    const scope = await clinicScope();
    const { data, error } = await supabase
      .from("invoice_refunds")
      .update({
        status,
        approved_by: status === "approved" || status === "processed" ? scope.staffId : null,
        processed_at: status === "processed" ? new Date().toISOString() : null,
      })
      .eq("id", id)
      .select("*")
      .single();
    if (error) throw error;
    const [{ data: invoice }, { data: patient }] = await Promise.all([
      supabase.from("invoices").select("invoice_number").eq("id", data.invoice_id).maybeSingle(),
      supabase.from("patients").select("full_name").eq("id", data.patient_id).maybeSingle(),
    ]);
    return toRefund(data, invoice?.invoice_number ?? data.invoice_id, patient?.full_name ?? "Patient");
  },
};
