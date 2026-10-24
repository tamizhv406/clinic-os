import { useCallback, useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { Copy, Plus, RotateCcw, Trash2 } from "lucide-react";
import { Button, Input, Select, StatusBadge } from "../../../components/ui";
import type { CreatePurchaseEntryInput } from "../../../services/interfaces";
import type { Tables } from "../../../shared/types/database.types";
import { formatDate } from "../../../utils/formatDate";
import {
  MEDICINE_CATEGORIES, checkPurchaseHeader, checkRows, emptyPurchaseHeader, emptyRowValues, isBlankRow, medicineKey, parseExpiry,
  purchaseTotals, toPurchaseItems, type PurchaseHeader, type StockImportRow, type StockRowValues,
} from "../stockImport";
import type { Supplier } from "../types";
import { rupee } from "../utils";
import { PurchaseHeaderFields } from "./PurchaseHeaderFields";

type MedicineRow = Tables<"medicines">;
type BatchRow = Tables<"medicine_stock_batches">;
type GridRow = { key: string; values: StockRowValues };

export type PurchaseEntryFormInput = CreatePurchaseEntryInput;

const newRow = (values?: Partial<StockRowValues>): GridRow => ({ key: crypto.randomUUID(), values: { ...emptyRowValues(), ...values } });
const priceText = (value: number | null | undefined) => (value === null || value === undefined ? "" : String(value));

/** Manual stock entry for one supplier invoice. Validation mirrors create_stock_purchase. */
export function PurchaseEntryForm({ catalog, lastBatchByMedicine, suppliers, today, prefillMedicine, saving, onSubmit }: {
  catalog: MedicineRow[];
  /** Most recent batch per medicine id, used to pre-fill last prices. */
  lastBatchByMedicine: Map<string, BatchRow>;
  suppliers: Supplier[];
  today: string;
  /** Medicine name to start the first row with (e.g. from a "Reorder" link). */
  prefillMedicine?: string;
  saving: boolean;
  /** Resolves true when saved; the form keeps everything the user typed when it resolves false. */
  onSubmit: (input: PurchaseEntryFormInput) => Promise<boolean>;
}) {
  const listId = useId();
  const formRef = useRef<HTMLFormElement>(null);
  const [header, setHeader] = useState<PurchaseHeader>(() => emptyPurchaseHeader(today));
  const [rows, setRows] = useState<GridRow[]>(() => [newRow({ medicineName: prefillMedicine ?? "" })]);
  const [triedSubmit, setTriedSubmit] = useState(false);

  const byName = useMemo(() => new Map(catalog.filter((medicine) => medicine.status === "active").map((medicine) => [medicineKey(medicine.name), medicine])), [catalog]);
  const knownMedicineNames = useMemo(() => new Set(byName.keys()), [byName]);

  // Picking a catalogue medicine pre-fills its master fields (generic, category,
  // strength, unit, GST) and the prices of its most recent batch. Fields the user
  // already typed are kept; the database only fills master fields that are empty.
  const lastPrices = useCallback((medicine: MedicineRow | undefined, values: StockRowValues): StockRowValues => {
    if (!medicine) return values;
    const fill = (current: string, next: string) => (current.trim() ? current : next);
    const category = (MEDICINE_CATEGORIES as readonly string[]).includes(medicine.category ?? "") ? medicine.category ?? "" : "";
    const withMaster: StockRowValues = {
      ...values,
      genericName: fill(values.genericName, medicine.generic_name ?? ""),
      category: fill(values.category, category),
      strength: fill(values.strength, medicine.strength ?? ""),
      unit: fill(values.unit, medicine.unit ?? ""),
      gstRate: fill(values.gstRate, priceText(medicine.gst_rate)),
    };
    const batch = lastBatchByMedicine.get(medicine.id);
    if (!batch) return withMaster;
    return {
      ...withMaster,
      purchasePrice: fill(values.purchasePrice, priceText(batch.purchase_price)),
      sellingPrice: fill(values.sellingPrice, priceText(batch.selling_price)),
      mrp: fill(values.mrp, batch.mrp && Number(batch.mrp) > 0 ? priceText(batch.mrp) : ""),
    };
  }, [lastBatchByMedicine]);

  // A "Reorder" link opens this tab with a medicine; fill its last prices once the catalogue has loaded.
  const prefilled = useRef(false);
  useEffect(() => {
    if (prefilled.current || !prefillMedicine || byName.size === 0) return;
    prefilled.current = true;
    setRows((current) => current.map((row, index) => (index === 0 ? { ...row, values: lastPrices(byName.get(medicineKey(row.values.medicineName)), row.values) } : row)));
  }, [prefillMedicine, byName, lastPrices]);

  const filledRows = rows.filter((row) => !isBlankRow(row.values));
  const importRows: StockImportRow[] = filledRows.map((row) => ({ id: row.key, rowNumber: rows.indexOf(row) + 1, values: row.values }));
  const { checks } = checkRows(importRows, { today, knownMedicineNames, mode: "manual" });
  const headerErrors = checkPurchaseHeader(header, today);
  const rowErrorCount = importRows.filter((row) => checks.get(row.id)?.status === "error").length;
  const canSave = !saving && filledRows.length > 0 && rowErrorCount === 0 && Object.keys(headerErrors).length === 0;

  const gstFor = (values: StockRowValues) => {
    const known = byName.get(medicineKey(values.medicineName));
    const rate = known ? Number(known.gst_rate ?? 0) : Number(values.gstRate || 0);
    return Number.isFinite(rate) ? rate : 0;
  };
  const totals = purchaseTotals(filledRows.map((row) => row.values), gstFor);

  const setValues = (key: string, patch: Partial<StockRowValues>) => setRows((current) => current.map((row) => (row.key === key ? { ...row, values: { ...row.values, ...patch } } : row)));
  const setMedicine = (key: string, name: string) => setRows((current) => current.map((row) => {
    if (row.key !== key) return row;
    const values = { ...row.values, medicineName: name };
    return { ...row, values: lastPrices(byName.get(medicineKey(name)), values) };
  }));

  const focusRow = (key: string) => requestAnimationFrame(() => formRef.current?.querySelector<HTMLInputElement>(`[data-row="${key}"] [data-field="medicineName"]`)?.focus());
  const addRow = (values?: Partial<StockRowValues>) => { const row = newRow(values); setRows((current) => [...current, row]); focusRow(row.key); };
  const removeRow = (key: string) => setRows((current) => (current.length === 1 ? [newRow()] : current.filter((row) => row.key !== key)));

  const reset = () => { setHeader(emptyPurchaseHeader(today)); setRows([newRow()]); setTriedSubmit(false); };

  // Enter never submits from a text box; Enter in the last cell of the last row adds a row.
  const onKeyDown = (event: KeyboardEvent<HTMLFormElement>) => {
    const target = event.target as HTMLElement;
    if (event.key !== "Enter" || target.tagName !== "INPUT") return;
    event.preventDefault();
    const rowKey = target.closest<HTMLElement>("[data-row]")?.dataset.row;
    if (target.dataset.lastCell === "true" && rowKey === rows[rows.length - 1]?.key) addRow();
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setTriedSubmit(true);
    if (!canSave) return;
    const saved = await onSubmit({
      supplierName: header.supplierName.trim(),
      supplierPhone: header.supplierPhone.trim() || undefined,
      invoiceNumber: header.invoiceNumber.trim(),
      purchaseDate: header.purchaseDate,
      notes: header.notes.trim() || undefined,
      source: "manual",
      items: toPurchaseItems(importRows, checks),
    });
    if (saved) reset();
  };

  return <form ref={formRef} onSubmit={submit} onKeyDown={onKeyDown} className="space-y-4" noValidate>
    <div className="card p-4 md:p-5">
      <h2 className="font-semibold">Supplier invoice</h2>
      <div className="mt-4"><PurchaseHeaderFields value={header} onChange={setHeader} suppliers={suppliers} errors={headerErrors} showErrors={triedSubmit || filledRows.length > 0} today={today} showNotes /></div>
    </div>

    <div className="card p-4 md:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="font-semibold">Medicines received</h2><p className="text-xs text-slate-500">Expiry accepts 31-08-2027, 08/27 or Aug-27. Press Enter in MRP on the last row to add a row.</p></div>
      <datalist id={listId}>{Array.from(byName.values()).map((medicine) => <option key={medicine.id} value={medicine.name}>{[medicine.strength, medicine.unit].filter(Boolean).join(" · ")}</option>)}</datalist>
      <div className="mt-4 space-y-3">
        {rows.map((row, index) => {
          const check = checks.get(row.key);
          const blank = isBlankRow(row.values);
          const known = byName.get(medicineKey(row.values.medicineName));
          const isNew = !blank && Boolean(row.values.medicineName.trim()) && !known;
          const expiry = parseExpiry(row.values.expiryDate);
          const showErrors = !blank && (triedSubmit || Boolean(row.values.medicineName.trim() && row.values.quantity.trim()));
          const v = row.values;
          return <div key={row.key} data-row={row.key} className={`rounded-xl border p-3 ${showErrors && check?.status === "error" ? "border-danger-200 bg-danger-50/40" : ""}`}>
            <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-slate-500">
              <span>Row {index + 1}</span>
              {isNew && <StatusBadge tone="info">New medicine</StatusBadge>}
              {known && <span className="min-w-0 truncate font-normal">{[known.generic_name, known.strength, known.unit, known.category].filter(Boolean).join(" · ")} · GST {Number(known.gst_rate ?? 0)}% · reorder at {known.reorder_level ?? 0}</span>}
              <span className="ml-auto flex gap-1">
                <Button type="button" variant="ghost" size="sm" aria-label={`Duplicate row ${index + 1}`} onClick={() => addRow({ ...v, batchNumber: "", expiryDate: "", quantity: "" })}><Copy className="size-4" /></Button>
                <Button type="button" variant="ghost" size="sm" aria-label={`Remove row ${index + 1}`} onClick={() => removeRow(row.key)}><Trash2 className="size-4" /></Button>
              </span>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1.1fr_.8fr_.9fr_.9fr_.9fr]">
              <Input aria-label="Medicine" data-field="medicineName" list={listId} autoComplete="off" value={v.medicineName} onChange={(event) => setMedicine(row.key, event.target.value)} placeholder="Medicine name" maxLength={200} />
              <Input aria-label="Batch number" value={v.batchNumber} onChange={(event) => setValues(row.key, { batchNumber: event.target.value })} placeholder="Batch no" maxLength={100} />
              <div><Input aria-label="Expiry" value={v.expiryDate} onChange={(event) => setValues(row.key, { expiryDate: event.target.value })} placeholder="Expiry (08/27)" />{v.expiryDate.trim() && <p className={`mt-1 text-[11px] ${expiry.iso ? "text-slate-500" : "text-danger-700"}`}>{expiry.iso ? formatDate(expiry.iso) : "Not a date"}</p>}</div>
              <Input aria-label="Quantity" inputMode="numeric" value={v.quantity} onChange={(event) => setValues(row.key, { quantity: event.target.value })} placeholder="Qty" />
              <Input aria-label="Purchase price" inputMode="decimal" value={v.purchasePrice} onChange={(event) => setValues(row.key, { purchasePrice: event.target.value })} placeholder="Purchase ₹" />
              <Input aria-label="Selling price" inputMode="decimal" value={v.sellingPrice} onChange={(event) => setValues(row.key, { sellingPrice: event.target.value })} placeholder="Selling ₹" />
              <Input aria-label="MRP" inputMode="decimal" data-last-cell={!isNew} value={v.mrp} onChange={(event) => setValues(row.key, { mrp: event.target.value })} placeholder="MRP ₹" />
            </div>
            {isNew && <div className="mt-3 grid gap-3 rounded-lg bg-slate-50 p-3 sm:grid-cols-2 lg:grid-cols-4">
              <Input aria-label="Generic name" value={v.genericName} onChange={(event) => setValues(row.key, { genericName: event.target.value })} placeholder="Generic name" />
              <Input aria-label="Manufacturer" value={v.manufacturer} onChange={(event) => setValues(row.key, { manufacturer: event.target.value })} placeholder="Manufacturer" />
              <Input aria-label="Strength" value={v.strength} onChange={(event) => setValues(row.key, { strength: event.target.value })} placeholder="Strength (650mg)" />
              <Input aria-label="Unit" value={v.unit} onChange={(event) => setValues(row.key, { unit: event.target.value })} placeholder="Unit (tablet)" />
              <Select aria-label="Category" value={v.category} onChange={(event) => setValues(row.key, { category: event.target.value })}><option value="">Category: general</option>{MEDICINE_CATEGORIES.map((category) => <option key={category} value={category}>{category}</option>)}</Select>
              <Input aria-label="HSN code" value={v.hsnCode} onChange={(event) => setValues(row.key, { hsnCode: event.target.value })} placeholder="HSN code" />
              <Input aria-label="GST %" inputMode="decimal" value={v.gstRate} onChange={(event) => setValues(row.key, { gstRate: event.target.value })} placeholder="GST %" />
              <Input aria-label="Reorder level" inputMode="numeric" data-last-cell="true" value={v.reorderLevel} onChange={(event) => setValues(row.key, { reorderLevel: event.target.value })} placeholder="Reorder level" />
            </div>}
            {showErrors && check && (check.errors.length > 0 || check.warnings.length > 0) && <ul className="mt-2 space-y-0.5 text-xs">
              {check.errors.map((message) => <li key={message} className="text-danger-700">• {message}</li>)}
              {check.warnings.filter((message) => message !== "New medicine will be created").map((message) => <li key={message} className="text-warning-700">• {message}</li>)}
            </ul>}
          </div>;
        })}
      </div>
      <Button type="button" variant="secondary" className="mt-3" icon={<Plus className="size-4" />} onClick={() => addRow()}>Add row</Button>
    </div>

    <div className="card sticky bottom-0 z-10 flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
      <dl className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm sm:flex sm:gap-6">
        <div><dt className="text-xs text-slate-500">Items</dt><dd className="font-semibold tabular-nums">{filledRows.length}</dd></div>
        <div><dt className="text-xs text-slate-500">Total units</dt><dd className="font-semibold tabular-nums">{totals.units}</dd></div>
        <div><dt className="text-xs text-slate-500">Invoice total</dt><dd className="font-semibold tabular-nums">{rupee(totals.amount)}</dd></div>
        <div><dt className="text-xs text-slate-500">GST estimate</dt><dd className="font-semibold tabular-nums">{rupee(totals.gst)}</dd></div>
      </dl>
      <div className="flex flex-wrap items-center gap-2">
        {!canSave && !saving && <span className="text-xs text-slate-500">{filledRows.length === 0 ? "Add at least one medicine." : rowErrorCount > 0 ? `Fix ${rowErrorCount} row${rowErrorCount === 1 ? "" : "s"} first.` : "Complete the supplier invoice details."}</span>}
        <Button type="button" variant="ghost" icon={<RotateCcw className="size-4" />} onClick={reset} disabled={saving}>Reset</Button>
        <Button type="submit" loading={saving} disabled={!canSave}>Save purchase</Button>
      </div>
    </div>
  </form>;
}
