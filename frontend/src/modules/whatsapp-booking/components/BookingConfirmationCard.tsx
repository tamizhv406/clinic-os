import { Card } from "../../../components/ui";
import { departmentLabel } from "../utils";
import type { WhatsAppConfirmedAppointment } from "../types";

export function BookingConfirmationCard({ appointment }: { appointment: WhatsAppConfirmedAppointment }) {
  return <Card className="p-4"><p className="text-xs font-semibold uppercase text-slate-400">Booking summary before confirm</p><h3 className="mt-1 font-semibold">{appointment.patientName} - Token {appointment.tokenNumber}</h3><p className="mt-2 text-sm text-slate-600">{appointment.doctorName} - {departmentLabel(appointment.department)} - {appointment.appointmentDate} at {appointment.appointmentTime}</p><p className="mt-2 rounded-xl bg-slate-50 p-3 text-sm font-semibold text-slate-700">{appointment.mainProblem}</p></Card>;
}
