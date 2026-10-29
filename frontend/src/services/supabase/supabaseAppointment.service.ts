import { supabase } from "../../lib/supabaseClient";
import type { AppointmentRecord, AppointmentStatus, PatientRecord } from "../../shared/types/domain";
import type { Json, Tables, TablesInsert } from "../../shared/types/database.types";
import type { AppointmentFilters, AppointmentService, CreateAppointmentInput, DoctorScheduleResult } from "../interfaces";
import { logAuditEvent } from "./auditLogger";
import { supabaseAuthService } from "./supabaseAuth.service";
import { localDateISO } from "../../utils/formatDate";

type AppointmentRow = Tables<"appointments">;

function mapAppointment(row: AppointmentRow): AppointmentRecord {
  return {
    id: row.id,
    clinicId: row.clinic_id,
    branchId: row.branch_id ?? "",
    patientId: row.patient_id,
    doctorId: row.doctor_id ?? "",
    tokenNumber: row.token_number ?? "",
    date: row.appointment_date,
    time: row.appointment_time ?? "",
    department: row.department ?? "",
    reason: row.main_problem ?? "",
    source: (row.source ?? "reception") as AppointmentRecord["source"],
    status: normalizeStatus(row.status),
    paymentStatus: ((row.metadata && typeof row.metadata === "object" && (row.metadata as Record<string, unknown>).payment_status) as AppointmentRecord["paymentStatus"]) ?? "pending",
  };
}

function normalizeStatus(status: string | null): AppointmentStatus {
  if (status === "requested" || status === "confirmed") return "booked";
  return (status ?? "booked") as AppointmentStatus;
}

function splitText(value: string | null | undefined): string[] {
  if (!value) return [];
  return value.split(",").map((s) => s.trim()).filter(Boolean);
}

export const supabaseAppointmentService: AppointmentService = {
  async getAppointments(filters?: AppointmentFilters) {
    let query = supabase.from("appointments").select("*").order("appointment_date", { ascending: true }).order("appointment_time", { ascending: true });
    if (filters?.clinicId) query = query.eq("clinic_id", filters.clinicId);
    if (filters?.branchId) query = query.eq("branch_id", filters.branchId);
    if (filters?.doctorId) query = query.eq("doctor_id", filters.doctorId);
    if (filters?.patientId) query = query.eq("patient_id", filters.patientId);
    if (filters?.source) query = query.eq("source", filters.source);
    if (filters?.status) query = query.eq("status", filters.status);
    const { data, error } = await query;
    if (error) throw error;
    return (data ?? []).map(mapAppointment);
  },

  async getAppointmentById(id) {
    const { data, error } = await supabase.from("appointments").select("*").eq("id", id).single();
    if (error) throw error;
    return mapAppointment(data);
  },

  getTodayAppointments() {
    const today = localDateISO();
    return this.getAppointments({} as AppointmentFilters).then((items) => items.filter((item) => item.date === today));
  },

  getDoctorAppointments(doctorId) {
    return this.getAppointments({ doctorId });
  },

  async getDoctorSchedule(doctorId, options): Promise<DoctorScheduleResult> {
    const { data, error } = await supabase
      .from("appointments")
      .select("*, patients(*)")
      .eq("doctor_id", doctorId)
      .gte("appointment_date", options.startDate)
      .lte("appointment_date", options.endDate)
      .order("appointment_date", { ascending: true })
      .order("appointment_time", { ascending: true });

    if (error) throw error;

    const patientMap = new Map<string, PatientRecord>();
    const appointments: AppointmentRecord[] = [];

    for (const row of (data ?? [])) {
      appointments.push(mapAppointment(row));
      if (row.patients) {
        const p = row.patients as Tables<"patients">;
        patientMap.set(p.id, {
          id: p.id,
          patientId: p.patient_code ?? p.id,
          clinicId: p.clinic_id,
          branchId: p.branch_id ?? "",
          fullName: p.full_name,
          phone: p.phone,
          whatsappNumber: p.whatsapp_number ?? p.phone,
          age: p.age ?? 0,
          gender: (p.gender as "female" | "male" | "other") ?? "other",
          source: (p.source ?? "reception") as PatientRecord["source"],
          allergies: splitText(p.allergies),
          medicalHistory: splitText(p.medical_history),
          currentMedications: splitText(p.current_medications),
          whatsappConsent: p.whatsapp_consent ?? false,
          reminderConsent: p.reminder_consent ?? false,
        });
      }
    }

    return { appointments, patients: patientMap };
  },

  getQueue() {
    return this.getAppointments().then((items) => items.filter((item) => ["arrived", "waiting", "in_consultation"].includes(item.status)));
  },

  async createAppointment(input: CreateAppointmentInput) {
    const context = await supabaseAuthService.getCurrentAuthContext();
    const appointmentInput: TablesInsert<"appointments"> = {
      clinic_id: input.clinicId || context.clinic_id || "",
      branch_id: input.branchId || context.branch_id || null,
      patient_id: input.patientId,
      doctor_id: input.doctorId || null,
      token_number: input.tokenNumber ?? null,
      appointment_date: input.date,
      appointment_time: input.time || null,
      department: input.department,
      main_problem: input.reason,
      source: input.source,
      status: input.status,
      created_by: context.staffProfileId,
      assigned_by: input.doctorId ? context.staffProfileId : null,
    };
    const { data, error } = await supabase.from("appointments").insert(appointmentInput).select("*").single();
    if (error) throw error;
    logAuditEvent({ clinicId: data.clinic_id, branchId: data.branch_id, eventType: "appointment_created", entityType: "appointments", entityId: data.id, action: "create", status: "success", severity: "info", message: "Appointment created.", metadata: { appointment_status: data.status, source: data.source } });
    return mapAppointment(data);
  },

  async bookAppointmentWithSlot(input) {
    const { data, error } = await supabase.rpc("create_appointment_with_slot", { input: input as Json });
    if (error) throw error;
    return mapAppointment(data);
  },

  async bookForPatient(input) {
    const payload = {
      patient_id: input.patientId,
      doctor_id: input.doctorId,
      appointment_date: input.appointmentDate,
      appointment_time: input.appointmentTime ?? null,
      slot_id: input.slotId ?? null,
      department: input.department ?? null,
      main_problem: input.mainProblem ?? null,
      source: input.source ?? "reception",
      is_new_patient: input.isNewPatient ?? false,
      metadata: input.metadata ?? {},
    };
    const { data, error } = await supabase.rpc("book_appointment_for_patient", { input: payload as unknown as Json });
    if (error) throw error;
    logAuditEvent({ clinicId: data.clinic_id, branchId: data.branch_id, eventType: "appointment_created", entityType: "appointments", entityId: data.id, action: "create", status: "success", severity: "info", message: "Appointment booked.", metadata: { source: data.source, token: data.token_number } });
    return mapAppointment(data);
  },

  async assignDoctor(appointmentId, doctorId, slotId) {
    const context = await supabaseAuthService.getCurrentAuthContext();
    const { data: slot, error: slotError } = await supabase.from("appointment_slots").select("*").eq("id", slotId).single();
    if (slotError) throw slotError;
    const { data, error } = await supabase.from("appointments").update({
      doctor_id: doctorId,
      slot_id: slotId,
      appointment_date: slot.slot_date,
      appointment_time: slot.start_time,
      assigned_by: context.staffProfileId,
    }).eq("id", appointmentId).select("*").single();
    if (error) throw error;
    return mapAppointment(data);
  },

  async updateAppointmentStatus(id, status) {
    const { data, error } = await supabase.rpc("update_appointment_status", { appointment_id: id, new_status: status, reason: undefined });
    if (error) throw error;
    logAuditEvent({ clinicId: data.clinic_id, branchId: data.branch_id, eventType: "appointment_status_changed", entityType: "appointments", entityId: data.id, action: "status_change", status: "success", severity: "info", message: "Appointment status changed.", metadata: { appointment_status: data.status } });
    return mapAppointment(data);
  },

  async cancelAppointment(id, reason) {
    const { data, error } = await supabase.rpc("update_appointment_status", { appointment_id: id, new_status: "cancelled", reason });
    if (error) throw error;
    logAuditEvent({ clinicId: data.clinic_id, branchId: data.branch_id, eventType: "appointment_status_changed", entityType: "appointments", entityId: data.id, action: "cancel", status: "success", severity: "info", message: "Appointment cancelled.", metadata: { reason } });
    return mapAppointment(data);
  },

  async getAppointmentStatusHistory(id) {
    const { data, error } = await supabase.from("appointment_status_history").select("*").eq("appointment_id", id).order("created_at", { ascending: false });
    if (error) throw error;
    return data ?? [];
  },

  async createSlot(input) {
    const { data, error } = await supabase.from("appointment_slots").insert(input).select("*").single();
    if (error) throw error;
    return data;
  },
};
