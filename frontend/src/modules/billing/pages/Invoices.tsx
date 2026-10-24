import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Card, Input, Modal, PageHeader, Select } from "../../../components/ui";
import { services } from "../../../services/serviceProvider";
import { InvoicePreview } from "../components/InvoicePreview";
import { InvoiceTable } from "../components/InvoiceTable";
import { toInvoice } from "../supabaseMappers";
import type { BillType, Invoice, PaymentMode, PaymentStatus } from "../types";

export default function Invoices() {
  const [q, setQ] = useState("");
  const [type, setType] = useState<BillType | "all">("all");
  const [status, setStatus] = useState<PaymentStatus | "all">("all");
  const [mode, setMode] = useState<PaymentMode | "all">("all");
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [selected, setSelected] = useState<Invoice | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const summaries = await services.billing.getInvoices();
        const details = await Promise.all(summaries.map((invoice) => services.billing.getInvoiceById(invoice.id)));
        setInvoices(details.filter(Boolean).map((detail) => toInvoice(detail!, detail!.items, detail!.patient)));
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Unable to load invoices.");
      }
    };
    void load();
  }, []);

  const rows = useMemo(() => invoices.filter((i) => (type === "all" || i.billType === type) && (status === "all" || i.paymentStatus === status) && (mode === "all" || i.paymentMode === mode) && `${i.id} ${i.patientName} ${i.phone}`.toLowerCase().includes(q.toLowerCase())), [invoices, q, type, status, mode]);

  return <div className="space-y-6"><PageHeader title="Invoices" description="Search invoices and open a printable preview." /><Card className="p-4"><div className="grid gap-4 lg:grid-cols-4"><Input placeholder="Search invoice" value={q} onChange={(e) => setQ(e.target.value)} /><Select value={type} onChange={(e) => setType(e.target.value as BillType | "all")}><option value="all">All bill types</option><option value="consultation">Consultation</option><option value="procedure">Procedure</option><option value="pharmacy">Pharmacy</option><option value="package">Package</option><option value="other">Other</option></Select><Select value={status} onChange={(e) => setStatus(e.target.value as PaymentStatus | "all")}><option value="all">All statuses</option><option value="paid">Paid</option><option value="pending">Pending</option><option value="partial">Partial</option><option value="refunded">Refunded</option><option value="cancelled">Cancelled</option></Select><Select value={mode} onChange={(e) => setMode(e.target.value as PaymentMode | "all")}><option value="all">All modes</option><option value="cash">Cash</option><option value="upi">UPI</option><option value="card">Card</option><option value="online_link">Online Link</option></Select></div></Card><Card className="p-4 md:p-5"><InvoiceTable invoices={rows} onView={setSelected} /></Card><Modal open={!!selected} onClose={() => setSelected(null)} title="Invoice Preview">{selected && <InvoicePreview invoice={selected} />}</Modal></div>;
}
