import { useEffect, useMemo, useState } from "react";
import { ReceiptIndianRupee } from "lucide-react";
import { toast } from "sonner";
import { Button, Card, Input, PageHeader, Select, Textarea } from "../../../components/ui";
import { services } from "../../../services/serviceProvider";
import { loadPendingBills } from "../pendingBills";
import { paymentModeLabel, rupee } from "../utils";
import type { BillingShortcut as PendingBill, PaymentMode } from "../types";

export default function BillingShortcut() {
  const [bills, setBills] = useState<PendingBill[]>([]);
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [mode, setMode] = useState<PaymentMode>("upi");
  const [amount, setAmount] = useState(0);
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      setBills(await loadPendingBills());
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to load pending bills.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const filtered = useMemo(() => bills.filter((bill) => `${bill.patientName} ${bill.service}`.toLowerCase().includes(query.toLowerCase())), [bills, query]);
  const selected = useMemo(() => bills.find((bill) => bill.id === selectedId), [bills, selectedId]);
  const total = useMemo(() => bills.reduce((sum, bill) => sum + bill.amount - bill.discount, 0), [bills]);

  const select = (bill: PendingBill) => {
    setSelectedId(bill.id);
    setAmount(bill.amount - bill.discount);
  };

  const collect = async () => {
    if (!selected) return toast.error("Select a pending bill first.");
    if (amount <= 0) return toast.error("Enter the amount collected.");
    setSaving(true);
    try {
      await services.billing.recordManualPayment({
        invoiceId: selected.id,
        amount,
        paymentMode: mode,
        referenceNumber: reference || undefined,
        paymentNote: note || undefined,
      });
      toast.success(`Payment of ${rupee(amount)} recorded for ${selected.patientName}.`);
      setSelectedId(""); setAmount(0); setReference(""); setNote("");
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to record the payment.");
    } finally {
      setSaving(false);
    }
  };

  return <div className="space-y-6">
    <PageHeader title="Billing Shortcut" description="Collect payments against open invoices without leaving the front desk." action={<ReceiptIndianRupee className="size-5 text-slate-400" />} />
    <div className="grid gap-4 xl:grid-cols-[.9fr_1.1fr]">
      <Card className="p-4 md:p-5">
        <h2 className="font-semibold">Pending bills</h2>
        <Input className="mt-4" placeholder="Search patient" value={query} onChange={(event) => setQuery(event.target.value)} />
        <div className="mt-4 space-y-3">
          {loading ? <p className="text-sm text-slate-500">Loading pending bills...</p>
            : filtered.length === 0 ? <p className="text-sm text-slate-500">No open invoices right now.</p>
            : filtered.map((bill) => <button key={bill.id} onClick={() => select(bill)} className={`w-full rounded-xl border p-4 text-left hover:border-brand-300 hover:bg-brand-50 ${selectedId === bill.id ? "border-brand-300 bg-brand-50" : ""}`}>
                <div className="flex justify-between"><b>{bill.patientName}</b><b>{rupee(bill.amount - bill.discount)}</b></div>
                <p className="mt-1 text-sm text-slate-500">{bill.service}{bill.doctorName ? ` · ${bill.doctorName}` : ""} · {bill.completedAt}</p>
              </button>)}
        </div>
        <p className="mt-4 rounded-xl bg-warning-50 p-3 text-sm font-semibold text-warning-700">Total pending: {rupee(total)}</p>
      </Card>

      <Card className="p-4 md:p-5">
        <h2 className="font-semibold">Collect payment</h2>
        {!selected ? <p className="mt-4 text-sm text-slate-500">Select a pending bill on the left to record a payment.</p> : <>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <Input value={selected.patientName} readOnly aria-label="Patient" />
            <Input value={selected.service} readOnly aria-label="Service" />
            <Input type="number" min={0} value={amount} onChange={(event) => setAmount(Number(event.target.value))} aria-label="Amount collected" />
            <Select value={mode} onChange={(event) => setMode(event.target.value as PaymentMode)} aria-label="Payment mode">
              {Object.entries(paymentModeLabel).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
            </Select>
            <Input value={reference} onChange={(event) => setReference(event.target.value)} placeholder="Reference number" className="md:col-span-2" />
            <Textarea className="md:col-span-2" placeholder="Notes" value={note} onChange={(event) => setNote(event.target.value)} />
          </div>
          <div className="mt-5 rounded-xl border bg-slate-50 p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Receipt preview</p>
            <div className="mt-3 flex justify-between"><span>{selected.patientName}</span><b>{rupee(amount)}</b></div>
            <p className="mt-2 text-sm text-slate-500">Mode: {paymentModeLabel[mode]} · Balance after payment: {rupee(Math.max(selected.amount - selected.discount - amount, 0))}</p>
            <Button className="mt-4 w-full" loading={saving} onClick={() => void collect()}>Record payment</Button>
          </div>
        </>}
      </Card>
    </div>
  </div>;
}
