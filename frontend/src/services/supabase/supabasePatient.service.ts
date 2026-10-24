import { supabase } from "../../lib/supabaseClient";
import type { PatientRecord } from "../../shared/types/domain";
import type { Tables, TablesInsert } from "../../shared/types/database.types";
import type { PatientFilters, PatientService } from "../interfaces";
import { logAuditEvent } from "./auditLogger";
import { supabaseAuthService } from "./supabaseAuth.service";

type PatientRow = Tables<"patients">;

const splitText = (value: string | null) => value ? value.split(/\r?\n|,/).map((item) => item.trim()).filter(Boolean) : [];
const joinText = (value?: string[]) => value?.filter(Boolean).join("\n") ?? "";

function mapPatient(row: PatientRow): PatientRecord {
  return {
    id: row.id,
    patientId: row.patient_code ?? row.id,
    clinicId: row.clinic_id,
    branchId: row.branch_id ?? "",
    fullName: row.full_name,
    phone: row.phone,
    whatsappNumber: row.whatsapp_number ?? "",
    age: row.age ?? 0,
    gender: (row.gender ?? "other") as PatientRecord["gender"],
    source: (row.source ?? "reception") as PatientRecord["source"],
    allergies: splitText(row.allergies),
    medicalHistory: splitText(row.medical_history),
    currentMedications: splitText(row.current_medications),
    whatsappConsent: row.whatsapp_consent ?? false,
    reminderConsent: row.reminder_consent ?? false,
  };
}

function normalizeFilters(filters?: string | PatientFilters): PatientFilters {
  return typeof filters === "string" ? { clinicId: filters } : filters ?? {};
}

function cleanSearch(query: string) {
  return query.replace(/[%_,]/g, " ").trim();
}

async function currentStaffContext() {
  return supabaseAuthService.getCurrentAuthContext();
}

export const supabasePatientService: PatientService = {
  async getPatients(filters) {
    const normalized = normalizeFilters(filters);
    let query = supabase.from("patients").select("*").order("created_at", { ascending: false });
    if (normalized.clinicId) query = query.eq("clinic_id", normalized.clinicId);
    if (normalized.branchId) query = query.eq("branch_id", normalized.branchId);
    if (normalized.status) query = query.eq("status", normalized.status);
    if (normalized.query) {
      const search = cleanSearch(normalized.query);
      if (search) query = query.or(`full_name.ilike.%${search}%,phone.ilike.%${search}%,whatsapp_number.ilike.%${search}%,patient_code.ilike.%${search}%`);
    }
    const { data, error } = await query;
    if (error) throw error;
    return (data ?? []).map(mapPatient);
  },

  async getPatientById(id) {
    const { data, error } = await supabase.from("patients").select("*").eq("id", id).single();
    if (error) throw error;
    return mapPatient(data);
  },

  async getPatientNames(ids) {
    const unique = Array.from(new Set(ids.filter(Boolean)));
    if (unique.length === 0) return new Map<string, string>();
    const { data, error } = await supabase.from("patients").select("id, full_name").in("id", unique);
    if (error) throw error;
    return new Map((data ?? []).map((row) => [row.id, row.full_name]));
  },

  searchPatients(query) {
    return this.getPatients({ query });
  },

  async findPatientByPhone(phone) {
    const { data, error } = await supabase.from("patients").select("*").eq("phone", phone).maybeSingle();
    if (error) throw error;
    return data ? mapPatient(data) : null;
  },

  async findByWhatsAppNumber(number) {
    return this.findPatientByWhatsAppNumber(number);
  },

  async findPatientByWhatsAppNumber(number) {
    const { data, error } = await supabase.from("patients").select("*").eq("whatsapp_number", number).maybeSingle();
    if (error) throw error;
    return data ? mapPatient(data) : null;
  },

  async createPatient(input) {
    const context = await currentStaffContext();
    if (!context.clinic_id && context.role_key !== "super_admin") throw new Error("Cannot create patient without clinic context.");
    const patientInput: TablesInsert<"patients"> = {
      clinic_id: input.clinicId || context.clinic_id || "",
      branch_id: input.branchId || context.branch_id || null,
      patient_code: `P-${Date.now()}`,
      full_name: input.fullName,
      phone: input.phone,
      whatsapp_number: input.whatsappNumber || null,
      age: input.age || null,
      gender: input.gender,
      source: input.source,
      allergies: joinText(input.allergies),
      medical_history: joinText(input.medicalHistory),
      current_medications: joinText(input.currentMedications),
      whatsapp_consent: input.whatsappConsent,
      reminder_consent: input.reminderConsent,
      created_by: context.staffProfileId,
      status: "active",
    };
    const { data, error } = await supabase.from("patients").insert(patientInput).select("*").single();
    if (error) throw error;
    logAuditEvent({ clinicId: data.clinic_id, branchId: data.branch_id, eventType: "patient_created", entityType: "patients", entityId: data.id, action: "create", status: "success", severity: "info", message: "Patient created.", metadata: { source: data.source } });
    return mapPatient(data);
  },

  async updatePatient(id, input) {
    const { data, error } = await supabase.from("patients").update(input).eq("id", id).select("*").single();
    if (error) throw error;
    logAuditEvent({ clinicId: data.clinic_id, branchId: data.branch_id, eventType: "patient_updated", entityType: "patients", entityId: data.id, action: "update", status: "success", severity: "info", message: "Patient updated." });
    return mapPatient(data);
  },

  async archivePatient(id) {
    const { data, error } = await supabase.from("patients").update({ status: "archived" }).eq("id", id).select("*").single();
    if (error) throw error;
    return mapPatient(data);
  },

  async getPatientFamilyMembers(patientId) {
    const { data, error } = await supabase.from("patient_family_members").select("*").eq("primary_patient_id", patientId).order("created_at", { ascending: false });
    if (error) throw error;
    return data ?? [];
  },

  async linkFamilyMember(input) {
    const context = await currentStaffContext();
    const { data, error } = await supabase.from("patient_family_members").insert({ ...input, clinic_id: input.clinic_id || context.clinic_id || "" }).select("*").single();
    if (error) throw error;
    return data;
  },

  async getPatientNotes(patientId) {
    const { data, error } = await supabase.from("patient_notes").select("*").eq("patient_id", patientId).order("created_at", { ascending: false });
    if (error) throw error;
    return data ?? [];
  },

  async addPatientNote(input) {
    const context = await currentStaffContext();
    const { data, error } = await supabase.from("patient_notes").insert({ ...input, clinic_id: input.clinic_id || context.clinic_id || "", created_by: input.created_by || context.staffProfileId }).select("*").single();
    if (error) throw error;
    return data;
  },
};
