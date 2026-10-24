export type AppointmentStatus = "booked" | "arrived" | "waiting" | "in_consultation" | "completed" | "cancelled" | "no_show";
export type AppointmentSource = "walk_in" | "phone_call" | "qr_booking" | "whatsapp" | "website";
export type PaymentStatus = "paid" | "pending" | "partial";
export type PaymentMode = "cash" | "upi" | "card" | "online_link";
export type Gender = "female" | "male" | "other";

export type ReceptionStats = {
  todayAppointments: number;
  waitingPatients: number;
  inConsultation: number;
  completed: number;
  cancelledNoShow: number;
  pendingBills: number;
  activeDoctors: number;
};

export type DoctorOption = { id: string; name: string; specialization: string; available: boolean };
export type ServiceOption = { id: string; name: string; amount: number; duration: string };
export type TimeSlot = { id: string; label: string; available: boolean };

export type Appointment = {
  id: string;
  token: string;
  patientId: string;
  patientName: string;
  phone: string;
  age: number;
  gender: Gender;
  doctorId: string;
  doctorName: string;
  service: string;
  date: string;
  time: string;
  source: AppointmentSource;
  status: AppointmentStatus;
  paymentStatus: PaymentStatus;
  notes?: string;
};

export type QueueItem = Pick<Appointment, "id" | "token" | "patientName" | "age" | "gender" | "doctorName" | "service" | "status"> & {
  arrivalTime: string;
  waitingMinutes: number;
  reason: string;
};

export type PatientRegistrationInput = {
  fullName: string;
  phone: string;
  age: number;
  gender: Gender | "";
  dateOfBirth?: string;
  bloodGroup?: string;
  address?: string;
  city?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  allergies?: string;
  existingConditions?: string;
  currentMedications?: string;
  historyNotes?: string;
  reasonForVisit?: string;
  preferredDoctor?: string;
  appointmentSource?: AppointmentSource;
  notes?: string;
  tags: string[];
};

export type BillingShortcut = {
  id: string;
  patientName: string;
  service: string;
  amount: number;
  discount: number;
  paymentMode: PaymentMode;
  paymentStatus: PaymentStatus;
  doctorName: string;
  completedAt: string;
};
