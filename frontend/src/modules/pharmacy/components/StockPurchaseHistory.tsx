import { useCallback, useEffect, useState } from "react";
import { Download, RefreshCw } from "lucide-react";
import { Button, Drawer, EmptyState, ErrorState, Input, LoadingSkeleton, StatusBadge } from "../../../components/ui";
import { services } from "../../../services/serviceProvider";
import { downloadText, toCsv } from "../../../utils/csv";
import { formatDate } from "../../../utils/formatDate";
import type { StockPurchaseFilters, StockPurchaseLine, StockPurchaseRecord, Supplier } from "../types";
import { rupee } from "../utils";

const sourceLabel = { manual: "Manual", excel: "Excel", legacy: "Earlier entry" } as const;

/** Purchase history with a drawer showing what each purchase received. */
export function StockPurchaseHistory({ suppliers, today, refreshKey }: { suppliers: Supplier[]; today: string; refreshKey: number }) {
  const [filters, setFilters] = useState<StockPurchaseFilters>({});
  const [purchases, setPurchases] = useState<StockPurchaseRecord[] | null>(null);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<StockPurchaseRecord | null>(null);
  const [lines, setLines] = useState<StockPurchaseLine[] | null>(null);
  const [linesError, setLinesError] = useState("");

  const load = useCallback(async () => {
    setError("");
    setPurchases(null);
    try {
      setPurchases(await services.catalog.getStockPurchases(filters));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load purchase history.");
    }
  }, [filters]);

  useEffect(() => { void load(); }, [load, refreshKey]);

  const open = async (purchase: StockPurchaseRecord) => {
    setSelected(purchase);
    setLines(null);
    setLinesError("");
    try {
      setLines(await services.catalog.getStockPurchaseLines(purchase.id));
    } catch (loadError) {
      setLinesError(loadError instanceof Error ? loadError.message : "Unable to load this purchase.");
    }
  };

  const exportCsv = () => {
    if (!purchases?.length) return;
    downloadText(`stock_purchases_${today}.csv`, toCsv([
      ["Purchase date", "Supplier", "Supplier phone", "Invoice", "Items", "Total (Rs.)", "Source", "Status"],
      ...purchases.map((p) => [p.purchaseDate, p.supplierName, p.supplierPhone, p.invoiceNumber, p.itemCount, p.totalAmount.toFixed(2), sourceLabel[p.source], p.status]),
    ]));
  };

  const set = (patch: StockPurchaseFilters) => setFilters((current) => ({ ...current, ...patch }));

  return <div className="space-y-4">
    <div className="card grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1.5fr_auto] lg:items-end">
      <Input label="From" type="date" max={filters.to || today} value={filters.from ?? ""} onChange={(event) => set({ from: event.target.value || undefined })} />
      <Input label="To" type="date" min={filters.from} max={today} value={filters.to ?? ""} onChange={(event) => set({ to: event.target.value || undefined })} />
      <Input label="Supplier" list="history-suppliers" value={filters.supplier ?? ""} onChange={(event) => set({ supplier: event.target.value || undefined })} placeholder="Any supplier" />
      <datalist id="history-suppliers">{suppliers.map((supplier) => <option key={supplier.id} value={supplier.name} />)}</datalist>
      <div className="flex gap-2"><Button variant="ghost" icon={<RefreshCw className="size-4" />} onClick={() => void load()} aria-label="Refresh" /><Button variant="secondary" icon={<Download className="size-4" />} disabled={!purchases?.length} onClick={exportCsv}>Export CSV</Button></div>
    </div>

    {error ? <ErrorState title="Purchase history unavailable" description={error} onRetry={() => void load()} />
      : purchases === null ? <LoadingSkeleton variant="table" rows={5} />
      : purchases.length === 0 ? <EmptyState title="No purchases found" description="Saved supplier invoices appear here. Try a wider date range or another supplier." />
      : <div className="card overflow-hidden">
        <div className="overflow-x-auto"><table className="data-table min-w-[640px]">
          <thead><tr><th>Date</th><th>Supplier</th><th>Invoice</th><th className="numeric">Items</th><th className="numeric">Total</th><th>Source</th></tr></thead>
          <tbody>{purchases.map((purchase) => <tr key={purchase.id} className="cursor-pointer hover:bg-slate-50" tabIndex={0} onClick={() => void open(purchase)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); void open(purchase); } }}>
            <td className="whitespace-nowrap">{formatDate(purchase.purchaseDate)}</td>
            <td>{purchase.supplierName}</td>
            <td className="font-medium text-brand-700">{purchase.invoiceNumber}</td>
            <td className="numeric">{purchase.itemCount}</td>
            <td className="numeric">{rupee(purchase.totalAmount)}</td>
            <td><StatusBadge tone={purchase.source === "excel" ? "info" : purchase.source === "manual" ? "brand" : "neutral"}>{sourceLabel[purchase.source]}</StatusBadge></td>
          </tr>)}</tbody>
        </table></div>
        {purchases.length >= 500 && <p className="border-t p-3 text-xs text-slate-500">Showing the latest 500 purchases. Narrow the dates to see older ones.</p>}
      </div>}

    <Drawer open={Boolean(selected)} onClose={() => setSelected(null)} title={selected ? `Invoice ${selected.invoiceNumber}` : ""} description={selected ? `${selected.supplierName} · ${formatDate(selected.purchaseDate)} · ${rupee(selected.totalAmount)}` : undefined}>
      {linesError ? <ErrorState title="Could not load this purchase" description={linesError} onRetry={() => selected && void open(selected)} />
        : lines === null ? <LoadingSkeleton rows={3} />
        : lines.length === 0 ? <EmptyState title="No batches recorded" description="This purchase has no stock lines." />
        : <div className="space-y-3">
          {selected?.source === "legacy" && <p className="rounded-lg bg-slate-50 p-3 text-xs text-slate-600">This purchase was recorded before stock movements were kept, so only the batches linked to it are shown with their current quantity.</p>}
          {lines.map((line, index) => <div key={`${line.batchId ?? "x"}-${index}`} className="rounded-xl border p-3 text-sm">
            <div className="flex items-start justify-between gap-3"><div><p className="font-semibold">{line.medicineName}</p><p className="text-xs text-slate-500">Batch {line.batchNumber}{line.expiryDate ? ` · Expires ${formatDate(line.expiryDate)}` : ""}</p></div>{line.batchStatus && <StatusBadge tone={line.batchStatus === "active" ? "success" : "neutral"}>{line.batchStatus}</StatusBadge>}</div>
            <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs sm:grid-cols-4">
              <div><dt className="text-slate-500">Received</dt><dd className="font-semibold">{line.quantityReceived ?? "-"}</dd></div>
              <div><dt className="text-slate-500">In stock now</dt><dd className="font-semibold">{line.currentQuantity}</dd></div>
              <div><dt className="text-slate-500">Purchase / Selling</dt><dd className="font-semibold">₹{line.purchasePrice.toFixed(2)} / ₹{line.sellingPrice.toFixed(2)}</dd></div>
              <div><dt className="text-slate-500">MRP</dt><dd className="font-semibold">{line.mrp > 0 ? `₹${line.mrp.toFixed(2)}` : "-"}</dd></div>
            </dl>
          </div>)}
          <p className="text-xs text-slate-500">Prices shown are the batch's current prices; a later delivery of the same batch updates them.</p>
        </div>}
    </Drawer>
  </div>;
}
