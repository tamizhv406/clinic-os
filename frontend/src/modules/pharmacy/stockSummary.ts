// Per-medicine stock roll-up for Medicine Stock (one row per medicine, batches
// underneath). Pure functions: no React, no Supabase.
//
// "Usable" matches dispense_pharmacy_order: an 'active' batch with stock whose
// expiry date is today or later (the RPC refuses expiry_date < today).

import type { Tables } from "../../shared/types/database.types";
import { daysBetweenISO } from "../../utils/formatDate";

type MedicineRow = Tables<"medicines">;
type BatchRow = Tables<"medicine_stock_batches">;

export type MedicineStockStatus = "in_stock" | "low" | "out" | "expired";
export const medicineStockStatusLabel: Record<MedicineStockStatus, string> = { in_stock: "In stock", low: "Low", out: "Out", expired: "Expired" };

export type MedicineStockSummary = {
  medicine: MedicineRow;
  /** All batches, earliest expiry first (FEFO), undated batches last. */
  batches: BatchRow[];
  availableUnits: number;
  expiredUnits: number;
  blockedUnits: number;
  nearestExpiry: string | null;
  daysToNearestExpiry: number | null;
  batchesWithStock: number;
  /** Selling price of the batch that would be sold next (FEFO), else the latest batch. */
  sellingPrice: number | null;
  status: MedicineStockStatus;
};

export const isExpired = (batch: Pick<BatchRow, "expiry_date">, today: string) => Boolean(batch.expiry_date && batch.expiry_date < today);
export const isUsable = (batch: BatchRow, today: string) => (batch.status ?? "active") === "active" && batch.quantity_available > 0 && !isExpired(batch, today);

export const byExpiryFefo = (a: BatchRow, b: BatchRow) => {
  if (a.expiry_date === b.expiry_date) return (a.created_at ?? "").localeCompare(b.created_at ?? "");
  if (!a.expiry_date) return 1;
  if (!b.expiry_date) return -1;
  return a.expiry_date.localeCompare(b.expiry_date);
};

export function summarizeStock(medicines: MedicineRow[], batches: BatchRow[], today: string): MedicineStockSummary[] {
  const byMedicine = new Map<string, BatchRow[]>();
  for (const batch of batches) {
    const list = byMedicine.get(batch.medicine_id);
    if (list) list.push(batch); else byMedicine.set(batch.medicine_id, [batch]);
  }
  return medicines.map((medicine) => {
    const list = (byMedicine.get(medicine.id) ?? []).slice().sort(byExpiryFefo);
    const usable = list.filter((batch) => isUsable(batch, today));
    const availableUnits = usable.reduce((sum, batch) => sum + batch.quantity_available, 0);
    const expiredUnits = list.filter((batch) => isExpired(batch, today) && batch.quantity_available > 0).reduce((sum, batch) => sum + batch.quantity_available, 0);
    const blockedUnits = list.filter((batch) => batch.status === "blocked").reduce((sum, batch) => sum + batch.quantity_available, 0);
    const nearest = usable.find((batch) => batch.expiry_date)?.expiry_date ?? null;
    const latest = list.slice().sort((a, b) => (b.created_at ?? "").localeCompare(a.created_at ?? ""))[0];
    const priced = usable[0] ?? latest;
    const reorder = medicine.reorder_level ?? 0;
    const status: MedicineStockStatus = availableUnits === 0 ? (expiredUnits > 0 ? "expired" : "out") : availableUnits <= reorder ? "low" : "in_stock";
    return {
      medicine,
      batches: list,
      availableUnits,
      expiredUnits,
      blockedUnits,
      nearestExpiry: nearest,
      daysToNearestExpiry: nearest ? daysBetweenISO(today, nearest) : null,
      batchesWithStock: list.filter((batch) => batch.quantity_available > 0).length,
      sellingPrice: priced?.selling_price ?? null,
      status,
    };
  });
}

export type StockFilters = { query: string; category: string; status: MedicineStockStatus | "all"; expiringWithin: 0 | 30 | 60 | 90 };
export type StockSort = "name" | "stock_asc" | "stock_desc" | "expiry";

export function filterSummaries(list: MedicineStockSummary[], filters: StockFilters) {
  const query = filters.query.trim().toLowerCase();
  return list.filter((item) => {
    if (filters.category !== "all" && (item.medicine.category ?? "general") !== filters.category) return false;
    if (filters.status !== "all" && item.status !== filters.status) return false;
    if (filters.expiringWithin > 0 && (item.daysToNearestExpiry === null || item.daysToNearestExpiry > filters.expiringWithin)) return false;
    if (!query) return true;
    const haystack = [
      item.medicine.name, item.medicine.generic_name, item.medicine.manufacturer,
      ...item.batches.flatMap((batch) => [batch.batch_no, batch.supplier_name]),
    ].filter(Boolean).join(" ").toLowerCase();
    return haystack.includes(query);
  });
}

export function sortSummaries(list: MedicineStockSummary[], sort: StockSort) {
  const byName = (a: MedicineStockSummary, b: MedicineStockSummary) => a.medicine.name.localeCompare(b.medicine.name);
  const sorted = list.slice();
  if (sort === "name") sorted.sort(byName);
  if (sort === "stock_asc") sorted.sort((a, b) => a.availableUnits - b.availableUnits || byName(a, b));
  if (sort === "stock_desc") sorted.sort((a, b) => b.availableUnits - a.availableUnits || byName(a, b));
  if (sort === "expiry") sorted.sort((a, b) => (a.nearestExpiry ?? "9999").localeCompare(b.nearestExpiry ?? "9999") || byName(a, b));
  return sorted;
}

export function stockCsvRows(list: MedicineStockSummary[]) {
  return [
    ["Medicine", "Generic", "Strength", "Category", "Available units", "Expired units", "Nearest expiry", "Batches with stock", "Selling price", "Reorder level", "Status"],
    ...list.map((item) => [
      item.medicine.name, item.medicine.generic_name ?? "", item.medicine.strength ?? "", item.medicine.category ?? "",
      item.availableUnits, item.expiredUnits, item.nearestExpiry ?? "", item.batchesWithStock,
      item.sellingPrice === null ? "" : Number(item.sellingPrice).toFixed(2), item.medicine.reorder_level ?? 0, medicineStockStatusLabel[item.status],
    ]),
  ];
}
