import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Download, History, PackagePlus, Pencil, ShieldBan, ShieldCheck, SlidersHorizontal } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { Button, Card, Drawer, EmptyState, ErrorState, Input, LoadingSkeleton, Modal, PageHeader, Select, StatusBadge } from "../../../components/ui";
import { services } from "../../../services/serviceProvider";
import type { Tables, TablesUpdate } from "../../../shared/types/database.types";
import { downloadText, toCsv } from "../../../utils/csv";
import { formatDate, localDateISO } from "../../../utils/formatDate";
import { EditMedicineModal } from "../components/EditMedicineModal";
import { StockAdjustmentModal } from "../components/StockAdjustmentModal";
import { MEDICINE_CATEGORIES, medicineKey } from "../stockImport";
import {
  filterSummaries, isExpired, medicineStockStatusLabel, sortSummaries, stockCsvRows, summarizeStock,
  type MedicineStockStatus, type MedicineStockSummary, type StockFilters, type StockSort,
} from "../stockSummary";
import type { StockMovementRecord } from "../types";

type MedicineRow = Tables<"medicines">;
type BatchRow = Tables<"medicine_stock_batches">;

const statusTone: Record<MedicineStockStatus, "success" | "warning" | "danger" | "neutral"> = { in_stock: "success", low: "warning", out: "danger", expired: "danger" };
const movementLabel: Record<string, string> = { add_stock: "Added", remove_stock: "Removed", damage: "Damaged", expired: "Expired", correction: "Correction", dispense: "Dispensed" };
const money = (value: number | null | undefined) => (value === null || value === undefined ? "-" : `₹${Number(value).toFixed(2)}`);

function batchTone(batch: BatchRow, today: string) {
  if (batch.status === "blocked") return { tone: "danger" as const, label: "Blocked" };
  if (isExpired(batch, today) || batch.status === "expired") return { tone: "danger" as const, label: "Expired" };
  if (batch.quantity_available <= 0 || batch.status === "depleted") return { tone: "neutral" as const, label: "Empty" };
  return { tone: "success" as const, label: "Active" };
}

export default function MedicineStock() {
  const today = useMemo(() => localDateISO(), []);
  const [catalog, setCatalog] = useState<MedicineRow[] | null>(null);
  const [batches, setBatches] = useState<BatchRow[]>([]);
  const [loadError, setLoadError] = useState("");
  const [canManage, setCanManage] = useState(false);
  // Dashboard tiles link here pre-filtered, e.g. ?status=expired or ?expiring=30.
  const [searchParams] = useSearchParams();
  const [filters, setFilters] = useState<StockFilters>(() => {
    const status = searchParams.get("status");
    const expiring = Number(searchParams.get("expiring"));
    return {
      query: "",
      category: "all",
      status: status && status in medicineStockStatusLabel ? (status as MedicineStockStatus) : "all",
      expiringWithin: [30, 60, 90].includes(expiring) ? (expiring as StockFilters["expiringWithin"]) : 0,
    };
  });
  const [sort, setSort] = useState<StockSort>("name");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<MedicineRow | null>(null);
  const [adjusting, setAdjusting] = useState<{ batches: BatchRow[]; batchId?: string; key: number } | null>(null);
  const [blocking, setBlocking] = useState<{ batch: BatchRow; medicineName: string; reason: string; saving: boolean } | null>(null);
  const [history, setHistory] = useState<{ medicine: MedicineRow; rows: StockMovementRecord[] | null; error: string } | null>(null);

  const load = useCallback(async () => {
    setLoadError("");
    try {
      // One query for all medicines and one for all batches (no per-medicine requests).
      const [nextCatalog, nextBatches] = await Promise.all([services.pharmacy.getMedicineCatalog({ status: "active" }), services.pharmacy.getStockBatches()]);
      setCatalog(nextCatalog);
      setBatches(nextBatches);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Unable to load medicine stock.");
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  // The page needs only pharmacy.view; anything that changes stock needs
  // pharmacy.manage (and the database enforces the same rule).
  useEffect(() => {
    let mounted = true;
    services.auth.getCurrentAuthContext()
      .then((context) => { if (mounted) setCanManage(context.allowedPermissions.includes("pharmacy.manage")); })
      .catch(() => { if (mounted) setCanManage(false); });
    return () => { mounted = false; };
  }, []);

  const summaries = useMemo(() => summarizeStock(catalog ?? [], batches, today), [catalog, batches, today]);
  const visible = useMemo(() => sortSummaries(filterSummaries(summaries, filters), sort), [summaries, filters, sort]);
  const setFilter = (patch: Partial<StockFilters>) => setFilters((current) => ({ ...current, ...patch }));
  const toggle = (id: string) => setExpanded((current) => { const next = new Set(current); if (next.has(id)) next.delete(id); else next.add(id); return next; });

  const saveMedicine = async (id: string, patch: TablesUpdate<"medicines">) => {
    try {
      const updated = await services.pharmacy.updateMedicine(id, patch);
      services.monitoring.logAuditEvent({ clinicId: updated.clinic_id, branchId: updated.branch_id, eventType: "pharmacy_medicine_updated", entityType: "medicines", entityId: id, action: "update", status: "success", severity: "info", message: `Medicine ${updated.name} updated.`, metadata: { fields: Object.keys(patch) } });
      await services.pharmacy.refreshLowStockAlerts(updated.clinic_id, updated.branch_id ?? undefined).catch(() => 0);
      toast.success(`${updated.name} updated.`);
      await load();
      return true;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to update the medicine.");
      return false;
    }
  };

  const adjust = async (input: { batchId: string; movementType: string; quantity: number; reason?: string }) => {
    try {
      await services.pharmacy.adjustStock(input);
      toast.success("Stock adjusted.");
      await load();
      return true;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to adjust stock.");
      return false;
    }
  };

  const setBatchStatus = async (batch: BatchRow, action: "block" | "unblock", reason?: string) => {
    try {
      await services.pharmacy.setBatchStatus(batch.id, action, reason);
      toast.success(action === "block" ? `Batch ${batch.batch_no} blocked. It can no longer be dispensed.` : `Batch ${batch.batch_no} unblocked.`);
      await load();
      return true;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to change the batch status.");
      return false;
    }
  };

  const openHistory = async (medicine: MedicineRow) => {
    setHistory({ medicine, rows: null, error: "" });
    try {
      const rows = await services.pharmacy.getMedicineMovements(medicine.id);
      setHistory((current) => (current?.medicine.id === medicine.id ? { ...current, rows } : current));
    } catch (error) {
      setHistory((current) => (current?.medicine.id === medicine.id ? { ...current, error: error instanceof Error ? error.message : "Unable to load movements." } : current));
    }
  };

  const otherNames = useMemo(() => new Set((catalog ?? []).filter((medicine) => medicine.id !== editing?.id).map((medicine) => medicineKey(medicine.name))), [catalog, editing]);

  const batchTable = (item: MedicineStockSummary) => item.batches.length === 0
    ? <p className="text-sm text-slate-500">No batches yet.</p>
    : <div className="overflow-x-auto"><table className="w-full min-w-[720px] text-sm">
      <thead className="text-left text-xs text-slate-500"><tr><th className="py-1 pr-3">Batch</th><th className="py-1 pr-3">Expiry</th><th className="py-1 pr-3 text-right">Qty</th><th className="py-1 pr-3 text-right">Purchase</th><th className="py-1 pr-3 text-right">Selling</th><th className="py-1 pr-3 text-right">MRP</th><th className="py-1 pr-3">Supplier</th><th className="py-1 pr-3">Status</th>{canManage && <th className="py-1"><span className="sr-only">Actions</span></th>}</tr></thead>
      <tbody>{item.batches.map((batch) => { const state = batchTone(batch, today); return <tr key={batch.id} className="border-t">
        <td className="py-1.5 pr-3 font-medium">{batch.batch_no}</td>
        <td className="py-1.5 pr-3">{batch.expiry_date ? formatDate(batch.expiry_date) : "-"}</td>
        <td className="py-1.5 pr-3 text-right tabular-nums">{batch.quantity_available}</td>
        <td className="py-1.5 pr-3 text-right tabular-nums">{money(batch.purchase_price)}</td>
        <td className="py-1.5 pr-3 text-right tabular-nums">{money(batch.selling_price)}</td>
        <td className="py-1.5 pr-3 text-right tabular-nums">{batch.mrp ? money(batch.mrp) : "-"}</td>
        <td className="py-1.5 pr-3">{batch.supplier_name ?? "-"}</td>
        <td className="py-1.5 pr-3"><StatusBadge tone={state.tone}>{state.label}</StatusBadge></td>
        {canManage && <td className="py-1.5"><div className="flex justify-end gap-1">
          <Button size="sm" variant="ghost" icon={<SlidersHorizontal className="size-4" />} onClick={() => setAdjusting({ batches: item.batches, batchId: batch.id, key: Date.now() })}>Adjust</Button>
          {batch.status === "blocked"
            ? <Button size="sm" variant="ghost" icon={<ShieldCheck className="size-4" />} onClick={() => void setBatchStatus(batch, "unblock")}>Unblock</Button>
            : <Button size="sm" variant="ghost" icon={<ShieldBan className="size-4" />} onClick={() => setBlocking({ batch, medicineName: item.medicine.name, reason: "", saving: false })}>Block</Button>}
        </div></td>}
      </tr>; })}</tbody>
    </table></div>;

  const medicineActions = (item: MedicineStockSummary) => canManage && <div className="flex flex-wrap gap-1">
    <Button size="sm" variant="ghost" icon={<Pencil className="size-4" />} onClick={() => setEditing(item.medicine)}>Edit</Button>
    <Button size="sm" variant="ghost" icon={<History className="size-4" />} onClick={() => void openHistory(item.medicine)}>History</Button>
  </div>;

  return <div className="space-y-5">
    <PageHeader title="Medicine Stock" description="One row per medicine. Available stock counts only active, unexpired batches." action={canManage ? <Button to="/pharmacy/add-stock" icon={<PackagePlus className="size-4" />}>Add stock</Button> : undefined} />

    <Card className="p-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_1fr_1fr_auto] lg:items-end">
        <Input label="Search" value={filters.query} onChange={(event) => setFilter({ query: event.target.value })} placeholder="Name, generic, batch or supplier" />
        <Select label="Category" value={filters.category} onChange={(event) => setFilter({ category: event.target.value })}><option value="all">All categories</option>{MEDICINE_CATEGORIES.map((category) => <option key={category} value={category}>{category}</option>)}</Select>
        <Select label="Stock status" value={filters.status} onChange={(event) => setFilter({ status: event.target.value as StockFilters["status"] })}><option value="all">Any status</option>{(Object.keys(medicineStockStatusLabel) as MedicineStockStatus[]).map((status) => <option key={status} value={status}>{medicineStockStatusLabel[status]}</option>)}</Select>
        <Select label="Expiring within" value={filters.expiringWithin} onChange={(event) => setFilter({ expiringWithin: Number(event.target.value) as StockFilters["expiringWithin"] })}><option value={0}>Any time</option><option value={30}>30 days</option><option value={60}>60 days</option><option value={90}>90 days</option></Select>
        <Select label="Sort by" value={sort} onChange={(event) => setSort(event.target.value as StockSort)}><option value="name">Name</option><option value="stock_asc">Stock (low first)</option><option value="stock_desc">Stock (high first)</option><option value="expiry">Nearest expiry</option></Select>
        <Button variant="secondary" icon={<Download className="size-4" />} disabled={!visible.length} onClick={() => downloadText(`medicine_stock_${today}.csv`, toCsv(stockCsvRows(visible)))}>Export CSV</Button>
      </div>
    </Card>

    {loadError ? <ErrorState title="Could not load medicine stock" description={loadError} onRetry={() => void load()} />
      : catalog === null ? <LoadingSkeleton variant="table" rows={6} />
      : visible.length === 0 ? <EmptyState title={summaries.length ? "No medicines match these filters" : "No medicines yet"} description={summaries.length ? "Clear a filter or search for something else." : "Add stock to create the first medicines."} />
      : <>
        <p className="text-sm text-slate-500">Showing {visible.length} of {summaries.length} medicines</p>

        <div className="card hidden overflow-hidden md:block"><table className="data-table">
          <thead><tr><th className="w-8"><span className="sr-only">Expand</span></th><th>Medicine</th><th>Category</th><th className="numeric">Available</th><th>Nearest expiry</th><th className="numeric">Batches</th><th className="numeric">Selling</th><th>Status</th>{canManage && <th><span className="sr-only">Actions</span></th>}</tr></thead>
          <tbody>{visible.map((item) => { const open = expanded.has(item.medicine.id); return <Fragment key={item.medicine.id}>
            <tr>
              <td><button type="button" className="rounded p-1 text-slate-500 hover:bg-slate-100" aria-expanded={open} aria-label={`${open ? "Hide" : "Show"} batches of ${item.medicine.name}`} onClick={() => toggle(item.medicine.id)}>{open ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}</button></td>
              <td><b>{item.medicine.name}</b><p className="text-xs text-slate-500">{[item.medicine.generic_name, item.medicine.strength].filter(Boolean).join(" · ")}</p></td>
              <td>{item.medicine.category ?? "general"}</td>
              <td className="numeric font-semibold">{item.availableUnits}{item.expiredUnits > 0 && <p className="text-xs font-normal text-danger-700">+{item.expiredUnits} expired</p>}</td>
              <td>{item.nearestExpiry ? <>{formatDate(item.nearestExpiry)}<p className={`text-xs ${item.daysToNearestExpiry !== null && item.daysToNearestExpiry <= 30 ? "text-warning-700" : "text-slate-500"}`}>{item.daysToNearestExpiry} days</p></> : "-"}</td>
              <td className="numeric">{item.batchesWithStock}</td>
              <td className="numeric">{money(item.sellingPrice)}</td>
              <td><StatusBadge tone={statusTone[item.status]}>{medicineStockStatusLabel[item.status]}</StatusBadge></td>
              {canManage && <td>{medicineActions(item)}</td>}
            </tr>
            {open && <tr><td colSpan={canManage ? 9 : 8} className="bg-slate-50 p-3">{batchTable(item)}</td></tr>}
          </Fragment>; })}</tbody>
        </table></div>

        <div className="grid gap-3 md:hidden">{visible.map((item) => { const open = expanded.has(item.medicine.id); return <div key={item.medicine.id} className="card p-4">
          <div className="flex items-start justify-between gap-3"><div className="min-w-0"><h3 className="font-semibold">{item.medicine.name}</h3><p className="text-xs text-slate-500">{[item.medicine.generic_name, item.medicine.strength, item.medicine.category].filter(Boolean).join(" · ")}</p></div><StatusBadge tone={statusTone[item.status]}>{medicineStockStatusLabel[item.status]}</StatusBadge></div>
          <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
            <div><dt className="text-xs text-slate-500">Available</dt><dd className="font-semibold">{item.availableUnits}{item.expiredUnits > 0 ? ` (+${item.expiredUnits} expired)` : ""}</dd></div>
            <div><dt className="text-xs text-slate-500">Nearest expiry</dt><dd className="font-semibold">{item.nearestExpiry ? formatDate(item.nearestExpiry) : "-"}</dd></div>
            <div><dt className="text-xs text-slate-500">Batches</dt><dd className="font-semibold">{item.batchesWithStock}</dd></div>
            <div><dt className="text-xs text-slate-500">Selling</dt><dd className="font-semibold">{money(item.sellingPrice)}</dd></div>
          </dl>
          <div className="mt-3 flex flex-wrap items-center gap-1"><Button size="sm" variant="secondary" aria-expanded={open} onClick={() => toggle(item.medicine.id)}>{open ? "Hide batches" : "Show batches"}</Button>{medicineActions(item)}</div>
          {open && <div className="mt-3 rounded-lg bg-slate-50 p-2">{batchTable(item)}</div>}
        </div>; })}</div>
      </>}

    <EditMedicineModal key={editing?.id ?? "none"} medicine={editing} otherNames={otherNames} onClose={() => setEditing(null)} onSave={saveMedicine} />
    {adjusting && <StockAdjustmentModal key={adjusting.key} open onClose={() => setAdjusting(null)} batches={adjusting.batches} initialBatchId={adjusting.batchId} onAdjust={adjust} />}

    {blocking && <Modal open onClose={() => setBlocking(null)} title={`Block batch ${blocking.batch.batch_no}?`} description={`${blocking.medicineName}: ${blocking.batch.quantity_available} units will stop counting as available and cannot be dispensed until unblocked.`} footer={<><Button variant="secondary" disabled={blocking.saving} onClick={() => setBlocking(null)}>Cancel</Button><Button variant="danger" loading={blocking.saving} disabled={blocking.reason.trim().length < 3} onClick={async () => { setBlocking({ ...blocking, saving: true }); const ok = await setBatchStatus(blocking.batch, "block", blocking.reason.trim()); setBlocking(ok ? null : { ...blocking, saving: false }); }}>Block batch</Button></>}>
      <Input label="Reason" requiredMark value={blocking.reason} onChange={(event) => setBlocking({ ...blocking, reason: event.target.value })} placeholder="e.g. Supplier recall notice" maxLength={500} />
    </Modal>}

    <Drawer open={Boolean(history)} onClose={() => setHistory(null)} title={history ? `${history.medicine.name}: movement history` : ""} description="Latest 200 movements">
      {history?.error ? <ErrorState title="Could not load movements" description={history.error} onRetry={() => history && void openHistory(history.medicine)} />
        : !history?.rows ? <LoadingSkeleton rows={4} />
        : history.rows.length === 0 ? <EmptyState title="No movements yet" description="Purchases, dispensing and adjustments appear here." />
        : <ul className="divide-y">{history.rows.map((row) => <li key={row.id} className="flex items-start justify-between gap-3 py-2.5 text-sm">
          <div className="min-w-0"><p className="font-medium">{movementLabel[row.movementType] ?? row.movementType}{row.batchNumber ? ` · ${row.batchNumber}` : ""}</p><p className="text-xs text-slate-500">{row.reason || "No reason recorded"}</p><p className="text-xs text-slate-400">{row.at ? new Date(row.at).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" }) : ""}{row.by ? ` · ${row.by}` : ""}</p></div>
          <span className={`shrink-0 font-semibold tabular-nums ${row.direction === "in" ? "text-success-700" : "text-danger-700"}`}>{row.direction === "in" ? "+" : "−"}{row.quantity}</span>
        </li>)}</ul>}
    </Drawer>

    {!canManage && catalog !== null && <p className="text-xs text-slate-500">View only. Editing and stock adjustments need the pharmacy manage permission.</p>}
  </div>;
}
