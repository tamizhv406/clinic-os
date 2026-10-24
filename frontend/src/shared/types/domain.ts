import type { UserRole } from "../../types/user";

export type ModuleKey = "dashboard" | "appointments" | "whatsapp" | "patients" | "consultation" | "prescriptions" | "pharmacy" | "billing" | "reports" | "staff" | "settings" | "subscription" | "support" | "delivery" | "availability" | "reminders" | "follow_ups";
export type PermissionKey = "view" | "create" | "edit" | "assign" | "approve" | "cancel" | "delete" | "bill" | "dispense" | "export" | "manage" | "configure";
export type EntityStatus = "active" | "inactive" | "pending" | "failed" | "suspended" | "trial" | "expired";
export type AppointmentStatus = "booked" | "arrived" | "waiting" | "in_consultation" | "completed" | "cancelled" | "no_show";
export type PaymentStatus = "paid" | "pending" | "partial" | "refunded" | "cancelled";
export type DeliveryStatus = "queued" | "sent" | "delivered" | "read" | "failed";
export type ReminderStatus = "active" | "paused" | "completed" | "cancelled";
export type StockStatus = "in_stock" | "low_stock" | "out_of_stock" | "expiring_soon" | "expired";

export interface ServiceError { code: string; message: string; fieldErrors?: Record<string, string>; }
export interface PaginatedResponse<T> { data: T[]; page: number; pageSize: number; total: number; totalPages: number; }

export interface ClinicRecord { id: string; name: string; slug: string; planId: string; status: EntityStatus; ownerUserId: string; enabledModules: ModuleKey[]; address: string; phone: string; city: string; state: string; gstin?: string; settings: Record<string, unknown>; }
export interface BranchRecord { id: string; clinicId: string; name: string; address: string; phone: string; isPrimary: boolean; }
export interface RoleRecord { id: UserRole; label: string; defaultModules: ModuleKey[]; defaultPermissions: PermissionKey[]; }
export interface UserRecord { id: string; userId: string; fullName: string; email: string; phone: string; role: UserRole; clinicId?: string; branchIds: string[]; modules: ModuleKey[]; permissions: PermissionKey[]; status: EntityStatus; }
export interface PatientRecord { id: string; patientId: string; clinicId: string; branchId: string; fullName: string; phone: string; whatsappNumber: string; age: number; gender: "female" | "male" | "other"; source: "whatsapp" | "qr" | "website" | "phone" | "walk_in" | "reception"; allergies: string[]; medicalHistory: string[]; currentMedications: string[]; whatsappConsent: boolean; reminderConsent: boolean; }
export interface AppointmentRecord { id: string; clinicId: string; branchId: string; patientId: string; doctorId: string; tokenNumber: string; date: string; time: string; department: string; reason: string; source: PatientRecord["source"]; status: AppointmentStatus; paymentStatus: PaymentStatus; }
export interface DoctorAvailabilityRecord { id: string; clinicId: string; doctorId: string; branchId: string; weekday: string; startTime: string; endTime: string; breakStart: string | null; breakEnd: string | null; isActive: boolean; slotDurationMinutes: number; blockedDates: string[]; }
export interface ConsultationRecord { id: string; appointmentId: string; patientId: string; doctorId: string; symptoms: string; vitals: Record<string, string>; diagnosis: string; notes: string; status: "draft" | "completed"; }
export interface PrescriptionRecord { id: string; consultationId: string; patientId: string; doctorId: string; status: "draft" | "sent_to_whatsapp" | "sent_to_pharmacy" | "completed"; deliveryStatus: DeliveryStatus; items: PrescriptionItemRecord[]; followUpDate?: string; }
export interface PrescriptionItemRecord { id: string; prescriptionId: string; medicineId: string; medicineName: string; dosage: string; frequency: string; timing: string; duration: string; beforeAfterFood: "before_food" | "after_food"; }
export interface MedicineRecord { id: string; name: string; category: string; form: string; manufacturer: string; }
export interface InventoryRecord { id: string; medicineId: string; branchId: string; batchNumber: string; quantity: number; reorderLevel: number; expiryDate: string; status: StockStatus; }
export interface PharmacyOrderRecord { id: string; prescriptionId: string; patientId: string; branchId: string; status: "received" | "preparing" | "ready" | "dispensed" | "cancelled"; paymentStatus: PaymentStatus; unavailableItems: string[]; }
export interface InvoiceRecord { id: string; clinicId: string; branchId: string; patientId: string; appointmentId?: string; amount: number; paidAmount: number; status: PaymentStatus; createdAt: string; }
export interface PaymentRecord { id: string; invoiceId: string; amount: number; mode: "cash" | "upi" | "card" | "online_link"; status: PaymentStatus; paidAt: string; }
export interface WhatsAppConversationRecord { id: string; clinicId: string; patientId?: string; phone: string; status: "new" | "in_progress" | "appointment_confirmed" | "transferred_to_reception" | "closed" | "failed"; linkedAppointmentId?: string; lastMessage: string; }
export interface ReminderRecord { id: string; patientId: string; prescriptionItemId?: string; type: "medicine" | "follow_up" | "appointment"; status: ReminderStatus; deliveryStatus: DeliveryStatus; nextRunAt: string; }
export interface SupportTicketRecord { id: string; clinicId: string; branchId?: string; createdByUserId: string; category: "technical" | "billing" | "whatsapp" | "pharmacy"; priority: "low" | "medium" | "high"; status: "open" | "in_progress" | "resolved"; subject: string; description?: string; createdAt?: string; }
export interface ReportRecord { id: string; clinicId: string; metric: string; value: number; period: string; }
