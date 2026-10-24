export type PatientSource = "whatsapp" | "qr" | "website" | "phone" | "walk_in" | "reception";
export interface Patient {
  id: string;
  patientId?: string;
  name: string;
  fullName?: string;
  phone: string;
  whatsappNumber?: string;
  age: number;
  gender: "Male" | "Female" | "Other" | "male" | "female" | "other";
  dateOfBirth?: string;
  department?: string;
  mainProblem?: string;
  bloodGroup?: string;
  lastVisit?: string;
  visits: number;
  allergies?: string[];
  medicalHistory?: string[];
  existingConditions?: string[];
  currentMedications?: string[];
  emergencyContact?: string;
  appointmentHistory?: string[];
  prescriptionHistory?: string[];
  followUps?: string[];
  reminderConsent?: boolean;
  whatsappConsent?: boolean;
  source?: PatientSource;
}
export interface FollowUp { id: string; patientId: string; patientName: string; dueDate: string; reason: string; status: "due" | "scheduled" | "completed"; }
