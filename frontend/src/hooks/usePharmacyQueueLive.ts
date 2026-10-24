import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { services } from "../services/serviceProvider";
import type { PharmacyQueueItem, PharmacyQueueOptions } from "../services/interfaces";

const POLL_INTERVAL_MS = 30_000;
const RELOAD_DEBOUNCE_MS = 400;

export function doctorLabel(order: Pick<PharmacyQueueItem, "doctor"> | null | undefined) {
  const name = order?.doctor?.staff_profiles?.full_name?.trim();
  if (!name) return "a doctor";
  return /^dr\.?\s/i.test(name) ? name : `Dr. ${name}`;
}

/**
 * Live pharmacy queue, shared by the Prescription Queue page, the pharmacy
 * dashboard and the sidebar badge.
 *
 * Realtime changes on pharmacy_orders trigger a reload, and a 30-second poll
 * covers the case where realtime is unavailable. `notifyNewOrders` shows a
 * "New prescription from Dr. X" toast for each new order; turn it on in one
 * place only (the sidebar) so a toast is not shown twice.
 */
export function usePharmacyQueueLive({ enabled = true, orders: orderOptions, notifyNewOrders = false }: {
  enabled?: boolean;
  /** Also load the orders themselves with these filters. Omit to load only the pending count. */
  orders?: PharmacyQueueOptions;
  notifyNewOrders?: boolean;
} = {}) {
  const [pendingCount, setPendingCount] = useState<number | null>(null);
  const [orders, setOrders] = useState<PharmacyQueueItem[] | null>(null);
  const [error, setError] = useState("");
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const optionsKey = orderOptions ? JSON.stringify(orderOptions) : "";
  const loadRef = useRef<() => Promise<void>>(async () => {});

  useEffect(() => {
    if (!enabled) return;
    let mounted = true;
    let unsubscribe = () => {};
    let debounce: number | undefined;
    const options = optionsKey ? (JSON.parse(optionsKey) as PharmacyQueueOptions) : null;

    const load = async () => {
      try {
        const [count, nextOrders] = await Promise.all([
          services.pharmacy.countOpenPharmacyOrders(),
          options ? services.pharmacy.getPharmacyQueue(options) : Promise.resolve(null),
        ]);
        if (!mounted) return;
        setPendingCount(count);
        if (nextOrders) setOrders(nextOrders);
        setError("");
        setLastUpdated(new Date());
      } catch (loadError) {
        if (mounted) setError(loadError instanceof Error ? loadError.message : "Unable to load the pharmacy queue.");
      }
    };
    loadRef.current = load;
    const scheduleLoad = () => { window.clearTimeout(debounce); debounce = window.setTimeout(() => void load(), RELOAD_DEBOUNCE_MS); };

    void load();
    const timer = window.setInterval(() => void load(), POLL_INTERVAL_MS);
    services.auth.getCurrentAuthContext()
      .then((context) => {
        if (!mounted || !context.clinic_id) return;
        unsubscribe = services.pharmacy.subscribeToPharmacyOrders(context.clinic_id, (change) => {
          scheduleLoad();
          if (notifyNewOrders && change.eventType === "INSERT" && change.order) {
            services.pharmacy.getPharmacyQueueItem(change.order.id)
              .then((order) => { if (mounted && order) toast.info(`New prescription from ${doctorLabel(order)}`, { description: order.patient?.full_name ?? undefined }); })
              .catch(() => undefined);
          }
        });
      })
      .catch(() => undefined);

    return () => {
      mounted = false;
      window.clearInterval(timer);
      window.clearTimeout(debounce);
      unsubscribe();
    };
  }, [enabled, optionsKey, notifyNewOrders]);

  const refresh = useCallback(() => loadRef.current(), []);
  return { pendingCount, orders, error, lastUpdated, refresh };
}
