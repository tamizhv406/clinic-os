import { useId } from "react";
import { Input } from "../../../components/ui";
import type { PurchaseHeader, PurchaseHeaderErrors } from "../stockImport";
import type { Supplier } from "../types";

/** Supplier, invoice and purchase date: one set per supplier invoice, shared by the manual and Excel tabs. */
export function PurchaseHeaderFields({ value, onChange, suppliers, errors, showErrors, today, showNotes = false }: { value: PurchaseHeader; onChange: (next: PurchaseHeader) => void; suppliers: Supplier[]; errors: PurchaseHeaderErrors; showErrors: boolean; today: string; showNotes?: boolean }) {
  const listId = useId();
  const set = (patch: Partial<PurchaseHeader>) => onChange({ ...value, ...patch });
  const pickSupplier = (name: string) => {
    const match = suppliers.find((supplier) => supplier.name.toLowerCase() === name.trim().toLowerCase());
    set({ supplierName: name, supplierPhone: value.supplierPhone || match?.phone || "" });
  };
  const error = (field: keyof PurchaseHeader) => (showErrors ? errors[field] : undefined);
  return <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
    <Input label="Supplier name" requiredMark list={listId} autoComplete="off" value={value.supplierName} onChange={(event) => pickSupplier(event.target.value)} placeholder="e.g. MedSupply Distributors" error={error("supplierName")} maxLength={200} />
    <datalist id={listId}>{suppliers.map((supplier) => <option key={supplier.id} value={supplier.name} />)}</datalist>
    <Input label="Supplier phone" type="tel" inputMode="tel" value={value.supplierPhone} onChange={(event) => set({ supplierPhone: event.target.value })} placeholder="Optional" error={error("supplierPhone")} maxLength={30} />
    <Input label="Invoice number" requiredMark value={value.invoiceNumber} onChange={(event) => set({ invoiceNumber: event.target.value })} placeholder="e.g. PUR-2004" error={error("invoiceNumber")} maxLength={100} />
    <Input label="Purchase date" requiredMark type="date" max={today} value={value.purchaseDate} onChange={(event) => set({ purchaseDate: event.target.value })} error={error("purchaseDate")} />
    {showNotes && <label className="block sm:col-span-2 lg:col-span-4"><span className="field-label">Notes</span><textarea className="min-h-16 w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm focus:border-brand-500 focus:ring-2 focus:ring-brand-500/15" value={value.notes} onChange={(event) => set({ notes: event.target.value })} placeholder="Optional" maxLength={2000} />{error("notes") && <p className="field-error">{error("notes")}</p>}</label>}
  </div>;
}
