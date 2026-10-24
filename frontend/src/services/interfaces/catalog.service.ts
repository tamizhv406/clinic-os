import type { Tables, TablesInsert, TablesUpdate } from "../../shared/types/database.types";
import type { LabTest, PrescriptionTemplate } from "../../modules/doctor/types";
import type { Medicine as FavoriteMedicine } from "../../modules/doctor/types";
import type { PurchaseEntry, StockPurchaseFilters, StockPurchaseLine, StockPurchaseRecord, Supplier } from "../../modules/pharmacy/types";
import type { Refund } from "../../modules/billing/types";

export type ClinicServiceRow = Tables<"clinic_services">;

export type CreatePurchaseEntryInput = {
  supplierName: string;
  supplierPhone?: string;
  invoiceNumber: string;
  purchaseDate: string;
  notes?: string;
  /** Where the rows came from; recorded on the purchase. Defaults to "manual". */
  source?: "manual" | "excel";
  items: Array<{
    medicineName: string;
    batchNumber: string;
    expiryDate: string;
    quantity: number;
    purchasePrice: number;
    sellingPrice: number;
    mrp?: number;
    category?: string;
    /** Master fields, used only when the medicine is new or the field is still empty. */
    genericName?: string;
    manufacturer?: string;
    strength?: string;
    unit?: string;
    hsnCode?: string;
    gstRate?: number;
    reorderLevel?: number;
  }>;
};

/** What create_stock_purchase reports back after an atomic save. */
export type StockPurchaseSummary = {
  purchaseId: string;
  items: number;
  medicinesCreated: number;
  batchesCreated: number;
  batchesToppedUp: number;
  totalAmount: number;
};

export type CreateRefundInput = {
  invoiceId: string;
  refundAmount: number;
  reason: string;
  refundMode?: string;
};

/**
 * Clinic-level reference data that the UI used to read from local mock files:
 * bookable services, prescription templates, lab tests, doctor favourites,
 * pharmacy purchase history and billing refunds.
 */
export interface CatalogService {
  getClinicServices(clinicId?: string): Promise<ClinicServiceRow[]>;
  createClinicService(input: TablesInsert<"clinic_services">): Promise<ClinicServiceRow>;
  updateClinicService(id: string, input: TablesUpdate<"clinic_services">): Promise<ClinicServiceRow>;

  getPrescriptionTemplates(doctorId?: string): Promise<PrescriptionTemplate[]>;
  getLabTests(): Promise<LabTest[]>;
  getFavoriteMedicines(doctorId?: string): Promise<FavoriteMedicine[]>;
  recordMedicineUsage(doctorId: string, medicineNames: string[]): Promise<void>;

  getPurchaseEntries(): Promise<PurchaseEntry[]>;
  /** Saves the whole purchase in one database transaction (create_stock_purchase). */
  createPurchaseEntry(input: CreatePurchaseEntryInput): Promise<StockPurchaseSummary>;
  /** Distinct suppliers from previous purchases, most recent first. */
  getSuppliers(): Promise<Supplier[]>;
  /** Purchase history, newest first (at most 500 rows). */
  getStockPurchases(filters?: StockPurchaseFilters): Promise<StockPurchaseRecord[]>;
  /** What one purchase received: its add_stock movements, or its batches for legacy purchases. */
  getStockPurchaseLines(purchaseId: string): Promise<StockPurchaseLine[]>;

  getRefunds(): Promise<Refund[]>;
  createRefund(input: CreateRefundInput): Promise<Refund>;
  updateRefundStatus(id: string, status: Refund["status"]): Promise<Refund>;
}
