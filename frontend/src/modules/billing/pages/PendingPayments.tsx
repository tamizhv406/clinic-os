import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button, Input, Modal, PageHeader, Select, Textarea } from "../../../components/ui";
import { services } from "../../../services/serviceProvider";
import { PendingPaymentCard } from "../components/PendingPaymentCard";
import { BillingEmptyState } from "../components/BillingEmptyState";
import { toPendingPayment } from "../supabaseMappers";
import type { PaymentMode, PendingPayment } from "../types";
import { rupee } from "../utils";

export default function PendingPayments() {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<PendingPayment[]>([]);
  const [invoiceId, setInvoiceId] = useState("");
  const [amount, setAmount] = useState("");
  const [paymentMode, setPaymentMode] = useState<PaymentMode>("upi");
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const summaries = await services.billing.getInvoices({ invoiceStatus: "issued" });
      const details = await Promise.all(summaries.map((invoice) => services.billing.getInvoiceById(invoice.id)));
      setRows(details.filter((detail) => detail && (detail.balance_amount ?? 0) > 0).map((detail) => toPendingPayment(detail!, detail!.patient)));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to load pending payments.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);
  const selected = useMemo(() => rows.find((row) => row.id === invoiceId), [rows, invoiceId]);

  const openFor = (payment: PendingPayment) => {
    setInvoiceId(payment.id);
    setAmount(String(payment.balance));
    setOpen(true);
  };

  const savePayment = async () => {
    if (!invoiceId || Number(amount) <= 0) return toast.error("Select an invoice and enter a valid amount.");
    if (selected && Number(amount) > selected.balance) return toast.error(`The amount cannot exceed the balance of ${rupee(selected.balance)}.`);
    setBusy(true);
    try {
      await services.billing.recordManualPayment({ invoiceId, amount: Number(amount), paymentMode, referenceNumber: reference || undefined, paymentNote: note || undefined });
      toast.success("Payment recorded.");
      setOpen(false); setAmount(""); setNote(""); setReference(""); setInvoiceId("");
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to record payment.");
    } finally {
      setBusy(false);
    }
  };

  const sendReminder = async (payment: PendingPayment) => {
    if (!payment.phone) return toast.error("This patient has no phone number on record.");
    setBusy(true);
    try {
      await services.whatsapp.sendInvoicePlaceholder({
        phone: payment.phone,
        body: `Hello ${payment.patientName}, a balance of ${rupee(payment.balance)} is pending against bill ${payment.invoiceNumber}. Please settle it at your convenience.`,
        metadata: { type: "payment_reminder", invoice_number: payment.invoiceNumber },
      });
      toast.success("Payment reminder queued for WhatsApp delivery.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to queue the reminder.");
    } finally {
      setBusy(false);
    }
  };

  return <div className="space-y-6">
    <PageHeader title="Pending Payments" description="Collect outstanding balances and send payment reminders." action={<Button onClick={() => { setInvoiceId(""); setAmount(""); setOpen(true); }}>Record Payment</Button>} />
    {loading ? <p className="text-sm text-slate-500">Loading pending payments...</p>
      : rows.length === 0 ? <BillingEmptyState title="Nothing outstanding" description="Every issued invoice has been fully paid." />
      : <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{rows.map((payment) => <PendingPaymentCard key={payment.id} payment={payment} busy={busy} onRecordPayment={openFor} onSendReminder={(row) => void sendReminder(row)} />)}</div>}

    <Modal open={open} onClose={() => setOpen(false)} title="Record payment">
      <div className="space-y-3">
        <Select value={invoiceId} onChange={(event) => setInvoiceId(event.target.value)} aria-label="Invoice">
          <option value="">Select invoice</option>
          {rows.map((row) => <option key={row.id} value={row.id}>{row.invoiceNumber} - {row.patientName} - balance {rupee(row.balance)}</option>)}
        </Select>
        <Input type="number" min={0} placeholder={selected ? `Amount received, max ${selected.balance}` : "Amount received"} value={amount} onChange={(event) => setAmount(event.target.value)} />
        <Select value={paymentMode} onChange={(event) => setPaymentMode(event.target.value as PaymentMode)} aria-label="Payment mode">
          <option value="upi">UPI</option><option value="cash">Cash</option><option value="card">Card</option><option value="online_link">Online Link</option>
        </Select>
        <Input placeholder="Reference number" value={reference} onChange={(event) => setReference(event.target.value)} />
        <Textarea placeholder="Notes" value={note} onChange={(event) => setNote(event.target.value)} />
        <Button loading={busy} onClick={() => void savePayment()}>Save payment</Button>
      </div>
    </Modal>
  </div>;
}
