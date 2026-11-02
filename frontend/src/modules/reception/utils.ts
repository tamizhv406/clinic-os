import type { AppointmentSource, AppointmentStatus, PaymentMode, PaymentStatus } from "./types";
import { shortStatusLabels } from "../../shared/utils/appointmentStatus";

export const appointmentStatusLabel: Record<AppointmentStatus, string> = shortStatusLabels;

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

/**
 * Which front-desk actions make sense for an appointment in a given status. Doctors drive
 * everything after the patient is in the queue, so reception cannot send a patient
 * backwards (for example resetting someone who is already with the doctor).
 */
export function receptionActions(status: string) {
  return {
    canCheckIn: status === "booked",
    canQueue: status === "booked" || status === "arrived",
    canChange: status === "booked" || status === "arrived",
  };
}
