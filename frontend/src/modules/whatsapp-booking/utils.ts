import type { ClinicDepartment, WhatsAppConversationStatus, WhatsAppTemplateStatus } from "./types";
import { toneForStatus } from "../../utils/statusColors";

/** Turns a stored department key such as "general_medicine" into "General Medicine". */
export const departmentLabel = (department: ClinicDepartment | string) =>
  String(department).replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());

export const templateStatusLabel: Record<WhatsAppTemplateStatus, string> = { active: "Active", draft: "Draft", needs_api_approval: "Needs API approval", disabled: "Disabled" };
export const conversationStatusLabel: Record<WhatsAppConversationStatus, string> = { new: "New", in_progress: "In progress", appointment_confirmed: "Appointment Booked", waiting_for_patient: "Waiting for Patient", transferred_to_reception: "Transferred to Reception", closed: "Closed", failed: "Failed" };
export const statusTone = toneForStatus;

