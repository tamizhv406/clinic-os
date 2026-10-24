import type { AppointmentRecord, AppointmentStatus } from "../../shared/types/domain";
import type { Tables, TablesInsert } from "../../shared/types/database.types";

export type AppointmentFilters = Partial<Pick<AppointmentRecord, "clinicId" | "branchId" | "doctorId" | "patientId" | "status" | "source">>;
export type CreateAppointmentInput = Omit<AppointmentRecord, "id" | "tokenNumber"> & { tokenNumber?: string };
export interface AppointmentService {
  getAppointments(filters?: AppointmentFilters): Promise<AppointmentRecord[]>;
  getAppointmentById(id: string): Promise<AppointmentRecord>;
  getTodayAppointments(): Promise<AppointmentRecord[]>;
  getDoctorAppointments(doctorId: string): Promise<AppointmentRecord[]>;
  getQueue(): Promise<AppointmentRecord[]>;
  createAppointment(input: CreateAppointmentInput): Promise<AppointmentRecord>;
  bookAppointmentWithSlot(input: Record<string, unknown>): Promise<AppointmentRecord>;
  /**
   * Books a patient with a doctor by date (and optionally time), generating the
   * doctor's slots and the day's token number automatically.
   */
  bookForPatient(input: {
    patientId: string;
    doctorId: string;
    appointmentDate: string;
    appointmentTime?: string;
    slotId?: string;
    department?: string;
    mainProblem?: string;
    source?: string;
    isNewPatient?: boolean;
    metadata?: Record<string, unknown>;
  }): Promise<AppointmentRecord>;
  assignDoctor(appointmentId: string, doctorId: string, slotId: string): Promise<AppointmentRecord>;
  updateAppointmentStatus(id: string, status: AppointmentStatus): Promise<AppointmentRecord>;
  cancelAppointment(id: string, reason: string): Promise<AppointmentRecord>;
  getAppointmentStatusHistory(id: string): Promise<Tables<"appointment_status_history">[]>;
  createSlot(input: TablesInsert<"appointment_slots">): Promise<Tables<"appointment_slots">>;
}
