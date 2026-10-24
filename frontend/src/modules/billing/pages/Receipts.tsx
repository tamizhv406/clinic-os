import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button, Card, Input, Modal, PageHeader, Select } from "../../../components/ui";
import { services } from "../../../services/serviceProvider";
import { PaymentModeBadge } from "../components/PaymentModeBadge";
import { ReceiptPreview } from "../components/ReceiptPreview";
import { toReceipt } from "../supabaseMappers";
import type { PaymentMode, Receipt } from "../types";
import { rupee } from "../utils";

export default function Receipts() {
  const [q, setQ] = useState("");
  const [mode, setMode] = useState<PaymentMode | "all">("all");
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [selected, setSelected] = useState<Receipt | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const payments = await services.billing.getManualPayments();
        const nextReceipts = await Promise.all(payments.map(async (payment) => {
          const invoice = await services.billing.getInvoiceById(payment.invoice_id);
          return toReceipt(payment, invoice, invoice?.patient);
        }));
        setReceipts(nextReceipts);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Unable to load receipts.");
      }
    };
    void load();
  }, []);

  const rows = useMemo(() => receipts.filter((r) => (mode === "all" || r.paymentMode === mode) && `${r.id} ${r.patientName}`.toLowerCase().includes(q.toLowerCase())), [receipts, q, mode]);

  return <div className="space-y-6"><PageHeader title="Receipts" description="Receipt list and compact receipt previews." /><Card className="p-4"><div className="grid gap-4 md:grid-cols-2"><Input placeholder="Search by receipt number or patient" value={q} onChange={(e) => setQ(e.target.value)} /><Select value={mode} onChange={(e) => setMode(e.target.value as PaymentMode | "all")}><option value="all">All payment modes</option><option value="cash">Cash</option><option value="upi">UPI</option><option value="card">Card</option><option value="online_link">Online Link</option></Select></div></Card>{rows.length === 0 ? <p className="text-sm text-slate-500">No receipts match the current filters.</p> : <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{rows.map((r) => <div key={r.id} className="card p-4"><div className="flex justify-between"><b>{r.id}</b><b>{rupee(r.amountPaid)}</b></div><p className="text-sm text-slate-500">{r.patientName} - {r.linkedInvoice}</p><div className="mt-2"><PaymentModeBadge mode={r.paymentMode} /></div><div className="mt-4 flex gap-2"><Button onClick={() => setSelected(r)}>View receipt</Button><Button variant="secondary" onClick={() => window.print()}>Print</Button></div></div>)}</div>}<Modal open={!!selected} onClose={() => setSelected(null)} title="Receipt Preview">{selected && <ReceiptPreview receipt={selected} />}</Modal></div>;
}
