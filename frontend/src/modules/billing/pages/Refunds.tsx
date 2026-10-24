import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button, Card, Input, PageHeader, Select, Textarea } from "../../../components/ui";
import { services } from "../../../services/serviceProvider";
import { RefundRequestCard } from "../components/RefundRequestCard";
import { BillingEmptyState } from "../components/BillingEmptyState";
import type { Invoice, PaymentMode, Refund, RefundStatus } from "../types";
import { toInvoice } from "../supabaseMappers";
import { rupee } from "../utils";

export default function Refunds() {
  const [refunds, setRefunds] = useState<Refund[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [invoiceIds, setInvoiceIds] = useState<Map<string, string>>(new Map());
  const [invoiceId, setInvoiceId] = useState("");
  const [amount, setAmount] = useState(0);
  const [reason, setReason] = useState("");
  const [mode, setMode] = useState<PaymentMode>("cash");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [nextRefunds, summaries] = await Promise.all([services.catalog.getRefunds(), services.billing.getInvoices()]);
      const details = await Promise.all(summaries.map((invoice) => services.billing.getInvoiceById(invoice.id)));
      // Only invoices with money already collected can be refunded.
      const refundable = details.filter((detail) => detail && (detail.paid_amount ?? 0) > 0 && detail.invoice_status !== "cancelled");
      setRefunds(nextRefunds);
      setInvoices(refundable.map((detail) => toInvoice(detail!, detail!.items, detail!.patient)));
      setInvoiceIds(new Map(refundable.map((detail) => [detail!.invoice_number || detail!.id, detail!.id])));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to load refunds.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const selectedInvoice = useMemo(() => invoices.find((invoice) => invoice.id === invoiceId), [invoiceId, invoices]);

  const submit = async () => {
    const targetId = invoiceIds.get(invoiceId);
    if (!targetId) return toast.error("Select the invoice being refunded.");
    if (amount <= 0) return toast.error("Enter a refund amount greater than zero.");
    if (selectedInvoice && amount > selectedInvoice.paidAmount) return toast.error("A refund cannot exceed the amount already paid.");
    if (!reason.trim()) return toast.error("Add a reason for the refund.");
    setSaving(true);
    try {
      await services.catalog.createRefund({ invoiceId: targetId, refundAmount: amount, reason: reason.trim(), refundMode: mode });
      toast.success("Refund request created.");
      setInvoiceId(""); setAmount(0); setReason("");
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to create the refund request.");
    } finally {
      setSaving(false);
    }
  };

  const updateStatus = async (id: string, status: RefundStatus) => {
    setSaving(true);
    try {
      await services.catalog.updateRefundStatus(id, status);
      toast.success(`Refund marked as ${status}.`);
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to update the refund.");
    } finally {
      setSaving(false);
    }
  };

  return <div className="space-y-6">
    <PageHeader title="Refunds" description="Raise, approve and process refunds against paid invoices." />
    <Card className="p-4 md:p-5">
      <h2 className="font-semibold">New refund request</h2>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <Select value={invoiceId} onChange={(event) => { setInvoiceId(event.target.value); setAmount(invoices.find((row) => row.id === event.target.value)?.paidAmount ?? 0); }} aria-label="Invoice">
          <option value="">Select a paid invoice</option>
          {invoices.map((invoice) => <option key={invoice.id} value={invoice.id}>{invoice.id} - {invoice.patientName} - {rupee(invoice.paidAmount)}</option>)}
        </Select>
        <Input type="number" min={0} value={amount} onChange={(event) => setAmount(Number(event.target.value))} placeholder="Refund amount" aria-label="Refund amount" />
        <Select value={mode} onChange={(event) => setMode(event.target.value as PaymentMode)} aria-label="Refund mode">
          <option value="cash">Cash</option>
          <option value="upi">UPI</option>
          <option value="card">Card</option>
          <option value="online_link">Online link</option>
        </Select>
        <Textarea className="md:col-span-2" placeholder="Reason for refund" value={reason} onChange={(event) => setReason(event.target.value)} />
      </div>
      {selectedInvoice && <p className="mt-3 text-sm text-slate-500">Invoice total {rupee(selectedInvoice.total)} · already paid {rupee(selectedInvoice.paidAmount)}.</p>}
      <Button className="mt-4" loading={saving} onClick={() => void submit()}>Create refund request</Button>
    </Card>
    <Card className="p-4 md:p-5">
      <h2 className="font-semibold">Refund requests</h2>
      {loading ? <p className="mt-4 text-sm text-slate-500">Loading refunds...</p>
        : refunds.length === 0 ? <div className="mt-4"><BillingEmptyState title="No refunds yet" description="Refund requests raised against paid invoices will appear here." /></div>
        : <div className="mt-4 grid gap-4 md:grid-cols-2">{refunds.map((refund) => <RefundRequestCard key={refund.id} refund={refund} saving={saving} onUpdateStatus={(status) => void updateStatus(refund.id, status)} />)}</div>}
    </Card>
  </div>;
}
