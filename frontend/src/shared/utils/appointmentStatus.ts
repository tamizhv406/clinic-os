import type { AppointmentStatus } from "../types/domain";
import type { StatusTone } from "../../components/common/StatusBadge";

/** Detailed patient-facing wording required by Task 1 */
export const patientStatusLabels: Record<AppointmentStatus, string> = {
  booked: "Booked - your slot is reserved",
  arrived: "Checked in - waiting",
  waiting: "Checked in - waiting",
  in_consultation: "With the doctor",
  completed: "Completed",
  cancelled: "Cancelled",
  no_show: "Missed",
};

/** Compact staff/table-facing wording */
export const shortStatusLabels: Record<AppointmentStatus, string> = {
  booked: "Booked",
  arrived: "Checked in",
  waiting: "Waiting",
  in_consultation: "With doctor",
  completed: "Completed",
  cancelled: "Cancelled",
  no_show: "Missed",
};

/**
 * Returns the human-readable appointment status label.
 * @param status Appointment status string
 * @param variant 'patient' for full explanatory text, 'compact' for badges/tables
 */
export function getAppointmentStatusLabel(
  status: string | null | undefined,
  variant: "patient" | "compact" = "compact"
): string {
  const normalized = (status ?? "booked").toLowerCase() as AppointmentStatus;
  const labels = variant === "patient" ? patientStatusLabels : shortStatusLabels;
  return labels[normalized] ?? (status ? status.replace(/_/g, " ") : "Booked");
}

/**
 * Visual badge tone mapping:
 * - Booked: positive/calm info tone
 * - Checked in / Waiting: attention warning tone
 * - In consultation: active brand tone
 * - Completed: success tone
 * - Cancelled: distinct danger/muted tone
 * - Missed: muted neutral tone
 */
export function getAppointmentStatusTone(status: string | null | undefined): StatusTone {
  const normalized = (status ?? "booked").toLowerCase();
  switch (normalized) {
    case "completed":
      return "success";
    case "booked":
      return "info";
    case "arrived":
    case "waiting":
      return "warning";
    case "in_consultation":
      return "brand";
    case "cancelled":
      return "danger";
    case "no_show":
    default:
      return "neutral";
  }
}

