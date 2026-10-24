import { supabase } from "../../lib/supabaseClient";
import type { Json, Tables } from "../../shared/types/database.types";
import type { ClinicDepartment, WhatsAppBookingSettings, WhatsAppConversation, WhatsAppConversationStatus, WhatsAppDoctor, WhatsAppMessage, WhatsAppMessageSender, WhatsAppTemplate, WhatsAppTemplateCategory, WhatsAppTemplateStatus } from "../../modules/whatsapp-booking/types";
import type { WhatsAppConsentStatus, WhatsAppMessageInput, WhatsAppSendPlaceholderInput, WhatsAppService } from "../interfaces";
import { logAuditEvent } from "./auditLogger";
import { supabaseAuthService } from "./supabaseAuth.service";

type RpcRow = Record<string, unknown>;
type MessageRow = Tables<"whatsapp_messages">;
type TemplateRow = Tables<"whatsapp_templates">;
type ConversationRow = Tables<"whatsapp_conversations"> & {
  patients?: { full_name: string } | null;
  whatsapp_messages?: MessageRow[] | null;
};
type ConversationMetadata = { patientName?: string; appointmentToken?: string; bookingSummary?: WhatsAppConversation["bookingSummary"] };

function isUuid(value?: string | null) {
  return !!value && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

async function context(inputClinicId?: string, inputBranchId?: string | null) {
  const auth = await supabaseAuthService.getCurrentAuthContext().catch(() => null);
  const clinicId = inputClinicId ?? auth?.clinic_id ?? null;
  if (!clinicId) throw new Error("Clinic context is required for WhatsApp storage.");
  return { clinicId, branchId: inputBranchId ?? auth?.branch_id ?? null, staffId: auth?.staffProfileId ?? null };
}

function run<T>(operation: () => Promise<T>) {
  return operation();
}

const knownDepartments: ClinicDepartment[] = ["dermatology", "orthopaedics", "dental", "pediatrics", "general_medicine", "physiotherapy", "hair_clinic", "other"];

function normalizeDepartment(value: unknown): ClinicDepartment {
  const key = String(value ?? "").trim().toLowerCase().replace(/\s+/g, "_");
  return knownDepartments.includes(key as ClinicDepartment) ? (key as ClinicDepartment) : "general_medicine";
}

function departmentLabel(department: ClinicDepartment) {
  return department.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

/**
 * WhatsApp settings live in clinics.settings->'whatsapp'. Anything the clinic has
 * not configured yet falls back to the clinic record or a safe "not connected" default.
 */
function mergeSettings(clinic: Tables<"clinics">): WhatsAppBookingSettings {
  const stored = (((clinic.settings ?? {}) as { whatsapp?: Partial<WhatsAppBookingSettings> }).whatsapp ?? {});
  return {
    businessNumber: stored.businessNumber ?? clinic.whatsapp_number ?? clinic.phone ?? "",
    displayName: stored.displayName ?? clinic.name ?? "",
    businessProfileStatus: stored.businessProfileStatus ?? "Not submitted",
    clinicMode: stored.clinicMode ?? (clinic.clinic_mode === "multi_speciality" ? "multi_speciality" : "single_speciality"),
    enableBooking: stored.enableBooking ?? true,
    allowExistingPatientLookup: stored.allowExistingPatientLookup ?? true,
    requirePaymentBeforeConfirmation: stored.requirePaymentBeforeConfirmation ?? false,
    autoCreateAppointment: stored.autoCreateAppointment ?? true,
    sendReminderBeforeAppointment: stored.sendReminderBeforeAppointment ?? true,
    reminderTiming: stored.reminderTiming ?? "24 hours before",
    reminderTemplate: stored.reminderTemplate ?? "appointment_reminder",
    followUpReminder: stored.followUpReminder ?? true,
    handoffOnStaff: stored.handoffOnStaff ?? true,
    handoffAfterFailedAttempts: stored.handoffAfterFailedAttempts ?? true,
    receptionContactDisplay: stored.receptionContactDisplay ?? clinic.phone ?? "",
    apiStatus: stored.apiStatus ?? "not_connected",
    provider: stored.provider ?? "meta_cloud_api",
  };
}

function mapMessage(row: MessageRow): WhatsAppMessage {
  return {
    id: row.id,
    sender: (row.sender_type ?? (row.direction === "inbound" ? "patient" : "bot")) as WhatsAppMessageSender,
    text: row.body ?? "",
    time: new Date(row.created_at ?? Date.now()).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
  };
}

function mapTemplate(row: TemplateRow): WhatsAppTemplate {
  const variables = (Array.isArray(row.variables) ? row.variables : []) as string[];
  return {
    id: row.id,
    name: row.name,
    category: row.category as WhatsAppTemplateCategory,
    status: row.status as WhatsAppTemplateStatus,
    previewText: row.body,
    variables,
    lastUpdated: new Date(row.updated_at ?? row.created_at ?? Date.now()).toLocaleDateString(),
  };
}

function mapConversation(row: ConversationRow): WhatsAppConversation {
  const messages = (row.whatsapp_messages ?? []).map(mapMessage);
  const lastMessage = row.last_message ?? messages[messages.length - 1]?.text ?? "";
  const metadata = (row.metadata ?? {}) as ConversationMetadata;
  return {
    id: row.id,
    patientName: row.patients?.full_name ?? metadata.patientName,
    phone: row.phone_number,
    lastMessage,
    currentStep: row.current_step ?? "Stored conversation",
    status: row.status as WhatsAppConversationStatus,
    source: (row.source ?? "whatsapp") as WhatsAppConversation["source"],
    appointmentToken: metadata.appointmentToken,
    lastUpdated: new Date(row.updated_at ?? row.created_at ?? Date.now()).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    messages,
    bookingSummary: metadata.bookingSummary,
  };
}

function messagePayload(input: WhatsAppMessageInput, scoped: Awaited<ReturnType<typeof context>>) {
  return {
    clinic_id: scoped.clinicId,
    branch_id: input.branchId ?? scoped.branchId,
    conversation_id: isUuid(input.conversationId) ? input.conversationId : null,
    patient_id: isUuid(input.patientId) ? input.patientId : null,
    phone_number: input.phone,
    status: input.deliveryStatus ?? "queued",
    direction: input.direction ?? "outbound",
    sender_type: input.sender ?? "bot",
    message_type: input.messageType ?? "text",
    body: input.body,
    template_id: isUuid(input.templateId) ? input.templateId : null,
    related_type: input.relatedType ?? null,
    related_id: isUuid(input.relatedId) ? input.relatedId : null,
    delivery_status: input.deliveryStatus ?? "queued",
    payload: (input.payload ?? {}) as Json,
    metadata: (input.metadata ?? {}) as Json,
    sent_by: scoped.staffId,
  };
}

async function createPlaceholderMessage(input: WhatsAppSendPlaceholderInput, messageType: NonNullable<WhatsAppMessageInput["messageType"]>) {
  const message = await supabaseWhatsAppService.createMessage({
    ...input,
    direction: "outbound",
    sender: "bot",
    messageType,
    deliveryStatus: "queued",
    metadata: { ...input.metadata, placeholder: true, noExternalApi: true },
  });
  await supabaseWhatsAppService.createDeliveryLog({
    clinicId: input.clinicId,
    branchId: input.branchId,
    conversationId: input.conversationId,
    messageId: message.id,
    patientId: input.patientId,
    phone: input.phone,
    deliveryStatus: "queued",
    metadata: { placeholder: true, noExternalApi: true, messageType },
  });
  logAuditEvent({ clinicId: input.clinicId, branchId: input.branchId, eventType: "whatsapp_placeholder_sent", entityType: "whatsapp_messages", entityId: message.id, action: "send_placeholder", status: "success", severity: "info", message: "WhatsApp placeholder queued.", metadata: { noExternalApi: true, messageType, phone: input.phone, related_id: input.relatedId } });
  return message;
}

export const supabaseWhatsAppService: WhatsAppService = {
  getConversations(clinicId) {
    return run(async () => {
      let query = supabase.from("whatsapp_conversations").select("*, patients(full_name), whatsapp_messages(*)").order("updated_at", { ascending: false }).order("created_at", { foreignTable: "whatsapp_messages", ascending: true });
      if (clinicId) query = query.eq("clinic_id", clinicId);
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []).map(mapConversation);
  });
  },

  getConversationById(id) {
    return run(async () => {
      const { data, error } = await supabase.from("whatsapp_conversations").select("*, patients(full_name), whatsapp_messages(*)").eq("id", id).maybeSingle();
      if (error) throw error;
      return data ? mapConversation(data) : null;
  });
  },

  async createConversation(input) {
    const scoped = await context(input.clinicId, input.branchId);
    return run(async () => {
      const { data, error } = await supabase.from("whatsapp_conversations").insert({
        clinic_id: scoped.clinicId,
        branch_id: scoped.branchId,
        patient_id: isUuid(input.patientId) ? input.patientId : null,
        phone_number: input.phone,
        status: input.status ?? "new",
        source: input.source ?? "whatsapp",
        current_step: input.currentStep ?? "New conversation",
        linked_appointment_id: isUuid(input.linkedAppointmentId) ? input.linkedAppointmentId : null,
        last_message: input.lastMessage ?? "Conversation created.",
        metadata: (input.metadata ?? {}) as Json,
        created_by: scoped.staffId,
      }).select("*, patients(full_name), whatsapp_messages(*)").single();
      if (error) throw error;
      return mapConversation(data);
  });
  },

  async updateConversation(id, input) {
    return run(async () => {
      const { data, error } = await supabase.from("whatsapp_conversations").update({
        branch_id: input.branchId,
        patient_id: isUuid(input.patientId) ? input.patientId : undefined,
        phone_number: input.phone,
        status: input.status,
        source: input.source,
        current_step: input.currentStep,
        linked_appointment_id: isUuid(input.linkedAppointmentId) ? input.linkedAppointmentId : undefined,
        last_message: input.lastMessage,
        metadata: input.metadata as Json | undefined,
      }).eq("id", id).select("*, patients(full_name), whatsapp_messages(*)").single();
      if (error) throw error;
      return mapConversation(data);
  });
  },

  deleteConversation(id) {
    return run(async () => {
      const { error } = await supabase.from("whatsapp_conversations").delete().eq("id", id);
      if (error) throw error;
  });
  },

  transferConversationToReception(id) {
    return this.updateConversation(id, { status: "transferred_to_reception", currentStep: "Reception handoff", lastMessage: "Transferred to reception." });
  },

  getMessages(conversationId) {
    return run(async () => {
      const { data, error } = await supabase.from("whatsapp_messages").select("*").eq("conversation_id", conversationId).order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []).map(mapMessage);
  });
  },

  async createMessage(input) {
    const scoped = await context(input.clinicId, input.branchId);
    return run(async () => {
      const payload = messagePayload(input, scoped);
      const { data, error } = await supabase.from("whatsapp_messages").insert(payload).select("*").single();
      if (error) throw error;
      if (payload.conversation_id) {
        await supabase.from("whatsapp_conversations").update({ last_message: input.body, status: input.messageType === "system" ? undefined : "in_progress" }).eq("id", payload.conversation_id);
      }
      return mapMessage(data);
  });
  },

  updateMessage(id, input) {
    return run(async () => {
      const { data, error } = await supabase.from("whatsapp_messages").update({
        body: input.body,
        delivery_status: input.deliveryStatus,
        status: input.deliveryStatus,
        payload: input.payload as Json | undefined,
        metadata: input.metadata as Json | undefined,
      }).eq("id", id).select("*").single();
      if (error) throw error;
      return mapMessage(data);
  });
  },

  deleteMessage(id) {
    return run(async () => {
      const { error } = await supabase.from("whatsapp_messages").delete().eq("id", id);
      if (error) throw error;
  });
  },

  getTemplates(clinicId) {
    return run(async () => {
      let query = supabase.from("whatsapp_templates").select("*").order("updated_at", { ascending: false });
      if (clinicId) query = query.eq("clinic_id", clinicId);
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []).map(mapTemplate);
  });
  },

  async createTemplate(input) {
    const scoped = await context(input.clinicId, input.branchId);
    return run(async () => {
      const { data, error } = await supabase.from("whatsapp_templates").insert({
        clinic_id: scoped.clinicId,
        branch_id: scoped.branchId,
        name: input.name,
        category: input.category,
        status: input.status ?? "draft",
        body: input.previewText,
        variables: input.variables ?? [],
        metadata: (input.metadata ?? {}) as Json,
        created_by: scoped.staffId,
      }).select("*").single();
      if (error) throw error;
      return mapTemplate(data);
  });
  },

  updateTemplate(id, input) {
    return run(async () => {
      const { data, error } = await supabase.from("whatsapp_templates").update({
        name: input.name,
        category: input.category,
        status: input.status,
        body: input.previewText,
        variables: input.variables,
        metadata: input.metadata as Json | undefined,
      }).eq("id", id).select("*").single();
      if (error) throw error;
      return mapTemplate(data);
  });
  },

  deleteTemplate(id) {
    return run(async () => {
      const { error } = await supabase.from("whatsapp_templates").delete().eq("id", id);
      if (error) throw error;
  });
  },

  getConsent(phone, clinicId) {
    return run(async () => {
      let query = supabase.from("whatsapp_patient_consents").select("consent_status").eq("phone_number", phone);
      if (clinicId) query = query.eq("clinic_id", clinicId);
      const { data, error } = await query.maybeSingle();
      if (error) throw error;
      return (data?.consent_status ?? "unknown") as WhatsAppConsentStatus;
  });
  },

  async upsertConsent(input) {
    const scoped = await context(input.clinicId, input.branchId);
    return run(async () => {
      const { data, error } = await supabase.from("whatsapp_patient_consents").upsert({
        clinic_id: scoped.clinicId,
        branch_id: scoped.branchId,
        patient_id: isUuid(input.patientId) ? input.patientId : null,
        phone_number: input.phone,
        consent_status: input.consentStatus,
        consent_source: input.consentSource ?? "staff",
        consented_at: input.consentStatus === "opted_in" ? new Date().toISOString() : null,
        revoked_at: input.consentStatus === "revoked" || input.consentStatus === "opted_out" ? new Date().toISOString() : null,
        metadata: (input.metadata ?? {}) as Json,
        created_by: scoped.staffId,
      }, { onConflict: "clinic_id,phone_number" }).select("consent_status").single();
      if (error) throw error;
      return data.consent_status as WhatsAppConsentStatus;
  });
  },

  async createDeliveryLog(input) {
    const scoped = await context(input.clinicId, input.branchId);
    return run(async () => {
      const { error } = await supabase.from("whatsapp_delivery_logs").insert({
        clinic_id: scoped.clinicId,
        branch_id: scoped.branchId,
        conversation_id: isUuid(input.conversationId) ? input.conversationId : null,
        message_id: isUuid(input.messageId) ? input.messageId : null,
        patient_id: isUuid(input.patientId) ? input.patientId : null,
        phone_number: input.phone ?? null,
        delivery_status: input.deliveryStatus,
        payload: (input.payload ?? {}) as Json,
        metadata: (input.metadata ?? {}) as Json,
        created_by: scoped.staffId,
      });
      if (error) throw error;
  });
  },

  async saveWebhookEventPlaceholder(input) {
    const scoped = await context(input.clinicId, input.branchId);
    return run(async () => {
      const { error } = await supabase.from("whatsapp_webhook_events").insert({
        clinic_id: scoped.clinicId,
        branch_id: scoped.branchId,
        provider: "placeholder",
        provider_event_id: input.providerEventId ?? null,
        event_type: input.eventType ?? "placeholder",
        payload: (input.payload ?? {}) as Json,
        metadata: { ...input.metadata, noRealWebhook: true },
        created_by: scoped.staffId,
      });
      if (error) throw error;
  });
  },

  async getSettings(clinicId) {
    const scoped = await context(clinicId);
    const { data, error } = await supabase.from("clinics").select("*").eq("id", scoped.clinicId).single();
    if (error) throw error;
    return mergeSettings(data);
  },

  async updateSettings(input, clinicId) {
    const scoped = await context(clinicId);
    const { data: clinic, error: readError } = await supabase.from("clinics").select("settings").eq("id", scoped.clinicId).single();
    if (readError) throw readError;
    const current = (clinic.settings ?? {}) as Record<string, unknown>;
    const nextWhatsApp = { ...(current.whatsapp as Record<string, unknown> | undefined), ...input };
    const { data, error } = await supabase
      .from("clinics")
      .update({ settings: { ...current, whatsapp: nextWhatsApp } as never })
      .eq("id", scoped.clinicId)
      .select("*")
      .single();
    if (error) throw error;
    logAuditEvent({ clinicId: scoped.clinicId, eventType: "whatsapp_settings_updated", entityType: "clinics", entityId: scoped.clinicId, action: "update", status: "success", severity: "info", message: "WhatsApp booking settings updated." });
    return mergeSettings(data);
  },

  async getStats(clinicId) {
    const scoped = await context(clinicId);
    const [conversations, appointments, templates, reminders, messages] = await Promise.all([
      supabase.from("whatsapp_conversations").select("status").eq("clinic_id", scoped.clinicId),
      supabase.from("appointments").select("status,source").eq("clinic_id", scoped.clinicId).eq("source", "whatsapp"),
      supabase.from("whatsapp_templates").select("status").eq("clinic_id", scoped.clinicId),
      supabase.from("medicine_reminders").select("status").eq("clinic_id", scoped.clinicId).eq("status", "active"),
      supabase.from("whatsapp_messages").select("delivery_status").eq("clinic_id", scoped.clinicId).eq("delivery_status", "failed"),
    ]);
    const conversationRows = conversations.data ?? [];
    const appointmentRows = appointments.data ?? [];
    return {
      bookingRequests: conversationRows.length,
      appointmentsConfirmed: appointmentRows.filter((row) => !["cancelled", "no_show"].includes(row.status ?? "")).length,
      pendingConversations: conversationRows.filter((row) => ["new", "in_progress", "waiting_for_patient"].includes(row.status)).length,
      remindersScheduled: (reminders.data ?? []).length,
      failedMessages: (messages.data ?? []).length,
      templatesActive: (templates.data ?? []).filter((row) => row.status === "active").length,
    };
  },

  async getDepartments(clinicId) {
    const doctors = await supabaseWhatsAppService.getClinicDoctors(clinicId);
    const seen = new Map<ClinicDepartment, string>();
    for (const doctor of doctors) {
      if (!seen.has(doctor.department)) seen.set(doctor.department, departmentLabel(doctor.department));
    }
    return Array.from(seen.entries()).map(([id, label]) => ({ id, label }));
  },

  async getClinicDoctors(clinicId) {
    const scoped = await context(clinicId);
    const { data, error } = await supabase
      .from("doctor_profiles")
      .select("*, staff_profiles(full_name)")
      .eq("clinic_id", scoped.clinicId)
      .eq("status", "active");
    if (error) throw error;
    const rows = data ?? [];
    return Promise.all(
      rows.map(async (row): Promise<WhatsAppDoctor> => {
        const { data: slot } = await supabase
          .from("appointment_slots")
          .select("slot_date,start_time")
          .eq("doctor_id", row.id)
          .eq("status", "available")
          .gte("slot_date", new Date().toISOString().slice(0, 10))
          .order("slot_date", { ascending: true })
          .order("start_time", { ascending: true })
          .limit(1)
          .maybeSingle();
        return {
          id: row.id,
          name: row.staff_profiles?.full_name ?? "Doctor",
          qualification: row.qualification ?? "",
          department: normalizeDepartment(row.department),
          specialisation: row.specialization ?? row.department ?? "General",
          consultationFee: Number(row.consultation_fee ?? 0),
          nextAvailableSlot: slot ? `${slot.slot_date} ${String(slot.start_time).slice(0, 5)}` : "No open slot",
        };
      }),
    );
  },

  async getDoctorAvailability(doctorId, days = 7) {
    const { data, error } = await supabase.rpc("public_doctor_available_dates", { p_doctor_id: doctorId, p_days: days });
    if (error) throw error;
    const dates = Array.isArray(data) ? (data as RpcRow[]) : [];
    const withSlots = await Promise.all(
      dates
        .filter((date) => date.available)
        .map(async (date) => {
          const { data: slots, error: slotError } = await supabase.rpc("public_doctor_available_slots", { p_doctor_id: doctorId, p_date: String(date.date) });
          if (slotError) throw slotError;
          const rows = Array.isArray(slots) ? (slots as RpcRow[]) : [];
          return {
            date: String(date.date),
            label: String(date.label),
            slots: rows.filter((slot) => slot.status !== "booked").map((slot) => String(slot.label)),
          };
        }),
    );
    return { doctorId, dates: withSlots };
  },

  sendAppointmentPlaceholder: (input) => createPlaceholderMessage(input, "appointment"),
  sendPrescriptionPlaceholder: (input) => createPlaceholderMessage(input, "prescription"),
  sendReminderPlaceholder: (input) => createPlaceholderMessage(input, "reminder"),
  sendInvoicePlaceholder: (input) => createPlaceholderMessage(input, "invoice"),
};
