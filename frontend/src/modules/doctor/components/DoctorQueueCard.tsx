import { StatusBadge } from "../../../components/common/StatusBadge";
import { MessageCircle, Clock, User, Eye } from "lucide-react";
import { Button } from "../../../components/ui";
import type { DoctorQueueItem } from "../types";
import { ageGender } from "../utils";
import { formatTime12 } from "../../../utils/formatDate";
import { getAppointmentStatusLabel, getAppointmentStatusTone } from "../../../shared/utils/appointmentStatus";

export function DoctorQueueCard({ item }: { item: DoctorQueueItem }) {
  const isWhatsApp = item.source.toLowerCase() === "whatsapp";
  const isCheckedIn = ["arrived", "waiting", "in_consultation"].includes(item.status);
  const formattedTime = formatTime12(item.appointmentTime);

  return (
    <div className={`rounded-xl border bg-white p-4 shadow-card transition-shadow hover:shadow-md ${isWhatsApp ? "border-brand-200" : "border-slate-200"}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="rounded-lg bg-slate-900 px-2.5 py-1 text-xs font-bold tracking-wide text-white">
              {item.token || "No Token"}
            </span>
            {formattedTime && (
              <span className="flex items-center gap-1 text-xs font-semibold text-slate-600">
                <Clock className="size-3 text-slate-400" />
                {formattedTime}
              </span>
            )}
          </div>
          <h3 className="mt-2 font-['Manrope'] text-lg font-semibold text-slate-900">{item.patientName}</h3>
          <p className="text-xs text-slate-500">
            {ageGender(item.age, item.gender)} · {item.source}
          </p>
        </div>
        <StatusBadge tone={getAppointmentStatusTone(item.status)}>
          {getAppointmentStatusLabel(item.status, "compact")}
        </StatusBadge>
      </div>

      {isWhatsApp && (
        <div className="mt-3 flex flex-wrap gap-2">
          <StatusBadge tone="info">
            <MessageCircle className="size-3" /> WhatsApp booking
          </StatusBadge>
          {item.department && <StatusBadge>{item.department.replace("_", " ")}</StatusBadge>}
          <StatusBadge tone={item.isNewPatient ? "info" : "neutral"}>
            {item.isNewPatient ? "New patient" : "Existing patient"}
          </StatusBadge>
        </div>
      )}

      {(item.mainProblem || item.reason) && (
        <p className="mt-3 rounded-lg bg-slate-50 p-2.5 text-xs text-slate-700">
          <strong className="text-slate-900">Reason:</strong> {item.mainProblem ?? item.reason}
        </p>
      )}

      {isCheckedIn && item.waitingMinutes > 0 && (
        <p className="mt-2 text-xs font-medium text-warning-700">
          ⏱️ {item.waitingMinutes} mins waiting
        </p>
      )}

      {!isCheckedIn && item.status === "booked" && (
        <p className="mt-2 text-xs font-medium text-slate-500">
          ⏳ Awaiting check-in at reception
        </p>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100">
        {isCheckedIn ? (
          <Button
            to={`/doctor/consultation/${item.patientId}${item.appointmentId ? `?appointmentId=${item.appointmentId}` : ""}`}
            className="flex-1 min-w-[140px]"
          >
            {item.status === "in_consultation" ? "Resume Consultation" : "Start Consultation"}
          </Button>
        ) : (
          <Button
            to={`/doctor/patient/${item.patientId}`}
            variant="secondary"
            className="flex-1 min-w-[140px]"
            icon={<Eye className="size-4" />}
          >
            View Patient
          </Button>
        )}

        <Button to={`/doctor/patient/${item.patientId}`} variant="secondary" icon={<User className="size-3.5" />}>
          Profile
        </Button>
        <Button to={`/doctor/prescription/${item.patientId}`} variant="ghost">
          Rx
        </Button>
      </div>
    </div>
  );
}
