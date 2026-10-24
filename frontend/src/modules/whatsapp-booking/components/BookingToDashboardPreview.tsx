import { Card } from "../../../components/ui";
import type { WhatsAppConfirmedAppointment } from "../types";

export function BookingToDashboardPreview({ appointment }: { appointment: WhatsAppConfirmedAppointment }) {
  return <Card className="p-4"><p className="font-semibold">Appears in clinic dashboards</p><p className="mt-2 text-sm text-slate-600">Reception queue and doctor queue receive appointment {appointment.appointmentId} from WhatsApp.</p></Card>;
}
