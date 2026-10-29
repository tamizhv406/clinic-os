import type { StatusTone } from "../../components/common/StatusBadge";
import { toneForStatus } from "../../utils/statusColors";
import type { DoctorQueueStatus, FollowUpStatus, PatientTag } from "./types";
import { shortStatusLabels } from "../../shared/utils/appointmentStatus";

export const queueStatusLabel: Record<DoctorQueueStatus, string> = shortStatusLabels;
export const followUpStatusLabel: Record<FollowUpStatus, string> = { due_today: "Due today", upcoming: "Upcoming", overdue: "Overdue", completed: "Completed" };
export const ageGender = (age: number, gender: string) => `${age} yrs · ${gender}`;
export const tagTone = (tag: PatientTag): StatusTone => toneForStatus(tag);
