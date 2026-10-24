export type PrescriptionStatus = "pending" | "billed" | "partially_dispensed" | "dispensed" | "cancelled";
export type StockStatus = "in_stock" | "low_stock" | "out_of_stock" | "expired" | "expiring_soon";
export type ExpiryStatus = "safe" | "expiring_soon" | "expired";
export type MedicineCategory = "general" | "antibiotic" | "dental" | "skin" | "pediatric" | "physiotherapy" | "supplement";
export type StockAdjustmentType = "add_stock" | "remove_stock" | "damage" | "expired" | "correction";
export type PaymentMode = "cash" | "upi" | "card" | "online_link";
export type PaymentStatus = "paid" | "pending" | "partial";

export type PharmacyStats = { pendingPrescriptions: number; todaySales: number; lowStock: number; expiringSoon: number; outOfStock: number; billsToday: number };
export type Supplier = { id: string; name: string; phone: string };
export type Medicine = { id: string; name: string; genericName: string; category: MedicineCategory; batchNumber: string; expiryDate: string; currentStock: number; reorderLevel: number; purchasePrice: number; sellingPrice: number; mrp: number; supplier: string; gst?: number; notes?: string; stockStatus: StockStatus; expiryStatus: ExpiryStatus; lastPurchaseDate: string };
export type MedicineBatch = Pick<Medicine, "batchNumber" | "expiryDate" | "currentStock" | "purchasePrice" | "sellingPrice" | "mrp">;
export type PrescriptionMedicine = { medicineName: string; dosage: string; frequency: string; timing: string; duration: string; instructions?: string; availability: StockStatus };
export type PrescriptionQueueItem = { id: string; token: string; patientName: string; phone: string; doctorName: string; diagnosis: string; prescriptionTime: string; status: PrescriptionStatus; paymentStatus: PaymentStatus; medicines: PrescriptionMedicine[] };
export type PharmacyBillItem = { medicineName: string; quantity: number; unitPrice: number; discount: number };
export type PharmacyBill = { id: string; patientName: string; doctorName: string; prescriptionId?: string; items: PharmacyBillItem[]; subtotal: number; discount: number; total: number; paymentMode: PaymentMode; paymentStatus: PaymentStatus; createdAt: string };
export type PurchaseEntryItem = { medicineName: string; batchNumber: string; expiryDate: string; quantity: number; purchasePrice: number; sellingPrice: number; mrp: number };
export type PurchaseEntry = { id: string; supplierName: string; invoiceNumber: string; purchaseDate: string; items: PurchaseEntryItem[]; totalAmount: number; status: "draft" | "saved" };
export type StockAdjustment = { medicineId: string; type: StockAdjustmentType; quantity: number; reason: string; notes?: string };

/** "legacy" = recorded before create_stock_purchase existed (no source stored). */
export type StockPurchaseSource = "manual" | "excel" | "legacy";
export type StockPurchaseRecord = { id: string; purchaseDate: string; supplierName: string; supplierPhone: string; invoiceNumber: string; itemCount: number; totalAmount: number; source: StockPurchaseSource; status: string; notes: string; createdAt: string };
/** One received line of a purchase. quantityReceived is null for legacy purchases that have no stock movement rows. */
export type StockPurchaseLine = { batchId: string | null; medicineName: string; batchNumber: string; expiryDate: string; quantityReceived: number | null; currentQuantity: number; purchasePrice: number; sellingPrice: number; mrp: number; batchStatus: string };
export type StockPurchaseFilters = { from?: string; to?: string; supplier?: string };
export type StockMovementRecord = { id: string; movementType: string; quantity: number; direction: "in" | "out"; reason: string; batchNumber: string; by: string; at: string; referenceType: string };
