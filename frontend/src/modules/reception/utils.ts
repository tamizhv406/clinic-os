import type { AppointmentSource, AppointmentStatus, PaymentMode, PaymentStatus } from "./types";

export const appointmentStatusLabel: Record<AppointmentStatus, string> = {
  booked: "Booked",
  arrived: "Arrived",
  waiting: "Waiting",
  in_consultation: "In consultation",
  completed: "Completed",
  cancelled: "Cancelled",
  no_show: "No-show"
};

export const sourceLabel: Record<AppointmentSource, string> = {
  walk_in: "Walk-in",
  phone_call: "Phone call",
  qr_booking: "QR booking",
  whatsapp: "WhatsApp",
  website: "Website"
};

export const paymentLabel: Record<PaymentStatus, string> = { paid: "Paid", pending: "Pending", partial: "Partial" };
export const paymentModeLabel: Record<PaymentMode, string> = { cash: "Cash", upi: "UPI", card: "Card", online_link: "Online Link" };
export const ageGender = (age: number, gender: string) => `${age} yrs · ${gender[0].toUpperCase()}${gender.slice(1)}`;
export const rupee = (amount: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(amount);
