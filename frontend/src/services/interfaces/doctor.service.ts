import type { ConsultationRecord, DoctorAvailabilityRecord, PrescriptionRecord, ReminderRecord } from "../../shared/types/domain";
import type { Tables, TablesInsert, TablesUpdate } from "../../shared/types/database.types";
import type { FollowUp, MedicineReminderSchedule, PatientProfile, PatientTimelineItem, Prescription } from "../../modules/doctor/types";

export type ConsultationFilters = {
  clinicId?: string;
  patientId?: string;
  doctorId?: string;
  appointmentId?: string;
  status?: string;
};

export type PrescriptionFilters = {
  clinicId?: string;
  patientId?: string;
  consultationId?: string;
  appointmentId?: string;
  doctorId?: string;
  status?: string;
  deliveryStatus?: string;
  pharmacyStatus?: string;
};

export type CreatePrescriptionWithItemsInput = {
  prescription: TablesInsert<"prescriptions">;
  items: Array<Omit<TablesInsert<"prescription_items">, "clinic_id" | "prescription_id"> & Partial<Pick<TablesInsert<"prescription_items">, "clinic_id" | "prescription_id">>>;
  reminderConsentConfirmed?: boolean;
};

export type PrescriptionWithItemsResult = {
  prescription: Tables<"prescriptions">;
  items: Tables<"prescription_items">[];
};

export interface DoctorDomainService {
  getDoctorProfiles(): Promise<Tables<"doctor_profiles">[]>;
  getDoctorProfileByStaffId(staffId: string): Promise<Tables<"doctor_profiles"> | null>;
  getDoctorAvailability(doctorId: string): Promise<DoctorAvailabilityRecord[]>;
  updateDoctorAvailability(doctorId: string, input: TablesInsert<"doctor_availability">[]): Promise<Tables<"doctor_availability">[]>;
  getDoctorBlockedDates(doctorId: string): Promise<Tables<"doctor_blocked_dates">[]>;
  blockDoctorDate(input: TablesInsert<"doctor_blocked_dates">): Promise<Tables<"doctor_blocked_dates">>;
  getAvailableSlots(doctorId: string, date: string): Promise<Tables<"appointment_slots">[]>;
  generateSlotsForDoctor(doctorId: string, dateOrRange: string | { from: string; to: string }): Promise<Tables<"appointment_slots">[]>;
  getConsultations(filters?: string | ConsultationFilters): Promise<ConsultationRecord[]>;
  getConsultationById(id: string): Promise<Tables<"consultations">>;
  getConsultationsByPatient(patientId: string): Promise<Tables<"consultations">[]>;
  getConsultationByAppointment(appointmentId: string): Promise<Tables<"consultations"> | null>;
  createConsultation(input: TablesInsert<"consultations">): Promise<Tables<"consultations">>;
  updateConsultation(id: string, input: TablesUpdate<"consultations">): Promise<Tables<"consultations">>;
  completeConsultation(id: string): Promise<Tables<"consultations">>;
  saveVitals(input: TablesInsert<"consultation_vitals">): Promise<Tables<"consultation_vitals">>;
  getVitals(consultationId: string): Promise<Tables<"consultation_vitals">[]>;
  addConsultationNote(input: TablesInsert<"consultation_notes">): Promise<Tables<"consultation_notes">>;
  getConsultationNotes(consultationId: string): Promise<Tables<"consultation_notes">[]>;
  getPrescriptions(filters?: string | PrescriptionFilters): Promise<PrescriptionRecord[]>;
  getPrescriptionById(id: string): Promise<PrescriptionWithItemsResult | null>;
  getPrescriptionsByPatient(patientId: string): Promise<PrescriptionRecord[]>;
  getPrescriptionsByConsultation(consultationId: string): Promise<PrescriptionRecord[]>;
  createPrescription(input: TablesInsert<"prescriptions">): Promise<Tables<"prescriptions">>;
  updatePrescription(id: string, input: TablesUpdate<"prescriptions">): Promise<Tables<"prescriptions">>;
  createPrescriptionWithItems(input: CreatePrescriptionWithItemsInput): Promise<PrescriptionWithItemsResult>;
  updatePrescriptionDeliveryStatus(id: string, status: string, message?: string): Promise<Tables<"prescriptions">>;
  routePrescriptionToPharmacy(id: string): Promise<Tables<"prescriptions">>;
  sendPrescriptionToPatientPlaceholder(id: string): Promise<Tables<"prescriptions">>;
  sendPrescriptionToWhatsApp(prescriptionId: string): Promise<PrescriptionRecord>;
  getMedicineReminders(patientId?: string): Promise<ReminderRecord[]>;
  createMedicineReminderSchedule(input: TablesInsert<"medicine_reminders">): Promise<Tables<"medicine_reminders">>;
  updateReminderStatus(id: string, status: string): Promise<Tables<"medicine_reminders">>;
  getReminders(patientId?: string): Promise<ReminderRecord[]>;
  /** Clinical follow-ups derived from completed consultations that carry a follow-up date. */
  getFollowUps(doctorId?: string): Promise<FollowUp[]>;
  /** Active medicine reminders grouped per patient for the reminders screen. */
  getMedicineReminderSchedules(doctorId?: string): Promise<MedicineReminderSchedule[]>;
  /** Patient snapshot enriched with visit counts, allergies and pending balance. */
  getPatientProfile(patientId: string): Promise<PatientProfile>;
  /** Visit history for the patient history panel. */
  getPatientTimeline(patientId: string): Promise<PatientTimelineItem[]>;
  /** Past prescriptions rendered in the patient history panel. */
  getPatientPrescriptionHistory(patientId: string): Promise<Prescription[]>;
}
