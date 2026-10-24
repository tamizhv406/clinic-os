import type { PaymentOption, SlotStatus } from "./types";
export const rupee = (amount: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(amount);
export const slotTone: Record<SlotStatus, string> = { available: "border-emerald-200 bg-emerald-50 text-emerald-700", limited: "border-amber-200 bg-amber-50 text-amber-700", booked: "border-slate-200 bg-slate-100 text-slate-400" };
export const paymentLabel: Record<PaymentOption, string> = { pay_at_clinic: "Pay at clinic", pay_online: "Pay online placeholder" };
