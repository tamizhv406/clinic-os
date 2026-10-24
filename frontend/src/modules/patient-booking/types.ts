export type SlotStatus = "available" | "limited" | "booked";
export type BookingStep = "doctor" | "service" | "slot" | "patient" | "confirm";
export type PaymentOption = "pay_at_clinic" | "pay_online";
export type BookingStatus = "confirmed" | "pending" | "cancelled" | "completed";

export type ClinicBookingProfile = { id: string; slug: string; name: string; specialization: string; address: string; phone: string; whatsapp: string; hours: string; mapUrl: string; bookingUrl: string };
export type ClinicDirectoryEntry = { id: string; slug: string; name: string; specialization: string; address: string; phone: string; logoUrl: string };
export type BookingDoctor = { id: string; name: string; specialization: string; experience: number; qualification: string; availableToday: boolean; consultationFee: number };
export type BookingService = { id: string; name: string; duration: string; price: number; description: string };
export type AvailableDate = { id: string; label: string; date: string; available: boolean };
export type AvailableSlot = { id: string; label: string; period: "morning" | "afternoon" | "evening"; status: SlotStatus };
export type PatientBookingInput = { fullName: string; phone: string; age: number; gender: "female" | "male" | "other" | ""; reason: string; existingPatient: boolean; patientId?: string; notes?: string };
export type BookingSummary = { clinic: ClinicBookingProfile; doctor: BookingDoctor; service: BookingService; date: AvailableDate; slot: AvailableSlot; patient: PatientBookingInput; paymentOption: PaymentOption; token: string; bookingId: string };
export type BookingStatusResult = { bookingId: string; token: string; status: BookingStatus; clinicName: string; doctorName: string; patientName: string; dateTime: string };
