import { supabase } from "../../lib/supabaseClient";
import type { Json } from "../../shared/types/database.types";
import type {
  AvailableDate,
  AvailableSlot,
  BookingDoctor,
  BookingService,
  BookingStatusResult,
  ClinicBookingProfile,
  ClinicDirectoryEntry,
} from "../../modules/patient-booking/types";
import type { CreatePublicBookingInput, PublicBookingResult, PublicBookingService } from "../interfaces";

type Row = Record<string, unknown>;

function asObject(value: Json | null): Row | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Row) : null;
}

function asArray(value: Json | null): Row[] {
  return Array.isArray(value) ? (value as Row[]) : [];
}

const text = (row: Row, key: string, fallback = "") => {
  const value = row[key];
  return typeof value === "string" ? value : value == null ? fallback : String(value);
};

const num = (row: Row, key: string, fallback = 0) => {
  const value = Number(row[key]);
  return Number.isFinite(value) ? value : fallback;
};

const bool = (row: Row, key: string) => row[key] === true;

type PublicBookingRpc =
  | "public_published_clinics"
  | "public_clinic_booking_profile"
  | "public_clinic_doctors"
  | "public_clinic_services"
  | "public_doctor_available_dates"
  | "public_doctor_available_slots"
  | "public_create_booking"
  | "public_booking_status";

/** All public booking RPCs return a single jsonb payload, so one helper covers them. */
async function callRpc(name: PublicBookingRpc, args: Record<string, unknown>): Promise<Json | null> {
  const { data, error } = await supabase.rpc(name as never, args as never);
  if (error) throw error;
  return (data ?? null) as Json | null;
}

export const supabaseBookingService: PublicBookingService = {
  async getPublishedClinics() {
    return asArray(await callRpc("public_published_clinics", {})).map((row): ClinicDirectoryEntry => ({
      id: text(row, "id"),
      slug: text(row, "slug"),
      name: text(row, "name"),
      specialization: text(row, "specialization"),
      address: text(row, "address"),
      phone: text(row, "phone"),
      logoUrl: text(row, "logoUrl"),
    }));
  },

  async getClinicProfile(clinicSlug) {
    const row = asObject(await callRpc("public_clinic_booking_profile", { clinic_slug: clinicSlug }));
    if (!row) throw new Error(`No clinic is published at /book/${clinicSlug}.`);
    const profile: ClinicBookingProfile = {
      id: text(row, "id"),
      slug: text(row, "slug", clinicSlug),
      name: text(row, "name"),
      specialization: text(row, "specialization"),
      address: text(row, "address"),
      phone: text(row, "phone"),
      whatsapp: text(row, "whatsapp"),
      hours: text(row, "hours"),
      mapUrl: text(row, "mapUrl", "#"),
      bookingUrl: text(row, "bookingUrl"),
    };
    return profile;
  },

  async getDoctors(clinicSlug) {
    return asArray(await callRpc("public_clinic_doctors", { clinic_slug: clinicSlug })).map((row): BookingDoctor => ({
      id: text(row, "id"),
      name: text(row, "name"),
      specialization: text(row, "specialization"),
      experience: num(row, "experience"),
      qualification: text(row, "qualification"),
      availableToday: bool(row, "availableToday"),
      consultationFee: num(row, "consultationFee"),
    }));
  },

  async getServices(clinicSlug) {
    return asArray(await callRpc("public_clinic_services", { clinic_slug: clinicSlug })).map((row): BookingService => ({
      id: text(row, "id"),
      name: text(row, "name"),
      duration: text(row, "duration"),
      price: num(row, "price"),
      description: text(row, "description"),
    }));
  },

  async getAvailableDates(doctorId, days = 14) {
    return asArray(await callRpc("public_doctor_available_dates", { p_doctor_id: doctorId, p_days: days })).map((row): AvailableDate => ({
      id: text(row, "id"),
      label: text(row, "label"),
      date: text(row, "date"),
      available: bool(row, "available"),
    }));
  },

  async getAvailableSlots(doctorId, date) {
    return asArray(await callRpc("public_doctor_available_slots", { p_doctor_id: doctorId, p_date: date })).map((row): AvailableSlot => ({
      id: text(row, "id"),
      label: text(row, "label"),
      period: (["morning", "afternoon", "evening"].includes(text(row, "period")) ? text(row, "period") : "morning") as AvailableSlot["period"],
      status: (["available", "limited", "booked"].includes(text(row, "status")) ? text(row, "status") : "available") as AvailableSlot["status"],
    }));
  },

  async createBooking(input: CreatePublicBookingInput) {
    const payload = {
      clinic_slug: input.clinicSlug,
      slot_id: input.slotId,
      service_id: input.serviceId ?? null,
      payment_option: input.paymentOption,
      source: input.source ?? "website",
      patient: {
        full_name: input.patient.fullName,
        phone: input.patient.phone,
        age: input.patient.age || null,
        gender: input.patient.gender || null,
        reason: input.patient.reason,
        notes: input.patient.notes ?? "",
      },
    };
    const row = asObject(await callRpc("public_create_booking", { input: payload as unknown as Json }));
    if (!row) throw new Error("The booking could not be created. Please pick another slot.");
    const result: PublicBookingResult = {
      bookingId: text(row, "bookingId"),
      token: text(row, "token"),
      status: (["confirmed", "pending", "cancelled", "completed"].includes(text(row, "status")) ? text(row, "status") : "confirmed") as BookingStatusResult["status"],
      clinicName: text(row, "clinicName"),
      clinicSlug: text(row, "clinicSlug", input.clinicSlug),
      doctorName: text(row, "doctorName"),
      serviceName: text(row, "serviceName"),
      patientName: text(row, "patientName"),
      dateTime: text(row, "dateTime"),
      appointmentDate: text(row, "appointmentDate"),
      appointmentTime: text(row, "appointmentTime"),
    };
    return result;
  },

  async getBookingStatus(phone, reference) {
    const row = asObject(await callRpc("public_booking_status", { p_phone: phone, p_reference: reference }));
    if (!row) return null;
    return {
      bookingId: text(row, "bookingId"),
      token: text(row, "token"),
      status: (["confirmed", "pending", "cancelled", "completed"].includes(text(row, "status")) ? text(row, "status") : "pending") as BookingStatusResult["status"],
      clinicName: text(row, "clinicName"),
      doctorName: text(row, "doctorName"),
      patientName: text(row, "patientName"),
      dateTime: text(row, "dateTime"),
    };
  },
};
