import type { InventoryRecord, MedicineRecord, PharmacyOrderRecord } from "../../shared/types/domain";
import type { Tables, TablesInsert, TablesUpdate } from "../../shared/types/database.types";
import type { PharmacyBill, StockMovementRecord } from "../../modules/pharmacy/types";

export type MedicineFilters = {
  clinicId?: string;
  branchId?: string;
  query?: string;
  status?: string;
};

export type PharmacyQueueItem = Tables<"pharmacy_orders"> & {
  items: Tables<"pharmacy_order_items">[];
  prescription?: (Tables<"prescriptions"> & { prescription_items?: Tables<"prescription_items">[] | null }) | null;
  patient?: Tables<"patients"> | null;
  doctor?: (Tables<"doctor_profiles"> & { staff_profiles?: Pick<Tables<"staff_profiles">, "full_name"> | null }) | null;
};

export type PharmacyOrderChange = {
  eventType: "INSERT" | "UPDATE" | "DELETE";
  /** The row after the change; null for deletes. */
  order: Tables<"pharmacy_orders"> | null;
};

export type PharmacyQueueOptions = {
  /** Only these order statuses (default: all). */
  statuses?: string[];
  /** Only orders created on/after this ISO timestamp. */
  createdSince?: string;
  /** Only orders dispensed on/after this ISO timestamp. */
  dispensedSince?: string;
  limit?: number;
};

export type CounterSaleInput = {
  patientId: string;
  paymentMode: "cash" | "upi" | "card" | "online_link";
  /** Bill-level discount in rupees. */
  discountAmount?: number;
  /** Defaults to the full total on the server. */
  paidAmount?: number;
  notes?: string;
  /** batchId is optional; without it the server picks batches FEFO. Prices always come from the batches. */
  items: Array<{ medicineId: string; quantity: number; batchId?: string }>;
};
export type CounterSaleResult = { invoiceId: string; invoiceNumber: string; subtotal: number; discountAmount: number; totalAmount: number; paidAmount: number; paymentStatus: string };

/** What a doctor sees next to a medicine suggestion. */
export type MedicineAvailability = { id: string; name: string; availableUnits: number };

export type DispenseOrderInput = {
  orderId: string;
  items: Array<{ orderItemId: string; batchId: string; quantity: number }>;
};

export interface PharmacyDomainService {
  getMedicines(filters?: MedicineFilters): Promise<MedicineRecord[]>;
  getMedicineById(id: string): Promise<Tables<"medicines"> | null>;
  /** Full medicine rows in one query (replaces one getMedicineById call per medicine). */
  getMedicineCatalog(options?: { status?: string }): Promise<Tables<"medicines">[]>;
  createMedicine(input: TablesInsert<"medicines">): Promise<Tables<"medicines">>;
  updateMedicine(id: string, input: TablesUpdate<"medicines">): Promise<Tables<"medicines">>;
  getStockBatches(medicineId?: string): Promise<Tables<"medicine_stock_batches">[]>;
  addStockBatch(input: TablesInsert<"medicine_stock_batches">): Promise<Tables<"medicine_stock_batches">>;
  adjustStock(input: { batchId: string; movementType: string; quantity: number; reason?: string; referenceType?: string; referenceId?: string }): Promise<Tables<"medicine_stock_batches">>;
  getPharmacyQueue(options?: PharmacyQueueOptions): Promise<PharmacyQueueItem[]>;
  getPharmacyQueueItem(orderId: string): Promise<PharmacyQueueItem | null>;
  /** Pharmacist opened the order: the doctor's prescription shows "Received". */
  acknowledgeOrder(orderId: string): Promise<void>;
  markOrderItemUnavailable(orderItemId: string, reason?: string): Promise<void>;
  /**
   * Manual fallback: creates orders for prescriptions sent to pharmacy that have
   * none (the database normally does this itself). Returns how many were created.
   */
  syncRoutedPrescriptions(): Promise<number>;
  /** Usable stock per active medicine (active, unexpired batches), for prescribing. */
  getMedicineAvailability(): Promise<MedicineAvailability[]>;
  /** Orders still waiting at the counter: status pending or partially_dispensed. */
  countOpenPharmacyOrders(): Promise<number>;
  /** Live pharmacy_orders changes for one clinic. Returns the unsubscribe function. */
  subscribeToPharmacyOrders(clinicId: string, onChange: (change: PharmacyOrderChange) => void): () => void;
  createOrderFromPrescription(prescriptionId: string): Promise<Tables<"pharmacy_orders">>;
  dispenseOrder(input: DispenseOrderInput): Promise<Tables<"pharmacy_orders">>;
  getLowStockAlerts(): Promise<Tables<"low_stock_alerts">[]>;
  refreshLowStockAlerts(clinicId?: string, branchId?: string): Promise<number>;
  getStockMovements(medicineId?: string): Promise<Tables<"stock_movements">[]>;
  /** Movement history for one medicine, newest first, with batch number and staff name. */
  getMedicineMovements(medicineId: string, limit?: number): Promise<StockMovementRecord[]>;
  /** Block (recall / quality hold) or unblock a batch via set_medicine_batch_status. */
  setBatchStatus(batchId: string, action: "block" | "unblock", reason?: string): Promise<Tables<"medicine_stock_batches">>;
  getInventory(branchId?: string): Promise<InventoryRecord[]>;
  getPharmacyOrders(branchId?: string): Promise<PharmacyOrderRecord[]>;
  /**
   * Pharmacy bills (invoices of type "pharmacy", not cancelled) with their line
   * items. A YYYY-MM-DD dateFrom means the start of that day in IST.
   */
  getPharmacyBills(dateFrom?: string, limit?: number): Promise<PharmacyBill[]>;
  /** Atomic counter sale (create_pharmacy_counter_sale): server prices, FEFO stock, invoice + payment + movements. */
  createCounterSale(input: CounterSaleInput): Promise<CounterSaleResult>;
  /** Latest stock movements across all medicines, with medicine name, batch and staff. */
  getRecentMovements(options?: { limit?: number; movementType?: string; since?: string }): Promise<Array<StockMovementRecord & { medicineId: string; medicineName: string }>>;
}
