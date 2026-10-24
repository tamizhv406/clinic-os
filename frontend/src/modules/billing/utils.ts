import type { BillType, PaymentMode, PaymentStatus, RefundStatus } from "./types";
export const rupee = (n: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);
export const paymentStatusLabel: Record<PaymentStatus, string> = { paid: "Paid", pending: "Pending", partial: "Partial", refunded: "Refunded", cancelled: "Cancelled" };
export const paymentModeLabel: Record<PaymentMode, string> = { cash: "Cash", upi: "UPI", card: "Card", online_link: "Online Link" };
export const billTypeLabel: Record<BillType, string> = { consultation: "Consultation", procedure: "Procedure / Service", pharmacy: "Pharmacy", package: "Package", other: "Other" };
export const refundStatusLabel: Record<RefundStatus, string> = { requested: "Requested", approved: "Approved", processed: "Processed", rejected: "Rejected" };
