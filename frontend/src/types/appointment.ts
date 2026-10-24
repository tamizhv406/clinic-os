export type AppointmentStatus = "booked" | "arrived" | "waiting" | "in_consultation" | "completed" | "cancelled" | "no_show";
export interface Appointment { id: string; token: number; patientId: string; patientName: string; doctorId: string; doctorName: string; time: string; date: string; status: AppointmentStatus; reason: string; waitingMinutes?: number; }
