// Pure helpers for the Prescription Queue: FEFO batch choice, dispense
// validation and queue tabs. Mirrors the checks in dispense_pharmacy_order.

import type { PharmacyQueueItem } from "../../services/interfaces";
import type { Tables } from "../../shared/types/database.types";
import { byExpiryFefo, isUsable } from "./stockSummary";

type BatchRow = Tables<"medicine_stock_batches">;
type OrderItem = Tables<"pharmacy_order_items">;

export type QueueTab = "pending" | "partial" | "today" | "all";

/** Usable batches of one medicine, earliest expiry first (FEFO). */
export function usableBatches(medicineId: string | null, batches: BatchRow[], today: string) {
  if (!medicineId) return [];
  return batches.filter((batch) => batch.medicine_id === medicineId && isUsable(batch, today)).sort(byExpiryFefo);
}

export function totalUsable(medicineId: string | null, batches: BatchRow[], today: string) {
  return usableBatches(medicineId, batches, today).reduce((sum, batch) => sum + batch.quantity_available, 0);
}

/** FEFO default: earliest non-expired batch with enough stock, otherwise the earliest with any stock. */
export function defaultBatch(medicineId: string | null, needed: number, batches: BatchRow[], today: string) {
  const usable = usableBatches(medicineId, batches, today);
  return usable.find((batch) => batch.quantity_available >= needed) ?? usable[0] ?? null;
}

/**
 * Estimate of how create_pharmacy_counter_sale will take stock: FEFO across
 * usable batches, or only the chosen batch. The server does the real allocation.
 */
export function allocateFefo(medicineId: string, quantity: number, batches: BatchRow[], today: string, batchId?: string) {
  const candidates = usableBatches(medicineId, batches, today).filter((batch) => !batchId || batch.id === batchId);
  const lines: Array<{ batch: BatchRow; quantity: number }> = [];
  let need = Math.max(0, Math.floor(quantity));
  for (const batch of candidates) {
    if (need === 0) break;
    const take = Math.min(need, batch.quantity_available);
    lines.push({ batch, quantity: take });
    need -= take;
  }
  const amount = lines.reduce((sum, line) => sum + line.quantity * Number(line.batch.selling_price ?? 0), 0);
  return { lines, shortBy: need, amount: Math.round(amount * 100) / 100 };
}

export const remainingQuantity =(item: OrderItem) => Math.max((item.requested_quantity ?? 0) - (item.dispensed_quantity ?? 0), 0);
export const isSettled = (item: OrderItem) => item.status === "dispensed" || item.status === "cancelled" || remainingQuantity(item) === 0;

export type DispenseLine = { selected: boolean; batchId: string; quantity: string };

/** Error for one line, or "" when it can be dispensed. */
export function lineError(item: OrderItem, line: DispenseLine, batches: BatchRow[], today: string) {
  if (!line.selected) return "";
  const batch = batches.find((row) => row.id === line.batchId);
  if (!batch) return "Choose a batch";
  if (!isUsable(batch, today)) return "This batch cannot be dispensed (expired, blocked or empty)";
  if (item.medicine_id && batch.medicine_id !== item.medicine_id) return "This batch is a different medicine";
  const quantity = Number(line.quantity);
  if (!line.quantity.trim() || !Number.isInteger(quantity) || quantity <= 0) return "Enter a whole number greater than 0";
  const remaining = remainingQuantity(item);
  if (quantity > remaining) return `Only ${remaining} more can be dispensed`;
  if (quantity > batch.quantity_available) return `Batch ${batch.batch_no} has only ${batch.quantity_available}`;
  return "";
}

export function initialLines(order: PharmacyQueueItem, batches: BatchRow[], today: string): Record<string, DispenseLine> {
  const lines: Record<string, DispenseLine> = {};
  for (const item of order.items) {
    const remaining = remainingQuantity(item);
    const batch = isSettled(item) ? null : defaultBatch(item.medicine_id, remaining, batches, today);
    const quantity = batch ? Math.min(remaining, batch.quantity_available) : remaining;
    lines[item.id] = { selected: Boolean(batch) && item.status !== "unavailable", batchId: batch?.id ?? "", quantity: quantity > 0 ? String(quantity) : "" };
  }
  return lines;
}

export function matchesTab(order: PharmacyQueueItem, tab: QueueTab, todayStartISO: string) {
  if (tab === "pending") return order.status === "pending";
  if (tab === "partial") return order.status === "partially_dispensed";
  if (tab === "today") return order.status === "dispensed" && Boolean(order.dispensed_at) && new Date(order.dispensed_at!).getTime() >= new Date(todayStartISO).getTime();
  return true;
}

/** Changes whenever anything that should reset the dispense form changes. */
export const drawerKey = (order: PharmacyQueueItem | null) =>
  order ? `${order.id}:${order.updated_at}:${order.items.map((item) => `${item.id}-${item.dispensed_quantity}-${item.status}`).join(",")}` : "none";

/** Short, readable order number shown on cards and the slip. */
export const orderToken = (orderId: string) => `#${orderId.replace(/-/g, "").slice(0, 6).toUpperCase()}`;

export function timeSince(iso: string | null | undefined, now = Date.now()) {
  if (!iso) return "";
  const minutes = Math.max(0, Math.round((now - new Date(iso).getTime()) / 60_000));
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  return `${Math.round(hours / 24)} d ago`;
}

export function patientAge(patient: PharmacyQueueItem["patient"], today: string) {
  if (!patient) return null;
  if (patient.age !== null && patient.age !== undefined) return patient.age;
  if (!patient.date_of_birth) return null;
  const [y, m, d] = patient.date_of_birth.split("-").map(Number);
  const [ty, tm, td] = today.split("-").map(Number);
  return ty - y - (tm < m || (tm === m && td < d) ? 1 : 0);
}
