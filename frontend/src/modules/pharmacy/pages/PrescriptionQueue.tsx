import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { Button, Card, EmptyState, ErrorState, Input, LoadingSkeleton, Modal, PageHeader, StatusBadge, Tabs } from "../../../components/ui";
import { doctorLabel, usePharmacyQueueLive } from "../../../hooks/usePharmacyQueueLive";
import { InvoicePreview } from "../../billing/components/InvoicePreview";
import { toInvoice } from "../../billing/supabaseMappers";
import type { Invoice } from "../../billing/types";
import { services } from "../../../services/serviceProvider";
import type { PharmacyQueueItem } from "../../../services/interfaces";
import type { Tables } from "../../../shared/types/database.types";
import { istDayStartISO, localDateISO } from "../../../utils/formatDate";
import { OrderDetailDrawer, type DispenseRequest } from "../components/OrderDetailDrawer";
import { drawerKey, matchesTab, orderToken, patientAge, timeSince, type QueueTab } from "../dispensePlan";
import { printDispensingSlip } from "../dispensingSlip";

const TABS: { id: QueueTab; label: string }[] = [
  { id: "pending", label: "Pending" },
  { id: "partial", label: "Partially dispensed" },
  { id: "today", label: "Dispensed today" },
  { id: "all", label: "All" },
];
const statusTone = { pending: "warning", partially_dispensed: "info", dispensed: "success", cancelled: "neutral" } as const;
const statusText: Record<string, string> = { pending: "Pending", partially_dispensed: "Partially dispensed", dispensed: "Dispensed", cancelled: "Cancelled" };

export default function PrescriptionQueue() {
  const today = useMemo(() => localDateISO(), []);
  const todayStart = istDayStartISO(today);
  // The database creates orders as soon as a doctor sends a prescription; this
  // page only reads them (live), with "Sync" as a manual fallback.
  const { orders, error, lastUpdated, refresh } = usePharmacyQueueLive({ orders: { limit: 300 } });
  const [batches, setBatches] = useState<Tables<"medicine_stock_batches">[]>([]);
  const [searchParams] = useSearchParams();
  const [tab, setTab] = useState<QueueTab>(() => (TABS.some((item) => item.id === searchParams.get("tab")) ? (searchParams.get("tab") as QueueTab) : "pending"));
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [canDispense, setCanDispense] = useState(false);
  const [clinicName, setClinicName] = useState("");
  const [invoice, setInvoice] = useState<Invoice | null>(null);

  const loadBatches = useCallback(async () => {
    try { setBatches(await services.pharmacy.getStockBatches()); }
    catch (loadError) { toast.error(loadError instanceof Error ? loadError.message : "Unable to load stock batches."); }
  }, []);

  useEffect(() => { void loadBatches(); }, [loadBatches]);
  useEffect(() => {
    let mounted = true;
    services.auth.getCurrentAuthContext().then((context) => {
      if (!mounted) return;
      setCanDispense(context.allowedPermissions.includes("pharmacy.dispense") || context.allowedPermissions.includes("pharmacy.manage"));
      setClinicName((context.clinic as { name?: string } | null)?.name ?? "");
    }).catch(() => undefined);
    return () => { mounted = false; };
  }, []);

  const counts = useMemo(() => Object.fromEntries(TABS.map((item) => [item.id, (orders ?? []).filter((order) => matchesTab(order, item.id, todayStart)).length])) as Record<QueueTab, number>, [orders, todayStart]);
  const visible = useMemo(() => {
    const text = query.trim().toLowerCase();
    return (orders ?? []).filter((order) => matchesTab(order, tab, todayStart) && (!text || [orderToken(order.id), order.patient?.full_name, order.patient?.phone, doctorLabel(order)].filter(Boolean).join(" ").toLowerCase().includes(text)));
  }, [orders, tab, query, todayStart]);
  const selected = (orders ?? []).find((order) => order.id === selectedId) ?? null;

  const open = (order: PharmacyQueueItem) => {
    setSelectedId(order.id);
    // Lets the doctor see "Received"; failure here must not block dispensing.
    if (canDispense && order.prescription?.pharmacy_status === "sent_to_pharmacy") services.pharmacy.acknowledgeOrder(order.id).catch(() => undefined);
  };

  const afterChange = async () => { await Promise.all([refresh(), loadBatches()]); };

  const dispense = async (items: DispenseRequest) => {
    if (!selected) return false;
    setBusy(true);
    try {
      await services.pharmacy.dispenseOrder({ orderId: selected.id, items });
      toast.success(`Dispensed ${items.length} item${items.length === 1 ? "" : "s"} for ${selected.patient?.full_name ?? "the patient"}.`);
      await afterChange();
      return true;
    } catch (dispenseError) {
      toast.error(dispenseError instanceof Error ? dispenseError.message : "Unable to dispense.");
      return false;
    } finally {
      setBusy(false);
    }
  };

  const dispenseAndBill = async (items: DispenseRequest) => {
    if (!selected) return false;
    const orderId = selected.id;
    if (!(await dispense(items))) return false;
    setBusy(true);
    try {
      const created = await services.billing.createInvoiceFromPharmacyOrder(orderId);
      const detail = await services.billing.getInvoiceById(created.id);
      if (detail) setInvoice(toInvoice(detail, detail.items, detail.patient));
      toast.success(created.invoice_number ? `Bill ${created.invoice_number} created.` : "Bill created.");
      setSelectedId(null);
      return true;
    } catch (billError) {
      toast.error(billError instanceof Error ? `Dispensed, but the bill was not created: ${billError.message}` : "Dispensed, but the bill was not created.");
      return false;
    } finally {
      setBusy(false);
    }
  };

  const markUnavailable = async (orderItemId: string, reason: string) => {
    setBusy(true);
    try {
      await services.pharmacy.markOrderItemUnavailable(orderItemId, reason || undefined);
      toast.success("Marked unavailable.");
      await afterChange();
      return true;
    } catch (markError) {
      toast.error(markError instanceof Error ? markError.message : "Unable to update the item.");
      return false;
    } finally {
      setBusy(false);
    }
  };

  const sync = async () => {
    setSyncing(true);
    try {
      const created = await services.pharmacy.syncRoutedPrescriptions();
      toast.success(created ? `Created ${created} missing order${created === 1 ? "" : "s"}.` : "Queue is up to date.");
      await refresh();
    } catch (syncError) {
      toast.error(syncError instanceof Error ? syncError.message : "Sync failed.");
    } finally {
      setSyncing(false);
    }
  };

  return <div className="space-y-5">
    <PageHeader title="Prescription Queue" description={`Prescriptions sent by doctors appear here automatically.${lastUpdated ? ` Updated ${lastUpdated.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}.` : ""}`}
      action={<><Button variant="ghost" icon={<RefreshCw className="size-4" />} onClick={() => void afterChange()}>Refresh</Button>{canDispense && <Button variant="secondary" loading={syncing} onClick={() => void sync()}>Sync</Button>}</>} />
    <Tabs items={TABS.map((item) => ({ id: item.id, label: `${item.label} (${counts[item.id] ?? 0})` }))} value={tab} onChange={(id) => setTab(id as QueueTab)} />
    <Card className="p-3"><Input aria-label="Search the queue" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search by token, patient, phone or doctor" /></Card>

    {error && !orders ? <ErrorState title="Could not load the queue" description={error} onRetry={() => void refresh()} />
      : orders === null ? <LoadingSkeleton rows={4} />
      : visible.length === 0 ? <EmptyState title={tab === "pending" ? "No pending prescriptions" : "Nothing here"} description={tab === "pending" ? "New prescriptions from doctors will appear here within seconds." : "Try another tab or clear the search."} />
      : <div className="grid gap-3 lg:grid-cols-2">{visible.map((order) => {
        const unavailable = order.items.filter((item) => item.status === "unavailable").length;
        const age = patientAge(order.patient, today);
        return <button key={order.id} type="button" onClick={() => open(order)} className="card w-full p-4 text-left transition hover:border-brand-200 hover:shadow-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0"><p className="text-xs font-semibold text-brand-700">{orderToken(order.id)}</p><p className="truncate font-semibold">{order.patient?.full_name ?? "Patient"}</p><p className="text-xs text-slate-500">{[age !== null ? `${age} y` : null, order.patient?.gender, order.patient?.phone].filter(Boolean).join(" · ")}</p></div>
            <StatusBadge tone={statusTone[(order.status ?? "pending") as keyof typeof statusTone] ?? "neutral"}>{statusText[order.status ?? "pending"] ?? order.status}</StatusBadge>
          </div>
          <p className="mt-2 text-sm text-slate-600">{doctorLabel(order)} · {order.prescription?.diagnosis_summary || "No diagnosis recorded"}</p>
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
            <span>{order.items.length} item{order.items.length === 1 ? "" : "s"}</span>
            <span>Routed {timeSince(order.created_at)}</span>
            {order.patient?.allergies?.trim() && <span className="font-semibold text-danger-700">Allergies recorded</span>}
            {unavailable > 0 && <span className="inline-flex items-center gap-1 font-semibold text-warning-700"><AlertTriangle className="size-3.5" />{unavailable} unavailable</span>}
          </div>
        </button>;
      })}</div>}

    <OrderDetailDrawer key={drawerKey(selected)} order={selected} batches={batches} today={today} canDispense={canDispense} busy={busy} onClose={() => setSelectedId(null)}
      onDispense={dispense} onDispenseAndBill={dispenseAndBill} onMarkUnavailable={markUnavailable}
      onPrint={() => { if (selected && !printDispensingSlip(selected, batches, clinicName, doctorLabel(selected))) toast.error("Allow pop-ups to print the dispensing slip."); }} />

    <Modal open={Boolean(invoice)} onClose={() => setInvoice(null)} title="Pharmacy bill" footer={<><Button variant="secondary" onClick={() => window.print()}>Print</Button><Button to="/billing/invoices" variant="secondary">All invoices</Button><Button onClick={() => setInvoice(null)}>Done</Button></>}>
      {invoice && <InvoicePreview invoice={invoice} />}
    </Modal>
  </div>;
}
