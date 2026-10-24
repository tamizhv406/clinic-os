import { supabase } from "../../lib/supabaseClient";
import type { InvoiceRecord, PaymentRecord, PaymentStatus } from "../../shared/types/domain";
import type { Json, Tables } from "../../shared/types/database.types";
import type { BillingDomainService, CreateInvoiceInput, InvoiceFilters, InvoiceWithItems } from "../interfaces";
import { logAuditEvent } from "./auditLogger";

type InvoiceRow = Tables<"invoices">;
type InvoiceItemRow = Tables<"invoice_items">;
type PaymentRow = Tables<"manual_payment_records">;

function normalizeFilters(filters?: string | InvoiceFilters): InvoiceFilters {
  return typeof filters === "string" ? { clinicId: filters } : filters ?? {};
}

function mapPaymentStatus(status: string | null): PaymentStatus {
  if (status === "paid") return "paid";
  if (status === "partial") return "partial";
  return "pending";
}

function mapInvoice(row: InvoiceRow): InvoiceRecord {
  return {
    id: row.id,
    clinicId: row.clinic_id,
    branchId: row.branch_id ?? "",
    patientId: row.patient_id,
    appointmentId: row.appointment_id ?? undefined,
    amount: row.total_amount ?? 0,
    paidAmount: row.paid_amount ?? 0,
    status: row.invoice_status === "cancelled" ? "cancelled" : mapPaymentStatus(row.payment_status),
    createdAt: row.created_at ?? "",
  };
}

function mapPayment(row: PaymentRow): PaymentRecord {
  return {
    id: row.id,
    invoiceId: row.invoice_id,
    amount: row.amount,
    mode: row.payment_mode as PaymentRecord["mode"],
    status: "paid",
    paidAt: row.received_at ?? row.created_at ?? "",
  };
}

function normalizeInvoiceRpcResult(value: Json): InvoiceWithItems {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Invoice RPC did not return a valid payload.");
  }
  const result = value as { invoice?: InvoiceRow; items?: InvoiceItemRow[] };
  if (!result.invoice) throw new Error("Invoice RPC did not return an invoice.");
  return { ...result.invoice, items: result.items ?? [], patient: null };
}

export const supabaseBillingDomainService: BillingDomainService = {
  async getInvoices(filters) {
    const normalized = normalizeFilters(filters);
    let query = supabase.from("invoices").select("*").order("created_at", { ascending: false });
    if (normalized.clinicId) query = query.eq("clinic_id", normalized.clinicId);
    if (normalized.branchId) query = query.eq("branch_id", normalized.branchId);
    if (normalized.patientId) query = query.eq("patient_id", normalized.patientId);
    if (normalized.paymentStatus) query = query.eq("payment_status", normalized.paymentStatus);
    if (normalized.invoiceStatus) query = query.eq("invoice_status", normalized.invoiceStatus);
    if (normalized.invoiceType) query = query.eq("invoice_type", normalized.invoiceType);
    if (normalized.query) {
      const search = normalized.query.replace(/[%_,]/g, " ").trim();
      if (search) query = query.or(`invoice_number.ilike.%${search}%,notes.ilike.%${search}%`);
    }
    const { data, error } = await query;
    if (error) throw error;
    return (data ?? []).map(mapInvoice);
  },

  async getInvoiceById(id) {
    const { data, error } = await supabase.from("invoices").select("*, invoice_items(*), patients(full_name, phone)").eq("id", id).maybeSingle();
    if (error) throw error;
    if (!data) return null;
    const row = data as InvoiceRow & { invoice_items?: InvoiceItemRow[]; patients?: Pick<Tables<"patients">, "full_name" | "phone"> | null };
    return { ...row, items: row.invoice_items ?? [], patient: row.patients ?? null };
  },

  async getInvoicesByPatient(patientId) {
    return this.getInvoices({ patientId });
  },

  async createInvoice(input: CreateInvoiceInput) {
    const { data, error } = await supabase.rpc("create_invoice_with_items", {
      input: {
        invoice: input.invoice,
        items: input.items,
      } as Json,
    });
    if (error) throw error;
    const result = normalizeInvoiceRpcResult(data);
    logAuditEvent({ clinicId: result.clinic_id, branchId: result.branch_id, eventType: "invoice_created", entityType: "invoices", entityId: result.id, action: "create", status: "success", severity: "info", message: "Invoice created.", metadata: { invoice_type: result.invoice_type, total_amount: result.total_amount } });
    return result;
  },

  async createInvoiceFromPharmacyOrder(pharmacyOrderId) {
    const { data, error } = await supabase.rpc("create_invoice_from_pharmacy_order", { pharmacy_order_id: pharmacyOrderId });
    if (error) throw error;
    logAuditEvent({ clinicId: data.clinic_id, branchId: data.branch_id, eventType: "invoice_created", entityType: "invoices", entityId: data.id, action: "create", status: "success", severity: "info", message: "Pharmacy invoice created.", metadata: { pharmacy_order_id: pharmacyOrderId, invoice_type: data.invoice_type } });
    return data;
  },

  async recordManualPayment(input) {
    const { data, error } = await supabase.rpc("record_manual_payment", {
      input: {
        invoice_id: input.invoiceId,
        amount: input.amount,
        payment_mode: input.paymentMode,
        reference_number: input.referenceNumber,
        payment_note: input.paymentNote,
        received_at: input.receivedAt,
      } as Json,
    });
    if (error) throw error;
    logAuditEvent({ clinicId: data.clinic_id, branchId: data.branch_id, eventType: "invoice_payment_recorded", entityType: "invoices", entityId: data.id, action: "payment", status: "success", severity: "info", message: "Manual payment recorded.", metadata: { amount: input.amount, payment_mode: input.paymentMode } });
    return data;
  },

  async cancelInvoice(invoiceId, reason) {
    const { data, error } = await supabase.rpc("cancel_invoice", { invoice_id: invoiceId, reason });
    if (error) throw error;
    logAuditEvent({ clinicId: data.clinic_id, branchId: data.branch_id, eventType: "invoice_cancelled", entityType: "invoices", entityId: data.id, action: "cancel", status: "success", severity: "warning", message: "Invoice cancelled.", metadata: { reason } });
    return data;
  },

  async getInvoiceStatusHistory(invoiceId) {
    const { data, error } = await supabase.from("invoice_status_history").select("*").eq("invoice_id", invoiceId).order("created_at", { ascending: false });
    if (error) throw error;
    return data ?? [];
  },

  async getManualPayments(invoiceId) {
    let query = supabase.from("manual_payment_records").select("*").order("received_at", { ascending: false });
    if (invoiceId) query = query.eq("invoice_id", invoiceId);
    const { data, error } = await query;
    if (error) throw error;
    return data ?? [];
  },

  async getPayments(invoiceId) {
    const rows = await this.getManualPayments(invoiceId);
    return rows.map(mapPayment);
  },
};
