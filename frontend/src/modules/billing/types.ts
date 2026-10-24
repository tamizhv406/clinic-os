export type BillType = "consultation" | "procedure" | "pharmacy" | "package" | "other";
export type PaymentMode = "cash" | "upi" | "card" | "online_link";
export type PaymentStatus = "paid" | "pending" | "partial" | "refunded" | "cancelled";
export type RefundStatus = "requested" | "approved" | "processed" | "rejected";
export type ReportDateFilter = "today" | "yesterday" | "last_7_days" | "this_month" | "custom";

export type BillingStats = { todayRevenue: number; consultationRevenue: number; pharmacyRevenue: number; pendingPayments: number; partialPayments: number; refunds: number; billsGenerated: number; onlinePaymentLinks: number };
export type BillItem = { id: string; name: string; category: string; quantity: number; unitPrice: number; discount: number; tax: number };
export type Invoice = { id: string; patientName: string; phone: string; doctorName?: string; billType: BillType; items: BillItem[]; subtotal: number; discount: number; tax: number; total: number; paidAmount: number; balance: number; paymentStatus: PaymentStatus; paymentMode: PaymentMode; date: string };
export type Receipt = { id: string; patientName: string; amountPaid: number; paymentMode: PaymentMode; linkedInvoice: string; dateTime: string; receiptType: BillType };
export type PendingPayment = { id: string; patientName: string; phone: string; invoiceNumber: string; totalAmount: number; paidAmount: number; balance: number; dueSince: string; lastReminder: string; paymentStatus: PaymentStatus };
export type Refund = { id: string; patientName: string; invoiceNumber: string; originalAmount: number; refundAmount: number; reason: string; status: RefundStatus; date: string };
export type RevenueReport = { totalRevenue: number; consultationRevenue: number; pharmacyRevenue: number; procedureRevenue: number; pendingAmount: number; refundAmount: number; trend: { date: string; revenue: number }[]; paymentModes: { mode: PaymentMode; amount: number }[]; topServices: { service: string; revenue: number; count: number }[] };
export type AppointmentReport = { total: number; completed: number; cancelled: number; noShow: number; whatsapp: number; qr: number; walkIns: number; phone: number };
export type DoctorPerformanceReport = { doctorName: string; consultations: number; revenue: number; averageTime: string; followUps: number; prescriptions: number };
export type PharmacySalesReport = { revenue: number; billsGenerated: number; topMedicines: { medicine: string; amount: number }[]; lowStockImpact: number; expiryLoss: number };
export type PatientReport = { newPatients: number; repeatPatients: number; vipPatients: number; followUpPatients: number; sourceSplit: { source: string; count: number }[] };
export type FollowUpReport = { dueToday: number; upcoming: number; overdue: number; completed: number; whatsappReminders: number };
