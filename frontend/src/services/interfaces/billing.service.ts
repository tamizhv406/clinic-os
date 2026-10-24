import type { InvoiceRecord, PaymentRecord } from "../../shared/types/domain";
import type { Tables, TablesInsert } from "../../shared/types/database.types";

export type InvoiceFilters = {
  clinicId?: string;
  branchId?: string;
  patientId?: string;
  paymentStatus?: string;
  invoiceStatus?: string;
  invoiceType?: string;
  query?: string;
};

export type InvoiceWithItems = Tables<"invoices"> & {
  items: Tables<"invoice_items">[];
  patient?: Pick<Tables<"patients">, "full_name" | "phone"> | null;
};

export type CreateInvoiceInput = {
  invoice: Omit<TablesInsert<"invoices">, "invoice_number" | "subtotal" | "discount_amount" | "tax_amount" | "total_amount" | "balance_amount" | "payment_status"> & {
    invoice_number?: string;
    payment_mode?: string;
    reference_number?: string;
  };
  items: Array<Omit<TablesInsert<"invoice_items">, "clinic_id" | "invoice_id" | "line_total"> & Partial<Pick<TablesInsert<"invoice_items">, "clinic_id" | "invoice_id" | "line_total">>>;
};

export interface BillingDomainService {
  getInvoices(filters?: string | InvoiceFilters): Promise<InvoiceRecord[]>;
  getInvoiceById(id: string): Promise<InvoiceWithItems | null>;
  getInvoicesByPatient(patientId: string): Promise<InvoiceRecord[]>;
  createInvoice(input: CreateInvoiceInput): Promise<InvoiceWithItems>;
  createInvoiceFromPharmacyOrder(pharmacyOrderId: string): Promise<Tables<"invoices">>;
  recordManualPayment(input: { invoiceId: string; amount: number; paymentMode: string; referenceNumber?: string; paymentNote?: string; receivedAt?: string }): Promise<Tables<"invoices">>;
  cancelInvoice(invoiceId: string, reason: string): Promise<Tables<"invoices">>;
  getInvoiceStatusHistory(invoiceId: string): Promise<Tables<"invoice_status_history">[]>;
  getManualPayments(invoiceId?: string): Promise<Tables<"manual_payment_records">[]>;
  getPayments(invoiceId?: string): Promise<PaymentRecord[]>;
}
