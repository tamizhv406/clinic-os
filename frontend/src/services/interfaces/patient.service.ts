import type { PatientRecord } from "../../shared/types/domain";
import type { Tables, TablesInsert, TablesUpdate } from "../../shared/types/database.types";

export type PatientFilters = {
  clinicId?: string;
  branchId?: string;
  status?: string;
  query?: string;
};

export interface PatientService {
  getPatients(filters?: string | PatientFilters): Promise<PatientRecord[]>;
  getPatientById(id: string): Promise<PatientRecord>;
  /** Batch name lookup for list screens -- one query instead of one per id. */
  getPatientNames(ids: string[]): Promise<Map<string, string>>;
  searchPatients(query: string): Promise<PatientRecord[]>;
  findPatientByPhone(phone: string): Promise<PatientRecord | null>;
  findByWhatsAppNumber(number: string): Promise<PatientRecord | null>;
  findPatientByWhatsAppNumber(number: string): Promise<PatientRecord | null>;
  createPatient(input: Omit<PatientRecord, "id" | "patientId">): Promise<PatientRecord>;
  updatePatient(id: string, input: TablesUpdate<"patients">): Promise<PatientRecord>;
  archivePatient(id: string): Promise<PatientRecord>;
  getPatientFamilyMembers(patientId: string): Promise<Tables<"patient_family_members">[]>;
  linkFamilyMember(input: TablesInsert<"patient_family_members">): Promise<Tables<"patient_family_members">>;
  getPatientNotes(patientId: string): Promise<Tables<"patient_notes">[]>;
  addPatientNote(input: TablesInsert<"patient_notes">): Promise<Tables<"patient_notes">>;
}
