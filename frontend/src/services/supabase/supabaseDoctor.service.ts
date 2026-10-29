import { supabase } from "../../lib/supabaseClient";
import type { ConsultationRecord, DeliveryStatus, DoctorAvailabilityRecord, PrescriptionItemRecord, PrescriptionRecord, ReminderRecord, ReminderStatus } from "../../shared/types/domain";
import type { Json, Tables, TablesInsert, TablesUpdate } from "../../shared/types/database.types";
import type { AvailabilityUpdateResult, BlockedDateResult, ConsultationFilters, CreatePrescriptionWithItemsInput, DoctorDomainService, PrescriptionFilters, PrescriptionWithItemsResult } from "../interfaces";
import type { FollowUp, FollowUpStatus, MedicineReminderSchedule, PatientTag, PatientTimelineItem, Prescription } from "../../modules/doctor/types";
import { logAuditEvent } from "./auditLogger";
import { supabaseAuthService } from "./supabaseAuth.service";
import { localDateISO } from "../../utils/formatDate";

type AvailabilityRow = Tables<"doctor_availability">;
type ConsultationRow = Tables<"consultations">;
type PrescriptionRow = Tables<"prescriptions">;
type PrescriptionItemRow = Tables<"prescription_items">;
type MedicineReminderRow = Tables<"medicine_reminders">;

function mapAvailability(row: AvailabilityRow): DoctorAvailabilityRecord {
  return {
    id: row.id,
    clinicId: row.clinic_id,
    doctorId: row.doctor_id,
    branchId: row.branch_id ?? "",
    weekday: String(row.day_of_week ?? ""),
    startTime: row.start_time,
    endTime: row.end_time,
    breakStart: row.break_start,
    breakEnd: row.break_end,
    isActive: row.is_active ?? true,
    slotDurationMinutes: 15,
    blockedDates: [],
  };
}

function normalizeConsultationFilters(filters?: string | ConsultationFilters): ConsultationFilters {
  return typeof filters === "string" ? { patientId: filters } : filters ?? {};
}

function mapConsultation(row: ConsultationRow): ConsultationRecord {
  return {
    id: row.id,
    appointmentId: row.appointment_id,
    patientId: row.patient_id,
    doctorId: row.doctor_id,
    symptoms: row.symptoms ?? "",
    vitals: {},
    diagnosis: row.diagnosis ?? "",
    notes: row.clinical_notes ?? "",
    status: row.status === "completed" ? "completed" : "draft",
  };
}

function normalizePrescriptionFilters(filters?: string | PrescriptionFilters): PrescriptionFilters {
  return typeof filters === "string" ? { patientId: filters } : filters ?? {};
}

function mapPrescriptionStatus(row: PrescriptionRow): PrescriptionRecord["status"] {
  if (row.status === "finalized" || row.status === "completed") return "completed";
  if (row.pharmacy_status === "sent_to_pharmacy" || row.send_to_pharmacy) return "sent_to_pharmacy";
  if (row.delivery_channel === "whatsapp" && row.delivery_status && row.delivery_status !== "queued") return "sent_to_whatsapp";
  return "draft";
}

function mapPrescriptionItem(row: PrescriptionItemRow): PrescriptionItemRecord {
  return {
    id: row.id,
    prescriptionId: row.prescription_id,
    medicineId: row.medicine_id ?? row.medicine_name,
    medicineName: row.medicine_name,
    dosage: row.dosage ?? "",
    frequency: row.frequency ?? "",
    timing: row.timing ?? "",
    duration: row.duration ?? "",
    beforeAfterFood: row.food_instruction === "before_food" ? "before_food" : "after_food",
  };
}

function mapPrescription(row: PrescriptionRow, items: PrescriptionItemRow[] = []): PrescriptionRecord {
  return {
    id: row.id,
    consultationId: row.consultation_id ?? "",
    patientId: row.patient_id,
    doctorId: row.doctor_id,
    status: mapPrescriptionStatus(row),
    deliveryStatus: (row.delivery_status ?? "queued") as DeliveryStatus,
    items: items.map(mapPrescriptionItem),
    followUpDate: row.follow_up_date ?? undefined,
  };
}

function mapReminder(row: MedicineReminderRow): ReminderRecord {
  return {
    id: row.id,
    patientId: row.patient_id,
    prescriptionItemId: row.prescription_item_id ?? undefined,
    type: "medicine",
    status: (row.status ?? "active") as ReminderStatus,
    deliveryStatus: (row.delivery_status ?? "queued") as DeliveryStatus,
    nextRunAt: row.next_run_at ?? row.created_at ?? new Date().toISOString(),
  };
}

function normalizePrescriptionRpcResult(value: Json): PrescriptionWithItemsResult {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Prescription RPC did not return a valid payload.");
  }
  const result = value as { prescription?: PrescriptionRow; items?: PrescriptionItemRow[] };
  if (!result.prescription) throw new Error("Prescription RPC did not return a prescription.");
  return { prescription: result.prescription, items: result.items ?? [] };
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function isoDate(date: Date) {
  return localDateISO(date);
}

function normalizeDateRange(dateOrRange: string | { from: string; to: string }) {
  return typeof dateOrRange === "string" ? { from: dateOrRange, to: dateOrRange } : dateOrRange;
}

interface ScheduleSyncWarning {
  appointmentId?: string;
  token?: string;
  patientName?: string;
  date?: string;
  time?: string;
  warning: string;
}

interface ScheduleSyncResponse {
  success?: boolean;
  warnings?: ScheduleSyncWarning[];
}

async function updateAppointmentStatus(appointmentId: string, status: string, reason: string) {
  const { error } = await supabase.rpc("update_appointment_status", {
    appointment_id: appointmentId,
    new_status: status,
    reason,
  });
  if (error) throw error;
}

export const supabaseDoctorDomainService: DoctorDomainService = {
  async getDoctorProfiles() {
    const { data, error } = await supabase.from("doctor_profiles").select("*").eq("status", "active").order("created_at", { ascending: false });
    if (error) throw error;
    return data ?? [];
  },

  async getDoctorProfileByStaffId(staffId) {
    const { data, error } = await supabase.from("doctor_profiles").select("*").eq("staff_id", staffId).maybeSingle();
    if (error) throw error;
    return data;
  },

  async getDoctorAvailability(doctorId) {
    const { data, error } = await supabase.from("doctor_availability").select("*").eq("doctor_id", doctorId).eq("is_active", true).order("day_of_week", { ascending: true });
    if (error) throw error;
    return (data ?? []).map(mapAvailability);
  },

  async updateDoctorAvailability(doctorId, input): Promise<AvailabilityUpdateResult> {
    const { data: syncData, error: syncError } = await supabase.rpc(
      "sync_doctor_schedule_and_slots" as never,
      {
        p_doctor_id: doctorId,
        p_availability: input,
      } as never
    );

    if (syncError) {
      const { error: deleteError } = await supabase.from("doctor_availability").delete().eq("doctor_id", doctorId);
      if (deleteError) throw deleteError;
      if (input.length === 0) {
        const emptyArr: Tables<"doctor_availability">[] = [];
        return Object.assign(emptyArr, { warnings: [] as string[] });
      }
      const { data, error } = await supabase.from("doctor_availability").insert(input).select("*");
      if (error) throw error;
      const rows = data ?? [];
      return Object.assign(rows, { warnings: [] as string[] });
    }

    const { data, error } = await supabase.from("doctor_availability").select("*").eq("doctor_id", doctorId);
    if (error) throw error;
    const syncResult = syncData as ScheduleSyncResponse | null;
    const warnings: string[] = (syncResult?.warnings ?? []).map((w) => w.warning);
    const res = (data ?? []).slice();
    return Object.assign(res, { warnings });
  },

  async getDoctorBlockedDates(doctorId) {
    const { data, error } = await supabase.from("doctor_blocked_dates").select("*").eq("doctor_id", doctorId).order("blocked_date", { ascending: true });
    if (error) throw error;
    return data ?? [];
  },

  async blockDoctorDate(input): Promise<BlockedDateResult> {
    const context = await supabaseAuthService.getCurrentAuthContext();
    const staffId = input.created_by ?? context.staffProfileId;

    const { data: syncData, error: syncError } = await supabase.rpc(
      "block_doctor_date_and_sync_slots" as never,
      {
        p_clinic_id: input.clinic_id,
        p_doctor_id: input.doctor_id,
        p_blocked_date: input.blocked_date,
        p_reason: input.reason ?? null,
        p_staff_id: staffId,
      } as never
    );

    if (syncError) {
      const { data, error } = await supabase.from("doctor_blocked_dates").insert({ ...input, created_by: staffId }).select("*").single();
      if (error) throw error;
      await supabase.from("appointment_slots").update({ status: "blocked" }).eq("doctor_id", input.doctor_id).eq("slot_date", input.blocked_date);
      return Object.assign(data, { warnings: [] as string[] });
    }

    const { data, error: selectError } = await supabase.from("doctor_blocked_dates").select("*").eq("doctor_id", input.doctor_id).eq("blocked_date", input.blocked_date).single();
    if (selectError) throw selectError;
    const syncResult = syncData as ScheduleSyncResponse | null;
    const warnings: string[] = (syncResult?.warnings ?? []).map((w) => w.warning);
    return Object.assign(data, { warnings });
  },

  async getAvailableSlots(doctorId, date) {
    // Single source of truth: delegate slot generation to database function
    await supabase.rpc("ensure_doctor_slots" as never, { p_doctor_id: doctorId, p_date: date } as never);

    const { data, error } = await supabase.from("appointment_slots").select("*").eq("doctor_id", doctorId).eq("slot_date", date).eq("status", "available").order("start_time", { ascending: true });
    if (error) throw error;
    return data ?? [];
  },

  async generateSlotsForDoctor(doctorId, dateOrRange) {
    const dateRange = normalizeDateRange(dateOrRange);
    const start = new Date(`${dateRange.from}T00:00:00`);
    const end = new Date(`${dateRange.to}T00:00:00`);
    for (let day = start; day <= end; day = addDays(day, 1)) {
      const slotDate = isoDate(day);
      await supabase.rpc("ensure_doctor_slots" as never, { p_doctor_id: doctorId, p_date: slotDate } as never);
    }
    const { data, error: selectError } = await supabase.from("appointment_slots").select("*").eq("doctor_id", doctorId).gte("slot_date", dateRange.from).lte("slot_date", dateRange.to).order("slot_date", { ascending: true }).order("start_time", { ascending: true });
    if (selectError) throw selectError;
    return data ?? [];
  },

  async getConsultations(filters) {
    const normalized = normalizeConsultationFilters(filters);
    let query = supabase.from("consultations").select("*").order("created_at", { ascending: false });
    if (normalized.clinicId) query = query.eq("clinic_id", normalized.clinicId);
    if (normalized.patientId) query = query.eq("patient_id", normalized.patientId);
    if (normalized.doctorId) query = query.eq("doctor_id", normalized.doctorId);
    if (normalized.appointmentId) query = query.eq("appointment_id", normalized.appointmentId);
    if (normalized.status) query = query.eq("status", normalized.status);
    const { data, error } = await query;
    if (error) throw error;
    return (data ?? []).map(mapConsultation);
  },

  async getConsultationById(id) {
    const { data, error } = await supabase.from("consultations").select("*").eq("id", id).single();
    if (error) throw error;
    return data;
  },

  async getConsultationsByPatient(patientId) {
    const { data, error } = await supabase.from("consultations").select("*").eq("patient_id", patientId).order("created_at", { ascending: false });
    if (error) throw error;
    return data ?? [];
  },

  async getConsultationByAppointment(appointmentId) {
    const { data, error } = await supabase.from("consultations").select("*").eq("appointment_id", appointmentId).maybeSingle();
    if (error) throw error;
    return data;
  },

  async createConsultation(input) {
    const context = await supabaseAuthService.getCurrentAuthContext();
    const payload: TablesInsert<"consultations"> = {
      ...input,
      clinic_id: input.clinic_id || context.clinic_id || "",
      branch_id: input.branch_id ?? context.branch_id,
      created_by: input.created_by ?? context.staffProfileId,
      status: input.status ?? "draft",
    };
    const { data, error } = await supabase.from("consultations").insert(payload).select("*").single();
    if (error) throw error;
    await updateAppointmentStatus(data.appointment_id, "in_consultation", "consultation_started");
    return data;
  },

  async updateConsultation(id, input: TablesUpdate<"consultations">) {
    const { data, error } = await supabase.from("consultations").update(input).eq("id", id).select("*").single();
    if (error) throw error;
    return data;
  },

  async completeConsultation(id) {
    const { data, error } = await supabase.from("consultations").update({ status: "completed", completed_at: new Date().toISOString() }).eq("id", id).select("*").single();
    if (error) throw error;
    await updateAppointmentStatus(data.appointment_id, "completed", "consultation_completed");
    logAuditEvent({ clinicId: data.clinic_id, branchId: data.branch_id, eventType: "consultation_completed", entityType: "consultations", entityId: data.id, action: "complete", status: "success", severity: "info", message: "Consultation completed.", metadata: { appointment_id: data.appointment_id, patient_id: data.patient_id } });
    return data;
  },

  async saveVitals(input) {
    const context = await supabaseAuthService.getCurrentAuthContext();
    const { data, error } = await supabase.from("consultation_vitals").insert({ ...input, clinic_id: input.clinic_id || context.clinic_id || "" }).select("*").single();
    if (error) throw error;
    return data;
  },

  async getVitals(consultationId) {
    const { data, error } = await supabase.from("consultation_vitals").select("*").eq("consultation_id", consultationId).order("created_at", { ascending: false });
    if (error) throw error;
    return data ?? [];
  },

  async addConsultationNote(input) {
    const context = await supabaseAuthService.getCurrentAuthContext();
    const { data, error } = await supabase.from("consultation_notes").insert({ ...input, clinic_id: input.clinic_id || context.clinic_id || "", created_by: input.created_by ?? context.staffProfileId }).select("*").single();
    if (error) throw error;
    return data;
  },

  async getConsultationNotes(consultationId) {
    const { data, error } = await supabase.from("consultation_notes").select("*").eq("consultation_id", consultationId).order("created_at", { ascending: false });
    if (error) throw error;
    return data ?? [];
  },

  async getPrescriptions(filters) {
    const normalized = normalizePrescriptionFilters(filters);
    let query = supabase.from("prescriptions").select("*").order("created_at", { ascending: false });
    if (normalized.clinicId) query = query.eq("clinic_id", normalized.clinicId);
    if (normalized.patientId) query = query.eq("patient_id", normalized.patientId);
    if (normalized.consultationId) query = query.eq("consultation_id", normalized.consultationId);
    if (normalized.appointmentId) query = query.eq("appointment_id", normalized.appointmentId);
    if (normalized.doctorId) query = query.eq("doctor_id", normalized.doctorId);
    if (normalized.status) query = query.eq("status", normalized.status);
    if (normalized.deliveryStatus) query = query.eq("delivery_status", normalized.deliveryStatus);
    if (normalized.pharmacyStatus) query = query.eq("pharmacy_status", normalized.pharmacyStatus);
    const { data: rows, error } = await query;
    if (error) throw error;
    const prescriptions = rows ?? [];
    if (prescriptions.length === 0) return [];
    const { data: itemRows, error: itemsError } = await supabase.from("prescription_items").select("*").in("prescription_id", prescriptions.map((item) => item.id));
    if (itemsError) throw itemsError;
    return prescriptions.map((prescription) => mapPrescription(prescription, (itemRows ?? []).filter((item) => item.prescription_id === prescription.id)));
  },

  async getPrescriptionById(id) {
    const { data: prescription, error } = await supabase.from("prescriptions").select("*").eq("id", id).maybeSingle();
    if (error) throw error;
    if (!prescription) return null;
    const { data: items, error: itemsError } = await supabase.from("prescription_items").select("*").eq("prescription_id", id).order("sort_order", { ascending: true });
    if (itemsError) throw itemsError;
    return { prescription, items: items ?? [] };
  },

  async getPrescriptionsByPatient(patientId) {
    return this.getPrescriptions({ patientId });
  },

  async getPrescriptionsByConsultation(consultationId) {
    return this.getPrescriptions({ consultationId });
  },

  async createPrescription(input) {
    const context = await supabaseAuthService.getCurrentAuthContext();
    const payload: TablesInsert<"prescriptions"> = {
      ...input,
      clinic_id: input.clinic_id || context.clinic_id || "",
      branch_id: input.branch_id ?? context.branch_id,
      created_by: input.created_by ?? context.staffProfileId,
      status: input.status ?? "draft",
      delivery_status: input.delivery_status ?? "queued",
      delivery_channel: input.delivery_channel ?? "none",
      pharmacy_status: input.pharmacy_status ?? "not_sent",
    };
    const { data, error } = await supabase.from("prescriptions").insert(payload).select("*").single();
    if (error) throw error;
    logAuditEvent({ clinicId: data.clinic_id, branchId: data.branch_id, eventType: "prescription_created", entityType: "prescriptions", entityId: data.id, action: "create", status: "success", severity: "info", message: "Prescription created.", metadata: { patient_id: data.patient_id } });
    return data;
  },

  async updatePrescription(id, input) {
    const { data, error } = await supabase.from("prescriptions").update(input).eq("id", id).select("*").single();
    if (error) throw error;
    return data;
  },

  async createPrescriptionWithItems(input: CreatePrescriptionWithItemsInput) {
    const payload = {
      prescription: input.prescription,
      items: input.items,
      reminder_consent_confirmed: input.reminderConsentConfirmed ?? false,
    };
    const { data, error } = await supabase.rpc("create_prescription_with_items", { input: payload as Json });
    if (error) throw error;
    const result = normalizePrescriptionRpcResult(data);
    logAuditEvent({ clinicId: result.prescription.clinic_id, branchId: result.prescription.branch_id, eventType: "prescription_created", entityType: "prescriptions", entityId: result.prescription.id, action: "create", status: "success", severity: "info", message: "Prescription created with items.", metadata: { item_count: result.items.length, patient_id: result.prescription.patient_id } });
    return result;
  },

  async updatePrescriptionDeliveryStatus(id, status, message) {
    const { data, error } = await supabase.rpc("update_prescription_delivery_status", {
      prescription_id: id,
      new_status: status,
      message,
    });
    if (error) throw error;
    return data;
  },

  async routePrescriptionToPharmacy(id) {
    const { data, error } = await supabase.rpc("route_prescription_to_pharmacy", { prescription_id: id });
    if (error) throw error;
    return data;
  },

  async sendPrescriptionToPatientPlaceholder(id) {
    const row = await this.updatePrescriptionDeliveryStatus(id, "sent", "WhatsApp placeholder marked as sent. No real message was sent.");
    logAuditEvent({ clinicId: row.clinic_id, branchId: row.branch_id, eventType: "prescription_placeholder_sent", entityType: "prescriptions", entityId: row.id, action: "send_placeholder", status: "success", severity: "info", message: "Prescription WhatsApp placeholder sent.", metadata: { noExternalApi: true, patient_id: row.patient_id } });
    return row;
  },

  async sendPrescriptionToWhatsApp(prescriptionId) {
    const prescription = await this.sendPrescriptionToPatientPlaceholder(prescriptionId);
    const items = await supabase.from("prescription_items").select("*").eq("prescription_id", prescriptionId).order("sort_order", { ascending: true });
    if (items.error) throw items.error;
    return mapPrescription(prescription, items.data ?? []);
  },

  async getMedicineReminders(patientId) {
    let query = supabase.from("medicine_reminders").select("*").order("next_run_at", { ascending: true });
    if (patientId) query = query.eq("patient_id", patientId);
    const { data, error } = await query;
    if (error) throw error;
    return (data ?? []).map(mapReminder);
  },

  async createMedicineReminderSchedule(input) {
    const context = await supabaseAuthService.getCurrentAuthContext();
    const { data, error } = await supabase.from("medicine_reminders").insert({
      ...input,
      clinic_id: input.clinic_id || context.clinic_id || "",
      created_by: input.created_by ?? context.staffProfileId,
    }).select("*").single();
    if (error) throw error;
    return data;
  },

  async updateReminderStatus(id, status) {
    const { data, error } = await supabase.from("medicine_reminders").update({ status }).eq("id", id).select("*").single();
    if (error) throw error;
    return data;
  },

  async getReminders(patientId) {
    return this.getMedicineReminders(patientId);
  },

  async getFollowUps(doctorId) {
    let query = supabase
      .from("consultations")
      .select("*")
      .not("follow_up_date", "is", null)
      .order("follow_up_date", { ascending: true });
    if (doctorId) query = query.eq("doctor_id", doctorId);
    const { data: consultations, error } = await query;
    if (error) throw error;
    const rows = consultations ?? [];
    if (rows.length === 0) return [];

    const patientIds = Array.from(new Set(rows.map((row) => row.patient_id)));
    const [{ data: patients, error: patientError }, { data: laterAppointments, error: appointmentError }] = await Promise.all([
      supabase.from("patients").select("id,full_name,phone,whatsapp_number").in("id", patientIds),
      supabase.from("appointments").select("patient_id,appointment_date,status").in("patient_id", patientIds),
    ]);
    if (patientError) throw patientError;
    if (appointmentError) throw appointmentError;

    const patientMap = new Map((patients ?? []).map((patient) => [patient.id, patient]));
    const today = isoDate(new Date());

    return rows.map((row): FollowUp => {
      const patient = patientMap.get(row.patient_id);
      const followUpDate = row.follow_up_date ?? "";
      // A follow-up counts as done once the patient has any appointment on/after the due date.
      const attended = (laterAppointments ?? []).some(
        (appointment) => appointment.patient_id === row.patient_id && appointment.appointment_date >= followUpDate && appointment.status === "completed",
      );
      const status: FollowUpStatus = attended ? "completed" : followUpDate === today ? "due_today" : followUpDate < today ? "overdue" : "upcoming";
      return {
        id: row.id,
        patientId: row.patient_id,
        patientName: patient?.full_name ?? "Patient",
        phone: patient?.whatsapp_number || patient?.phone || "",
        lastDiagnosis: row.diagnosis || "Consultation",
        followUpDate,
        reason: row.follow_up_reason || "Review visit",
        status,
        reminderStatus: attended ? "completed" : "scheduled",
        whatsappDeliveryStatus: "queued",
        patientResponseStatus: attended ? "confirmed" : "no_response",
      };
    });
  },

  async getMedicineReminderSchedules(doctorId) {
    const query = supabase.from("medicine_reminders").select("*").in("status", ["active", "paused"]).order("next_run_at", { ascending: true });
    const { data: reminders, error } = await query;
    if (error) throw error;
    let rows = reminders ?? [];
    if (rows.length === 0) return [];

    const prescriptionIds = Array.from(new Set(rows.map((row) => row.prescription_id)));
    const { data: prescriptions, error: prescriptionError } = await supabase.from("prescriptions").select("id,doctor_id").in("id", prescriptionIds);
    if (prescriptionError) throw prescriptionError;
    if (doctorId) {
      const owned = new Set((prescriptions ?? []).filter((item) => item.doctor_id === doctorId).map((item) => item.id));
      rows = rows.filter((row) => owned.has(row.prescription_id));
      if (rows.length === 0) return [];
    }

    const { data: patients, error: patientError } = await supabase
      .from("patients")
      .select("id,full_name,phone,whatsapp_number,reminder_consent")
      .in("id", Array.from(new Set(rows.map((row) => row.patient_id))));
    if (patientError) throw patientError;
    const patientMap = new Map((patients ?? []).map((patient) => [patient.id, patient]));

    const grouped = new Map<string, MedicineReminderSchedule>();
    for (const row of rows) {
      const key = `${row.patient_id}:${row.prescription_id}`;
      const patient = patientMap.get(row.patient_id);
      const existing = grouped.get(key);
      if (existing) {
        existing.activeMedicines.push(row.medicine_name);
        continue;
      }
      grouped.set(key, {
        id: key,
        patientName: patient?.full_name ?? "Patient",
        phone: patient?.whatsapp_number || patient?.phone || "",
        prescriptionId: row.prescription_id,
        activeMedicines: [row.medicine_name],
        nextReminder: row.next_run_at ? new Date(row.next_run_at).toLocaleString() : "Not scheduled",
        duration: row.end_date ? `${row.start_date} to ${row.end_date}` : `From ${row.start_date}`,
        consent: row.consent_confirmed && patient?.reminder_consent ? "confirmed" : "not_received",
        status: (row.status ?? "active") as ReminderStatus,
      });
    }
    return Array.from(grouped.values());
  },

  async getPatientProfile(patientId) {
    const { data: patient, error } = await supabase.from("patients").select("*").eq("id", patientId).single();
    if (error) throw error;

    const [{ data: appointments }, { data: consultations }, { data: invoices }] = await Promise.all([
      supabase.from("appointments").select("appointment_date,status").eq("patient_id", patientId).order("appointment_date", { ascending: false }),
      supabase.from("consultations").select("created_at").eq("patient_id", patientId).order("created_at", { ascending: false }).limit(1),
      supabase.from("invoices").select("balance_amount,invoice_status").eq("patient_id", patientId),
    ]);

    const completed = (appointments ?? []).filter((appointment) => appointment.status === "completed");
    const pendingBalance = (invoices ?? []).filter((invoice) => invoice.invoice_status !== "cancelled").reduce((total, invoice) => total + (invoice.balance_amount ?? 0), 0);
    const age = patient.age ?? 0;
    const tags: PatientTag[] = [];
    if (completed.length === 0) tags.push("New Patient");
    else if (completed.length > 3) tags.push("Regular");
    else tags.push("Follow-up");
    if (age >= 60) tags.push("Senior Citizen");
    if (age > 0 && age < 13) tags.push("Child");

    return {
      id: patient.id,
      name: patient.full_name,
      phone: patient.whatsapp_number || patient.phone,
      age,
      gender: patient.gender ?? "other",
      bloodGroup: patient.blood_group ?? "",
      tags,
      lastVisit: completed[0]?.appointment_date ?? consultations?.[0]?.created_at?.slice(0, 10) ?? "No previous visit",
      allergies: splitList(patient.allergies),
      conditions: splitList(patient.existing_conditions ?? patient.medical_history),
      medications: splitList(patient.current_medications),
      emergencyContact: [patient.emergency_contact_name, patient.emergency_contact_phone].filter(Boolean).join(" - "),
      totalVisits: completed.length,
      pendingPayment: pendingBalance > 0,
      internalNotes: patient.medical_history ?? "",
    };
  },

  async getPatientTimeline(patientId) {
    const { data: consultations, error } = await supabase.from("consultations").select("*").eq("patient_id", patientId).order("created_at", { ascending: false });
    if (error) throw error;
    const rows = consultations ?? [];
    if (rows.length === 0) return [];

    const [{ data: prescriptions }, { data: invoices }, { data: doctors }] = await Promise.all([
      supabase.from("prescriptions").select("id,consultation_id").eq("patient_id", patientId),
      supabase.from("invoices").select("consultation_id,payment_status").eq("patient_id", patientId),
      supabase.from("doctor_profiles").select("id,staff_id").in("id", Array.from(new Set(rows.map((row) => row.doctor_id)))),
    ]);
    const staffIds = Array.from(new Set((doctors ?? []).map((doctor) => doctor.staff_id)));
    const { data: staff } = staffIds.length ? await supabase.from("staff_profiles").select("id,full_name").in("id", staffIds) : { data: [] };
    const staffNames = new Map((staff ?? []).map((item) => [item.id, item.full_name]));
    const doctorNames = new Map((doctors ?? []).map((doctor) => [doctor.id, staffNames.get(doctor.staff_id) ?? "Doctor"]));

    const prescriptionCount = new Map<string, number>();
    for (const prescription of prescriptions ?? []) {
      if (!prescription.consultation_id) continue;
      prescriptionCount.set(prescription.consultation_id, (prescriptionCount.get(prescription.consultation_id) ?? 0) + 1);
    }
    const paymentStatus = new Map((invoices ?? []).filter((invoice) => invoice.consultation_id).map((invoice) => [invoice.consultation_id as string, invoice.payment_status]));

    return rows.map((row): PatientTimelineItem => ({
      id: row.id,
      date: row.created_at?.slice(0, 10) ?? "",
      doctor: doctorNames.get(row.doctor_id) ?? "Doctor",
      diagnosis: row.diagnosis || "Consultation",
      prescriptionSummary: prescriptionCount.get(row.id) ? `${prescriptionCount.get(row.id)} prescription(s)` : "No prescription",
      followUpStatus: row.follow_up_date ? `Follow-up ${row.follow_up_date}` : "No follow-up",
      paymentStatus: paymentStatus.get(row.id) ?? "not billed",
    }));
  },

  async getPatientPrescriptionHistory(patientId) {
    const { data: prescriptions, error } = await supabase.from("prescriptions").select("*").eq("patient_id", patientId).order("created_at", { ascending: false }).limit(10);
    if (error) throw error;
    const rows = prescriptions ?? [];
    if (rows.length === 0) return [];

    const [{ data: items }, { data: doctors }] = await Promise.all([
      supabase.from("prescription_items").select("*").in("prescription_id", rows.map((row) => row.id)).order("sort_order", { ascending: true }),
      supabase.from("doctor_profiles").select("id,staff_id").in("id", Array.from(new Set(rows.map((row) => row.doctor_id)))),
    ]);
    const staffIds = Array.from(new Set((doctors ?? []).map((doctor) => doctor.staff_id)));
    const { data: staff } = staffIds.length ? await supabase.from("staff_profiles").select("id,full_name").in("id", staffIds) : { data: [] };
    const staffNames = new Map((staff ?? []).map((item) => [item.id, item.full_name]));
    const doctorNames = new Map((doctors ?? []).map((doctor) => [doctor.id, staffNames.get(doctor.staff_id) ?? "Doctor"]));

    return rows.map((row): Prescription => ({
      id: row.id,
      patientId: row.patient_id,
      doctorName: doctorNames.get(row.doctor_id) ?? "Doctor",
      diagnosis: row.diagnosis_summary ?? "",
      date: row.created_at?.slice(0, 10) ?? "",
      advice: row.advice ?? undefined,
      labTests: [],
      followUpDate: row.follow_up_date ?? undefined,
      whatsappDeliveryStatus: (row.delivery_status ?? "queued") as DeliveryStatus,
      items: (items ?? [])
        .filter((item) => item.prescription_id === row.id)
        .map((item) => ({
          id: item.id,
          medicineName: item.medicine_name,
          dosage: item.dosage ?? "",
          frequency: item.frequency ?? "",
          timing: item.timing ?? "",
          duration: item.duration ?? "",
          instructions: item.instructions ?? undefined,
          quantity: item.quantity ?? undefined,
        })),
    }));
  },
};

function splitList(value: string | null): string[] {
  if (!value) return [];
  return value
    .split(/[,;\n]/)
    .map((item) => item.trim())
    .filter(Boolean);
}
