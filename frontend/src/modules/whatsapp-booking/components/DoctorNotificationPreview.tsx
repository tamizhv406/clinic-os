import { Bell } from "lucide-react";
import { Card } from "../../../components/ui";
import { departmentLabel } from "../utils";
import type { WhatsAppConfirmedAppointment } from "../types";

export function DoctorNotificationPreview({ appointment }: { appointment: WhatsAppConfirmedAppointment }) {
  return <Card className="border-info-200 bg-info-50 p-4"><div className="flex gap-4"><Bell className="size-5 text-info-700" /><div><p className="font-semibold">New WhatsApp Appointment</p><p className="text-sm text-slate-700">{appointment.patientName} - {departmentLabel(appointment.department)} - {appointment.appointmentTime}</p><p className="mt-1 text-xs text-info-700">{appointment.mainProblem}</p></div></div></Card>;
}
