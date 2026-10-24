import type { Tables } from "../../shared/types/database.types";
import type { BillType, Invoice, PaymentMode, PaymentStatus, PendingPayment, Receipt } from "./types";

type InvoiceRow = Tables<"invoices">;
type InvoiceItemRow = Tables<"invoice_items">;
type PaymentRow = Tables<"manual_payment_records">;
type PatientLike = Pick<Tables<"patients">, "full_name" | "phone"> | null | undefined;

export function toInvoice(row: InvoiceRow, items: InvoiceItemRow[] = [], patient?: PatientLike, paymentMode: PaymentMode = "cash"): Invoice {
  return {
    id: row.invoice_number || row.id,
    patientName: patient?.full_name ?? "Patient",
    phone: patient?.phone ?? "",
    doctorName: "",
    billType: normalizeBillType(row.invoice_type),
    items: items.map((item) => ({
      id: item.id,
      name: item.description,
      category: item.item_type ?? "other",
      quantity: item.quantity ?? 1,
      unitPrice: item.unit_price ?? 0,
      discount: item.discount_amount ?? 0,
      tax: item.tax_amount ?? 0,
    })),
    subtotal: row.subtotal ?? 0,
    discount: row.discount_amount ?? 0,
    tax: row.tax_amount ?? 0,
    total: row.total_amount ?? 0,
    paidAmount: row.paid_amount ?? 0,
    balance: row.balance_amount ?? 0,
    paymentStatus: row.invoice_status === "cancelled" ? "cancelled" : normalizePaymentStatus(row.payment_status),
    paymentMode,
    date: row.created_at?.slice(0, 16).replace("T", " ") ?? "",
  };
}

export function toPendingPayment(row: InvoiceRow, patient?: PatientLike): PendingPayment {
  return {
    id: row.id,
    patientName: patient?.full_name ?? "Patient",
    phone: patient?.phone ?? "",
    invoiceNumber: row.invoice_number,
    totalAmount: row.total_amount ?? 0,
    paidAmount: row.paid_amount ?? 0,
    balance: row.balance_amount ?? 0,
    dueSince: row.created_at?.slice(0, 10) ?? "",
    lastReminder: "Payment reminder placeholder",
    paymentStatus: normalizePaymentStatus(row.payment_status),
  };
}

export function toReceipt(row: PaymentRow, invoice?: InvoiceRow | null, patient?: PatientLike): Receipt {
  return {
    id: `RCT-${row.id.slice(0, 8).toUpperCase()}`,
    patientName: patient?.full_name ?? "Patient",
    amountPaid: row.amount,
    paymentMode: row.payment_mode as PaymentMode,
    linkedInvoice: invoice?.invoice_number ?? row.invoice_id,
    dateTime: row.received_at?.slice(0, 16).replace("T", " ") ?? row.created_at?.slice(0, 16).replace("T", " ") ?? "",
    receiptType: normalizeBillType(invoice?.invoice_type),
  };
}

function normalizeBillType(value: string | null | undefined): BillType {
  const allowed: BillType[] = ["consultation", "procedure", "pharmacy", "package", "other"];
  return allowed.includes(value as BillType) ? value as BillType : "other";
}

function normalizePaymentStatus(value: string | null): PaymentStatus {
  if (value === "paid") return "paid";
  if (value === "partial") return "partial";
  return "pending";
}
