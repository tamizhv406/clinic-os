export type DoctorQueueStatus = "booked" | "arrived" | "waiting" | "in_consultation" | "completed" | "cancelled" | "no_show";
export type FollowUpStatus = "due_today" | "upcoming" | "overdue" | "completed";
export type PatientTag = "New Patient" | "Follow-up" | "Regular" | "Senior Citizen" | "Child" | "VIP";
export type DiagnosisType = "provisional" | "final";
export type WhatsAppDeliveryStatus = "queued" | "sent" | "delivered" | "read" | "failed";
export type ReminderStatus = "active" | "paused" | "completed" | "cancelled";
export type ReminderFrequency = "once_daily" | "twice_daily" | "three_times_daily" | "four_times_daily" | "custom";
export type PatientResponseStatus = "confirmed" | "wants_reschedule" | "no_response" | "cancelled";

export type DoctorStats = {
  todayTotal: number;
  checkedIn: number;
  waitingPatients: number;
  inConsultation: number;
  completedToday: number;
  upcomingThisWeek: number;
  followUpsDue?: number;
  averageWaitingTime?: number;
  prescriptionsSent?: number;
};

export type DoctorQueueItem = {
  id: string;
  token: string;
  appointmentId?: string;
  tokenNumber?: string;
  patientId: string;
  patientName: string;
  phone?: string;
  whatsappNumber?: string;
  age: number;
  gender: "female" | "male" | "other";
  department?: string;
  doctorId?: string;
  doctorName?: string;
  appointmentDate?: string;
  appointmentTime?: string;
  mainProblem?: string;
  reason: string;
  source: string;
  waitingMinutes: number;
  previousVisit: boolean;
  isNewPatient?: boolean;
  reminderStatus?: string;
  tags: PatientTag[];
  status: DoctorQueueStatus;
};

export type PatientProfile = { id: string; name: string; phone: string; age: number; gender: string; bloodGroup: string; tags: PatientTag[]; lastVisit: string; allergies: string[]; conditions: string[]; medications: string[]; emergencyContact: string; totalVisits: number; pendingPayment: boolean; internalNotes: string };
export type PatientTimelineItem = { id: string; date: string; doctor: string; diagnosis: string; prescriptionSummary: string; followUpStatus: string; paymentStatus: string };
export type Vitals = { temperature?: string; bp?: string; pulse?: string; weight?: string; height?: string; spo2?: string; sugar?: string };
export type Diagnosis = { name: string; notes?: string; type: DiagnosisType };
export type ClinicalNote = { examination?: string; advice?: string; lifestyle?: string; labTests?: string; procedure?: string };
export type ConsultationFormInput = { mainComplaint: string; symptoms?: string; duration?: string; severity?: string; notes?: string; vitals: Vitals; diagnosis: Diagnosis; clinicalNote: ClinicalNote; followUpRequired: boolean; followUpDate?: string; followUpReason?: string };
export type Medicine = { id: string; name: string; form: string };
/** medicineId is set when the name was picked from the clinic's catalogue. */
export type PrescriptionItem = { id: string; medicineName: string; medicineId?: string; dosage: string; frequency: string; timing: string; duration: string; instructions?: string; quantity?: string };
export type Prescription = { id: string; patientId: string; doctorName: string; diagnosis: string; date: string; items: PrescriptionItem[]; advice?: string; dietAdvice?: string; avoidItems?: string; restNote?: string; labTests: string[]; followUpDate?: string; whatsappDeliveryStatus?: WhatsAppDeliveryStatus };
export type PrescriptionTemplate = { id: string; name: string; medicines: PrescriptionItem[]; advice: string };
export type LabTest = { id: string; name: string; selected?: boolean };
export type FollowUp = { id: string; patientId: string; patientName: string; phone: string; lastDiagnosis: string; followUpDate: string; reason: string; status: FollowUpStatus; reminderStatus: string; whatsappDeliveryStatus?: WhatsAppDeliveryStatus; sentDate?: string; patientResponseStatus?: PatientResponseStatus };
export type DaySchedule = { day: string; enabled: boolean; startTime: string; endTime: string; breakTime: string; slotDurationMinutes: number; maxAppointmentsPerSlot: number; maxAppointmentsPerDay: number };
export type DoctorAvailability = { doctorId: string; weekly: DaySchedule[]; blockedDates: { date: string; reason: string; emergencyLeave?: boolean }[] };
export type MedicineReminderSchedule = { id: string; patientName: string; phone: string; prescriptionId: string; activeMedicines: string[]; nextReminder: string; duration: string; consent: "confirmed" | "not_received"; status: ReminderStatus };
export type MedicineReminderInput = { medicineName: string; dosage: string; frequency: ReminderFrequency; morningTime?: string; afternoonTime?: string; eveningTime?: string; nightTime?: string; foodTiming: "before_food" | "after_food"; startDate: string; endDate: string; enabled: boolean };
