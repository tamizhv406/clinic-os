import { Button } from "../../../components/ui";
import type { Appointment, AppointmentStatus } from "../types";
import { ageGender, sourceLabel } from "../utils";
import { AppointmentStatusBadge, PaymentStatusBadge } from "./AppointmentStatusBadge";

export function AppointmentCard({ appointment, onStatusChange }: { appointment: Appointment; onStatusChange?: (id: string, status: AppointmentStatus) => void }) {
  return <div className="card p-4"><div className="flex items-start justify-between gap-4"><div><p className="text-xs font-semibold text-slate-400">{appointment.time} - Token {appointment.token}</p><h3 className="mt-1 font-semibold">{appointment.patientName}</h3><p className="text-xs text-slate-500">{ageGender(appointment.age, appointment.gender)} - {appointment.phone}</p></div><AppointmentStatusBadge status={appointment.status} /></div><div className="mt-4 grid gap-2 text-sm text-slate-600"><p><b className="text-slate-800">{appointment.doctorName}</b></p><p>{appointment.service} - Booked via {sourceLabel[appointment.source]}</p><PaymentStatusBadge status={appointment.paymentStatus} /></div><div className="mt-4 flex flex-wrap gap-2"><Button variant="secondary" className="min-h-8 px-3 py-1" onClick={() => onStatusChange?.(appointment.id, "arrived")}>Mark Arrived</Button><Button className="min-h-8 px-3 py-1" onClick={() => onStatusChange?.(appointment.id, "waiting")}>Send to Queue</Button></div></div>;
}
