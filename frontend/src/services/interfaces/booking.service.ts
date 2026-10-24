import type {
  AvailableDate,
  AvailableSlot,
  BookingDoctor,
  BookingService as BookingServiceOption,
  BookingStatusResult,
  ClinicBookingProfile,
  ClinicDirectoryEntry,
  PatientBookingInput,
  PaymentOption,
} from "../../modules/patient-booking/types";

export type { BookingServiceOption };

export type CreatePublicBookingInput = {
  clinicSlug: string;
  slotId: string;
  serviceId?: string;
  patient: PatientBookingInput;
  paymentOption: PaymentOption;
  source?: "website" | "qr" | "whatsapp";
};

export type PublicBookingResult = BookingStatusResult & {
  clinicSlug: string;
  serviceName: string;
  appointmentDate: string;
  appointmentTime: string;
};

/**
 * Patient-facing booking API. Every call goes through a security-definer RPC so
 * that it also works for an anonymous visitor on /book/:clinicSlug.
 */
export interface PublicBookingService {
  getPublishedClinics(): Promise<ClinicDirectoryEntry[]>;
  getClinicProfile(clinicSlug: string): Promise<ClinicBookingProfile>;
  getDoctors(clinicSlug: string): Promise<BookingDoctor[]>;
  getServices(clinicSlug: string): Promise<BookingServiceOption[]>;
  getAvailableDates(doctorId: string, days?: number): Promise<AvailableDate[]>;
  getAvailableSlots(doctorId: string, date: string): Promise<AvailableSlot[]>;
  createBooking(input: CreatePublicBookingInput): Promise<PublicBookingResult>;
  getBookingStatus(phone: string, reference: string): Promise<BookingStatusResult | null>;
}
