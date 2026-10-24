import type { ExpiryStatus, PaymentMode, PaymentStatus, PrescriptionStatus, StockStatus } from "./types";

export const rupee = (n: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);
export const stockLabel: Record<StockStatus, string> = { in_stock: "Stock Available", low_stock: "Low Stock", out_of_stock: "Out of Stock", expired: "Expired", expiring_soon: "Expiring Soon" };
export const rxStatusLabel: Record<PrescriptionStatus, string> = { pending: "Pending", billed: "Billed", partially_dispensed: "Partially dispensed", dispensed: "Dispensed", cancelled: "Cancelled" };
export const paymentLabel: Record<PaymentStatus, string> = { paid: "Paid", pending: "Pending", partial: "Partial" };
export const paymentModeLabel: Record<PaymentMode, string> = { cash: "Cash", upi: "UPI", card: "Card", online_link: "Online Link" };
export const daysRemaining = (date: string) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.ceil((new Date(date).getTime() - today.getTime()) / 86400000);
};
export const expiryLabel: Record<ExpiryStatus, string> = { safe: "Safe Stock", expiring_soon: "Expiring Soon", expired: "Expired" };
