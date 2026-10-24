import type { PharmacyQueueItem } from "../../services/interfaces";
import type { Tables } from "../../shared/types/database.types";
import { localDateISO } from "../../utils/formatDate";
import type { ExpiryStatus, Medicine, MedicineCategory, PrescriptionQueueItem, StockStatus } from "./types";

type MedicineRow = Tables<"medicines">;
type BatchRow = Tables<"medicine_stock_batches">;

export function toMedicineRows(medicines: MedicineRow[], batches: BatchRow[]): Medicine[] {
  const today = localDateISO();
  return medicines.flatMap((medicine) => {
    const medicineBatches = batches.filter((batch) => batch.medicine_id === medicine.id);
    if (medicineBatches.length === 0) {
      return [toMedicine(medicine, null, today)];
    }
    return medicineBatches.map((batch) => toMedicine(medicine, batch, today));
  });
}

export function toPrescriptionQueueItem(order: PharmacyQueueItem): PrescriptionQueueItem {
  const patientName = order.patient?.full_name ?? "Patient";
  const phone = order.patient?.phone ?? "";
  const doctorName = order.doctor?.staff_profiles?.full_name ?? "Doctor";
  return {
    id: order.id,
    token: order.prescription?.id.slice(0, 8).toUpperCase() ?? order.id.slice(0, 8).toUpperCase(),
    patientName,
    phone,
    doctorName,
    diagnosis: order.prescription?.diagnosis_summary ?? "Prescription",
    prescriptionTime: order.created_at?.slice(11, 16) ?? "",
    status: order.status === "dispensed" ? "dispensed" : order.status === "partially_dispensed" ? "partially_dispensed" : order.status === "cancelled" ? "cancelled" : "pending",
    paymentStatus: "pending",
    medicines: order.items.map((item) => ({
      medicineName: item.medicine_name,
      dosage: "",
      frequency: "",
      timing: "",
      duration: "",
      instructions: item.notes ?? undefined,
      availability: item.status === "unavailable" ? "out_of_stock" : item.status === "dispensed" ? "in_stock" : "low_stock",
    })),
  };
}

function toMedicine(medicine: MedicineRow, batch: BatchRow | null, today: string): Medicine {
  const currentStock = batch?.quantity_available ?? 0;
  const reorderLevel = medicine.reorder_level ?? 0;
  const expiryStatus = getExpiryStatus(batch?.expiry_date ?? null, today);
  return {
    id: batch?.id ?? medicine.id,
    name: medicine.name,
    genericName: medicine.generic_name ?? "",
    category: normalizeCategory(medicine.category),
    batchNumber: batch?.batch_no ?? "",
    expiryDate: batch?.expiry_date ?? "",
    currentStock,
    reorderLevel,
    purchasePrice: batch?.purchase_price ?? 0,
    sellingPrice: batch?.selling_price ?? 0,
    mrp: batch?.mrp ?? 0,
    supplier: batch?.supplier_name ?? "",
    gst: medicine.gst_rate ?? 0,
    notes: typeof medicine.metadata === "object" && medicine.metadata && !Array.isArray(medicine.metadata) ? String(medicine.metadata.notes ?? "") : "",
    stockStatus: getStockStatus(currentStock, reorderLevel, expiryStatus),
    expiryStatus,
    lastPurchaseDate: batch?.created_at?.slice(0, 10) ?? "",
  };
}

function normalizeCategory(value: string | null): MedicineCategory {
  const allowed: MedicineCategory[] = ["general", "antibiotic", "dental", "skin", "pediatric", "physiotherapy", "supplement"];
  return allowed.includes(value as MedicineCategory) ? value as MedicineCategory : "general";
}

function getExpiryStatus(expiryDate: string | null, today: string): ExpiryStatus {
  if (!expiryDate) return "safe";
  if (expiryDate < today) return "expired";
  const expiry = new Date(`${expiryDate}T00:00:00Z`);
  const now = new Date(`${today}T00:00:00Z`);
  const days = (expiry.getTime() - now.getTime()) / 86400000;
  return days <= 45 ? "expiring_soon" : "safe";
}

function getStockStatus(currentStock: number, reorderLevel: number, expiryStatus: ExpiryStatus): StockStatus {
  if (expiryStatus === "expired") return "expired";
  if (currentStock <= 0) return "out_of_stock";
  if (expiryStatus === "expiring_soon") return "expiring_soon";
  if (currentStock <= reorderLevel) return "low_stock";
  return "in_stock";
}
