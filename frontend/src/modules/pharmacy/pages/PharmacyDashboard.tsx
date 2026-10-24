import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { Bar, BarChart, CartesianGrid, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { CalendarClock, ClipboardList, FileSpreadsheet, IndianRupee, PackageCheck, PackagePlus, ReceiptIndianRupee, TriangleAlert, Trash2 } from "lucide-react";
import { Button, EmptyState, ErrorState, LoadingSkeleton, PageHeader, StatsCard, StatusBadge } from "../../../components/ui";
import { doctorLabel, usePharmacyQueueLive } from "../../../hooks/usePharmacyQueueLive";
import { services } from "../../../services/serviceProvider";
import type { Tables } from "../../../shared/types/database.types";
import { chartTheme } from "../../../utils/chartTheme";
import { addDaysISO, CLINIC_TIME_ZONE, daysBetweenISO, formatDate, istDayStartISO, localDateISO } from "../../../utils/formatDate";
import { orderToken, timeSince } from "../dispensePlan";
import { isExpired, isUsable, summarizeStock } from "../stockSummary";
import { paymentLabel, rupee } from "../utils";

type Section<T> = { data: T | null; error: string; retry: () => void };

/** Loads one dashboard section on its own, so a failing query never blanks the page. */
function useSection<T>(loader: () => Promise<T>): Section<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let mounted = true;
    setError("");
    loader().then((next) => { if (mounted) setData(next); }).catch((loadError) => { if (mounted) setError(loadError instanceof Error ? loadError.message : "Unable to load."); });
    return () => { mounted = false; };
  }, [loader, attempt]);
  return { data, error, retry: useCallback(() => setAttempt((value) => value + 1), []) };
}

function Panel({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return <section className="card p-4 md:p-5"><div className="mb-3 flex items-center justify-between gap-2"><h2 className="font-semibold">{title}</h2>{action}</div>{children}</section>;
}

function SectionBody<T>({ section, empty, children }: { section: Section<T>; empty: (data: T) => boolean; children: (data: T) => ReactNode }) {
  if (section.error) return <ErrorState title="Could not load this section" description={section.error} onRetry={section.retry} />;
  if (section.data === null) return <LoadingSkeleton rows={2} />;
  if (empty(section.data)) return <EmptyState title="Nothing to show" description="This list is empty right now." />;
  return <>{children(section.data)}</>;
}

const movementLabel: Record<string, string> = { add_stock: "Added", remove_stock: "Removed", damage: "Damaged", expired: "Expired", correction: "Correction", dispense: "Dispensed" };

export default function PharmacyDashboard() {
  const today = useMemo(() => localDateISO(), []);
  const todayStart = istDayStartISO(today);
  const weekStart = istDayStartISO(addDaysISO(today, -6));

  const queue = usePharmacyQueueLive({ orders: { statuses: ["pending", "partially_dispensed"], limit: 5 } });
  const profile = useSection(useCallback(async () => {
    const context = await services.auth.getCurrentAuthContext();
    return { name: context.fullName, clinic: (context.clinic as { name?: string } | null)?.name ?? "" };
  }, []));
  const stock = useSection(useCallback(async () => {
    const [catalog, batches] = await Promise.all([services.pharmacy.getMedicineCatalog({ status: "active" }), services.pharmacy.getStockBatches()]);
    return { catalog, batches };
  }, []));
  const dispensedToday = useSection(useCallback(() => services.pharmacy.getPharmacyQueue({ statuses: ["dispensed"], dispensedSince: todayStart, limit: 500 }).then((rows) => rows.length), [todayStart]));
  const bills = useSection(useCallback(() => services.pharmacy.getPharmacyBills(today, 500), [today]));
  const movements = useSection(useCallback(() => services.pharmacy.getRecentMovements({ limit: 10 }), []));
  const topWeek = useSection(useCallback(async () => {
    const rows = await services.pharmacy.getRecentMovements({ movementType: "dispense", since: weekStart, limit: 2000 });
    const totals = new Map<string, number>();
    for (const row of rows) totals.set(row.medicineName, (totals.get(row.medicineName) ?? 0) + row.quantity);
    return Array.from(totals, ([name, units]) => ({ name, units })).sort((a, b) => b.units - a.units).slice(0, 5);
  }, [weekStart]));

  const stockView = useMemo(() => {
    if (!stock.data) return null;
    const { catalog, batches } = stock.data;
    const summaries = summarizeStock(catalog, batches, today);
    const names = new Map(catalog.map((medicine) => [medicine.id, medicine.name]));
    const low = summaries.filter((item) => item.status === "low" || item.status === "out").sort((a, b) => a.availableUnits - b.availableUnits);
    const expiring = batches
      .filter((batch) => isUsable(batch, today) && batch.expiry_date && daysBetweenISO(today, batch.expiry_date) <= 90)
      .map((batch) => ({ batch, name: names.get(batch.medicine_id) ?? "Medicine", days: daysBetweenISO(today, batch.expiry_date!) }))
      .sort((a, b) => a.days - b.days);
    const expiringIn30 = expiring.filter((item) => item.days <= 30).length;
    const expiredValue = batches.filter((batch: Tables<"medicine_stock_batches">) => isExpired(batch, today) && batch.quantity_available > 0)
      .reduce((sum, batch) => sum + batch.quantity_available * Number(batch.purchase_price ?? 0), 0);
    return { low, expiring, expiringIn30, expiredValue };
  }, [stock.data, today]);

  const hour = Number(new Intl.DateTimeFormat("en-IN", { timeZone: CLINIC_TIME_ZONE, hour: "numeric", hourCycle: "h23" }).format(new Date()));
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const firstName = profile.data?.name.split(" ")[0] ?? "";
  const dateText = new Date().toLocaleDateString("en-IN", { timeZone: CLINIC_TIME_ZONE, weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const tile = (value: string | null, fallback = "…") => value ?? fallback;
  const salesTotal = bills.data ? bills.data.reduce((sum, bill) => sum + bill.total, 0) : null;

  const tiles: Array<{ to: string; label: string; value: string; detail: string; icon: typeof ClipboardList; error?: boolean }> = [
    { to: "/pharmacy/prescriptions", label: "Pending prescriptions", value: tile(queue.pendingCount === null ? null : String(queue.pendingCount)), detail: "Pending or partly dispensed", icon: ClipboardList, error: Boolean(queue.error) && queue.pendingCount === null },
    { to: "/pharmacy/prescriptions?tab=today", label: "Dispensed today", value: tile(dispensedToday.data === null ? null : String(dispensedToday.data)), detail: "Prescription orders", icon: PackageCheck, error: Boolean(dispensedToday.error) },
    { to: "/pharmacy/billing", label: "Today's sales", value: tile(salesTotal === null ? null : rupee(salesTotal)), detail: bills.data ? `${bills.data.length} pharmacy bill${bills.data.length === 1 ? "" : "s"}` : "Pharmacy bills", icon: IndianRupee, error: Boolean(bills.error) },
    { to: "/pharmacy/low-stock", label: "Low stock items", value: tile(stockView ? String(stockView.low.length) : null), detail: "At or below reorder level", icon: TriangleAlert, error: Boolean(stock.error) },
    { to: "/pharmacy/stock?expiring=30", label: "Expiring in 30 days", value: tile(stockView ? String(stockView.expiringIn30) : null), detail: "Batches with stock", icon: CalendarClock, error: Boolean(stock.error) },
    { to: "/pharmacy/stock?status=expired", label: "Expired stock value", value: tile(stockView ? rupee(stockView.expiredValue) : null), detail: "At purchase price", icon: Trash2, error: Boolean(stock.error) },
  ];

  return <div className="space-y-6">
    <PageHeader title={firstName ? `${greeting}, ${firstName}` : "Pharmacy overview"} description={[profile.data?.clinic, dateText].filter(Boolean).join(" · ")} />

    <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">{tiles.map((item) => <Link key={item.label} to={item.to} className="rounded-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500">
      <StatsCard label={item.label} value={item.error ? "-" : item.value} detail={item.error ? "Could not load" : item.detail} icon={item.icon} />
    </Link>)}</div>

    <div className="flex flex-wrap gap-2">
      <Button to="/pharmacy/add-stock" icon={<PackagePlus className="size-4" />}>Add stock</Button>
      <Button to="/pharmacy/add-stock?tab=excel" variant="secondary" icon={<FileSpreadsheet className="size-4" />}>Upload Excel</Button>
      <Button to="/pharmacy/billing" variant="secondary" icon={<ReceiptIndianRupee className="size-4" />}>New counter sale</Button>
      <Button to="/pharmacy/prescriptions" variant="secondary" icon={<ClipboardList className="size-4" />}>Open queue</Button>
    </div>

    <div className="grid gap-4 xl:grid-cols-2">
      <Panel title="Pending queue" action={<Link className="text-sm font-semibold text-brand-700" to="/pharmacy/prescriptions">View all</Link>}>
        {queue.error && !queue.orders ? <ErrorState title="Could not load the queue" description={queue.error} onRetry={() => void queue.refresh()} />
          : queue.orders === null ? <LoadingSkeleton rows={2} />
          : queue.orders.length === 0 ? <EmptyState title="No pending prescriptions" description="New prescriptions from doctors appear here automatically." />
          : <ul className="divide-y">{queue.orders.map((order) => <li key={order.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
            <div className="min-w-0"><p className="truncate font-medium"><span className="text-brand-700">{orderToken(order.id)}</span> · {order.patient?.full_name ?? "Patient"}</p><p className="text-xs text-slate-500">{doctorLabel(order)} · {order.items.length} item{order.items.length === 1 ? "" : "s"} · {timeSince(order.created_at)}</p></div>
            <StatusBadge tone={order.status === "pending" ? "warning" : "info"}>{order.status === "pending" ? "Pending" : "Partial"}</StatusBadge>
          </li>)}</ul>}
      </Panel>

      <Panel title="Low stock" action={<Link className="text-sm font-semibold text-brand-700" to="/pharmacy/low-stock">View all</Link>}>
        {stock.error ? <ErrorState title="Could not load stock" description={stock.error} onRetry={stock.retry} />
          : !stockView ? <LoadingSkeleton rows={2} />
          : stockView.low.length === 0 ? <EmptyState title="All stocked" description="Every medicine is above its reorder level." />
          : <ul className="divide-y">{stockView.low.slice(0, 5).map((item) => <li key={item.medicine.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
            <div className="min-w-0"><p className="truncate font-medium">{item.medicine.name}</p><p className="text-xs text-slate-500">{item.availableUnits} left · reorder at {item.medicine.reorder_level ?? 0}</p></div>
            <Button size="sm" variant="secondary" to={`/pharmacy/add-stock?tab=manual&medicine=${encodeURIComponent(item.medicine.name)}`}>Reorder</Button>
          </li>)}</ul>}
      </Panel>

      <Panel title="Expiring soon" action={<Link className="text-sm font-semibold text-brand-700" to="/pharmacy/expiry-alerts">View all</Link>}>
        {stock.error ? <ErrorState title="Could not load stock" description={stock.error} onRetry={stock.retry} />
          : !stockView ? <LoadingSkeleton rows={2} />
          : stockView.expiring.length === 0 ? <EmptyState title="Nothing expiring soon" description="No batch with stock expires in the next 90 days." />
          : <ul className="divide-y">{stockView.expiring.slice(0, 5).map(({ batch, name, days }) => <li key={batch.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
            <div className="min-w-0"><p className="truncate font-medium">{name}</p><p className="text-xs text-slate-500">Batch {batch.batch_no} · {batch.quantity_available} units · {formatDate(batch.expiry_date!)}</p></div>
            <StatusBadge tone={days <= 30 ? "danger" : "warning"}>{days === 0 ? "Today" : `${days} day${days === 1 ? "" : "s"}`}</StatusBadge>
          </li>)}</ul>}
      </Panel>

      <Panel title="Top dispensed this week">
        <SectionBody section={topWeek} empty={(rows) => rows.length === 0}>{(rows) => <>
          <div className="h-56" role="img" aria-label="Top dispensed medicines in the last 7 days, units dispensed">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={rows} layout="vertical" margin={{ top: 4, right: 44, bottom: 4, left: 4 }}>
                <CartesianGrid horizontal={false} stroke={chartTheme.grid} />
                <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="name" width={130} tick={{ fontSize: 12, fill: "#334155" }} axisLine={false} tickLine={false} />
                <Tooltip cursor={{ fill: "#f1f5f9" }} formatter={(value) => [`${value} units`, "Dispensed"]} />
                <Bar dataKey="units" fill={chartTheme.info} barSize={14} radius={[0, 4, 4, 0]}>
                  <LabelList dataKey="units" position="right" style={{ fontSize: 12, fill: "#334155" }} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <table className="sr-only"><caption>Units dispensed in the last 7 days</caption><thead><tr><th>Medicine</th><th>Units</th></tr></thead><tbody>{rows.map((row) => <tr key={row.name}><td>{row.name}</td><td>{row.units}</td></tr>)}</tbody></table>
        </>}</SectionBody>
      </Panel>

      <Panel title="Recent stock movements">
        <SectionBody section={movements} empty={(rows) => rows.length === 0}>{(rows) => <ul className="divide-y">{rows.map((row) => <li key={row.id} className="flex items-start justify-between gap-3 py-2 text-sm">
          <div className="min-w-0"><p className="truncate font-medium">{row.medicineName}{row.batchNumber ? ` · ${row.batchNumber}` : ""}</p><p className="text-xs text-slate-500">{movementLabel[row.movementType] ?? row.movementType} · {row.at ? new Date(row.at).toLocaleString("en-IN", { timeZone: CLINIC_TIME_ZONE, dateStyle: "medium", timeStyle: "short" }) : ""}{row.by ? ` · ${row.by}` : ""}</p></div>
          <span className={`shrink-0 font-semibold tabular-nums ${row.direction === "in" ? "text-success-700" : "text-danger-700"}`}>{row.direction === "in" ? "+" : "−"}{row.quantity}</span>
        </li>)}</ul>}</SectionBody>
      </Panel>

      <Panel title="Today's bills" action={<Link className="text-sm font-semibold text-brand-700" to="/pharmacy/billing">Counter billing</Link>}>
        <SectionBody section={bills} empty={(rows) => rows.length === 0}>{(rows) => <ul className="divide-y">{rows.slice(0, 8).map((bill) => <li key={bill.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
          <div className="min-w-0"><p className="truncate font-medium">{bill.id} · {bill.patientName}</p><p className="text-xs text-slate-500">{bill.createdAt} · {paymentLabel[bill.paymentStatus]}</p></div>
          <span className="font-semibold tabular-nums">{rupee(bill.total)}</span>
        </li>)}</ul>}</SectionBody>
      </Panel>
    </div>
  </div>;
}
