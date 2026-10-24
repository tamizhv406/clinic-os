import { StatusBadge } from "../../../components/common/StatusBadge";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button, Input, Select, Textarea } from "../../../components/ui";
import { services } from "../../../services/serviceProvider";
import type { CounterSaleResult } from "../../../services/interfaces";
import type { Tables } from "../../../shared/types/database.types";
import type { PatientRecord } from "../../../shared/types/domain";
import { formatDate, localDateISO } from "../../../utils/formatDate";
import { allocateFefo, totalUsable, usableBatches } from "../dispensePlan";
import { parseNumber } from "../stockImport";
import type { PaymentMode, PaymentStatus, PharmacyBillItem } from "../types";
import { PharmacyBillPreview } from "./PharmacyBillPreview";
import { rupee } from "../utils";

type Line = { key: string; medicineId: string; quantity: string; batchId: string };
type PayStatus = "paid" | "partial" | "unpaid";
const newLine = (): Line => ({ key: crypto.randomUUID(), medicineId: "", quantity: "1", batchId: "" });

/**
 * Counter sale. Only in-stock, unexpired medicines can be picked; batches are
 * taken FEFO unless one is chosen. Prices shown here are an estimate: the
 * database prices the sale from the batches and reduces stock in the same
 * transaction (create_pharmacy_counter_sale).
 */
export function PharmacyBillBuilder({ onSaved }: { onSaved?: (result: CounterSaleResult) => void }) {
  const today = useMemo(() => localDateISO(), []);
  const [catalog, setCatalog] = useState<Tables<"medicines">[]>([]);
  const [batches, setBatches] = useState<Tables<"medicine_stock_batches">[]>([]);
  const [loadError, setLoadError] = useState("");
  const [lines, setLines] = useState<Line[]>([newLine()]);
  const [mode, setMode] = useState<PaymentMode>("upi");
  const [payStatus, setPayStatus] = useState<PayStatus>("paid");
  const [paidText, setPaidText] = useState("");
  const [discountText, setDiscountText] = useState("");
  const [notes, setNotes] = useState("");
  const [patientQuery, setPatientQuery] = useState("");
  const [patientResults, setPatientResults] = useState<PatientRecord[]>([]);
  const [patient, setPatient] = useState<PatientRecord | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<(CounterSaleResult & { patient: PatientRecord }) | null>(null);

  const loadStock = useCallback(async () => {
    try {
      const [nextCatalog, nextBatches] = await Promise.all([services.pharmacy.getMedicineCatalog({ status: "active" }), services.pharmacy.getStockBatches()]);
      setCatalog(nextCatalog);
      setBatches(nextBatches);
      setLoadError("");
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Unable to load stock.");
    }
  }, []);
  useEffect(() => { void loadStock(); }, [loadStock]);

  useEffect(() => {
    const term = patientQuery.trim();
    if (term.length < 2 || patient) { setPatientResults([]); return; }
    let mounted = true;
    const timer = setTimeout(() => {
      void services.patients.searchPatients(term).then((rows) => { if (mounted) setPatientResults(rows.slice(0, 6)); }).catch(() => undefined);
    }, 300);
    return () => { mounted = false; clearTimeout(timer); };
  }, [patient, patientQuery]);

  // Only medicines that can actually be sold today.
  const sellable = useMemo(() => catalog
    .map((medicine) => ({ medicine, units: totalUsable(medicine.id, batches, today) }))
    .filter((entry) => entry.units > 0), [catalog, batches, today]);

  const estimates = lines.map((line) => {
    const quantity = parseNumber(line.quantity);
    const validQuantity = quantity !== null && !Number.isNaN(quantity) && Number.isInteger(quantity) && quantity > 0 && quantity <= 10000;
    const allocation = line.medicineId && validQuantity ? allocateFefo(line.medicineId, quantity!, batches, today, line.batchId || undefined) : null;
    const error = !line.medicineId ? "" : !validQuantity ? "Whole number from 1 to 10000" : allocation && allocation.shortBy > 0 ? `Only ${quantity! - allocation.shortBy} available${line.batchId ? " in this batch" : ""}` : "";
    return { line, allocation, error };
  });
  const filled = estimates.filter((estimate) => estimate.line.medicineId);
  const subtotal = Math.round(filled.reduce((sum, estimate) => sum + (estimate.allocation?.amount ?? 0), 0) * 100) / 100;
  const discount = parseNumber(discountText) ?? 0;
  const discountError = Number.isNaN(discount) || discount < 0 ? "Enter a valid amount" : discount > subtotal ? "More than the bill amount" : "";
  const total = Math.max(0, Math.round((subtotal - (discountError ? 0 : discount)) * 100) / 100);
  const paidInput = parseNumber(paidText);
  const paidError = payStatus !== "partial" ? "" : paidInput === null || Number.isNaN(paidInput) || paidInput <= 0 ? "Enter the amount received" : paidInput >= total ? "Use Paid for the full amount" : "";
  const duplicate = new Set<string>();
  const hasDuplicate = filled.some((estimate) => { const key = `${estimate.line.medicineId}:${estimate.line.batchId}`; if (duplicate.has(key)) return true; duplicate.add(key); return false; });
  const canSave = !saving && Boolean(patient) && filled.length > 0 && filled.every((estimate) => !estimate.error) && !discountError && !paidError && !hasDuplicate;

  const setLine = (key: string, patch: Partial<Line>) => setLines((current) => current.map((line) => (line.key === key ? { ...line, ...patch } : line)));
  const reset = () => { setLines([newLine()]); setDiscountText(""); setPaidText(""); setPayStatus("paid"); setNotes(""); setPatient(null); setPatientQuery(""); };

  const save = async () => {
    if (!canSave || !patient) return;
    setSaving(true);
    try {
      const result = await services.pharmacy.createCounterSale({
        patientId: patient.id,
        paymentMode: mode,
        discountAmount: discountError ? 0 : discount,
        paidAmount: payStatus === "paid" ? undefined : payStatus === "unpaid" ? 0 : paidInput ?? 0,
        notes: notes.trim() || undefined,
        items: filled.map((estimate) => ({ medicineId: estimate.line.medicineId, quantity: Number(estimate.line.quantity), batchId: estimate.line.batchId || undefined })),
      });
      setSaved({ ...result, patient });
      toast.success(`Bill ${result.invoiceNumber} saved: ${rupee(result.totalAmount)}. Stock updated.`);
      onSaved?.(result);
      reset();
      await loadStock();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "The sale was not saved.", { duration: 10000 });
    } finally {
      setSaving(false);
    }
  };

  const sendBill = async () => {
    if (!saved) return;
    const phone = saved.patient.whatsappNumber || saved.patient.phone;
    if (!phone) { toast.error("This patient has no phone number on record."); return; }
    try {
      await services.whatsapp.sendInvoicePlaceholder({
        phone,
        patientId: saved.patient.id,
        body: `Hello ${saved.patient.fullName}, your pharmacy bill ${saved.invoiceNumber} for ${rupee(saved.totalAmount)} is ready.`,
        metadata: { type: "pharmacy_bill", invoice_number: saved.invoiceNumber },
      });
      toast.success("Bill queued for WhatsApp delivery.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to queue the bill.");
    }
  };

  const previewItems: PharmacyBillItem[] = filled.flatMap((estimate) => (estimate.allocation?.lines ?? []).map((part) => ({
    medicineName: `${catalog.find((medicine) => medicine.id === estimate.line.medicineId)?.name ?? "Medicine"} (${part.batch.batch_no})`,
    quantity: part.quantity,
    unitPrice: Number(part.batch.selling_price ?? 0),
    discount: 0,
  })));
  if (previewItems.length && !discountError && discount > 0) previewItems[previewItems.length - 1] = { ...previewItems[previewItems.length - 1], discount };
  const previewStatus: PaymentStatus = payStatus === "unpaid" ? "pending" : payStatus;

  return <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,.9fr)]">
    <div className="card p-4 md:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="font-semibold">Counter sale</h2>{saved && <StatusBadge tone="success">Last bill {saved.invoiceNumber} · {rupee(saved.totalAmount)}</StatusBadge>}</div>
      {loadError && <p className="mt-3 rounded-lg bg-danger-50 p-3 text-sm text-danger-700">{loadError} <button className="font-semibold underline" onClick={() => void loadStock()}>Retry</button></p>}
      <div className="relative mt-4">
        <Input label="Patient" requiredMark value={patient ? `${patient.fullName} · ${patient.phone}` : patientQuery} onChange={(event) => { setPatient(null); setPatientQuery(event.target.value); }} placeholder="Search patient by name or phone" autoComplete="off" />
        {!patient && patientResults.length > 0 && <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-xl border bg-white shadow-card">
          {patientResults.map((row) => <button key={row.id} type="button" onClick={() => { setPatient(row); setPatientResults([]); }} className="block w-full px-4 py-2.5 text-left text-sm hover:bg-slate-50"><b>{row.fullName}</b><span className="ml-2 text-slate-500">{row.phone}</span></button>)}
        </div>}
      </div>

      <div className="mt-4 space-y-3">{estimates.map(({ line, allocation, error }, index) => {
        const options = line.medicineId ? usableBatches(line.medicineId, batches, today) : [];
        return <div key={line.key} className="rounded-xl border p-3">
          <div className="grid gap-3 sm:grid-cols-[2fr_.7fr_auto]">
            <Select aria-label={`Medicine ${index + 1}`} value={line.medicineId} onChange={(event) => setLine(line.key, { medicineId: event.target.value, batchId: "" })}>
              <option value="">Select medicine (in stock only)</option>
              {sellable.map(({ medicine, units }) => <option key={medicine.id} value={medicine.id}>{medicine.name} · {units} in stock</option>)}
            </Select>
            <Input aria-label={`Quantity ${index + 1}`} inputMode="numeric" value={line.quantity} onChange={(event) => setLine(line.key, { quantity: event.target.value })} />
            <Button type="button" variant="ghost" aria-label={`Remove medicine ${index + 1}`} disabled={lines.length === 1} onClick={() => setLines((current) => current.filter((row) => row.key !== line.key))}><Trash2 className="size-4" /></Button>
          </div>
          {line.medicineId && <div className="mt-2 grid gap-2 sm:grid-cols-[2fr_1fr] sm:items-center">
            <Select aria-label={`Batch ${index + 1}`} value={line.batchId} onChange={(event) => setLine(line.key, { batchId: event.target.value })}>
              <option value="">Auto (earliest expiry first)</option>
              {options.map((batch) => <option key={batch.id} value={batch.id}>{batch.batch_no} · {batch.quantity_available} left{batch.expiry_date ? ` · exp ${formatDate(batch.expiry_date)}` : ""} · ₹{Number(batch.selling_price ?? 0).toFixed(2)}</option>)}
            </Select>
            <p className="text-right text-sm font-semibold tabular-nums">{allocation ? rupee(allocation.amount) : "-"}</p>
          </div>}
          {error && <p className="mt-1 text-xs text-danger-700">{error}</p>}
        </div>;
      })}</div>
      {hasDuplicate && <p className="mt-2 text-xs text-danger-700">The same medicine and batch is listed twice; combine the quantities.</p>}
      <Button className="mt-3" variant="secondary" icon={<Plus className="size-4" />} onClick={() => setLines((current) => [...current, newLine()])}>Add medicine</Button>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <Input label="Bill discount (₹)" inputMode="decimal" value={discountText} onChange={(event) => setDiscountText(event.target.value)} error={discountError} placeholder="0" />
        <Select label="Payment mode" value={mode} onChange={(event) => setMode(event.target.value as PaymentMode)}><option value="cash">Cash</option><option value="upi">UPI</option><option value="card">Card</option><option value="online_link">Online link</option></Select>
        <Select label="Payment" value={payStatus} onChange={(event) => setPayStatus(event.target.value as PayStatus)}><option value="paid">Paid in full</option><option value="partial">Part paid</option><option value="unpaid">Not paid yet</option></Select>
        {payStatus === "partial" && <Input label="Amount received (₹)" requiredMark inputMode="decimal" value={paidText} onChange={(event) => setPaidText(event.target.value)} error={paidError} />}
        <Textarea className="sm:col-span-2" placeholder="Notes (optional)" value={notes} onChange={(event) => setNotes(event.target.value)} maxLength={1000} />
      </div>

      <div className="mt-4 rounded-xl bg-slate-50 p-3 text-right text-sm"><p>Subtotal {rupee(subtotal)}{!discountError && discount > 0 ? ` · Discount ${rupee(discount)}` : ""}</p><p className="text-lg font-semibold">Total {rupee(total)}</p><p className="text-xs text-slate-500">Estimate; the saved bill uses the batch prices at the moment of sale.</p></div>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Button loading={saving} disabled={!canSave} onClick={() => void save()}>Save sale</Button>
        <Button variant="ghost" onClick={reset} disabled={saving}>Clear</Button>
        <Button variant="secondary" disabled={!saved} onClick={() => void sendBill()}>Send last bill to WhatsApp</Button>
        {!canSave && !saving && <span className="text-xs text-slate-500">{!patient ? "Select the patient." : filled.length === 0 ? "Add a medicine." : "Fix the highlighted fields."}</span>}
      </div>
    </div>
    <PharmacyBillPreview items={previewItems} paymentMode={mode} paymentStatus={previewStatus} patientName={patient?.fullName ?? ""} />
  </div>;
}
