import type { StatusTone } from "../../components/common/StatusBadge";
import { toneForStatus } from "../../utils/statusColors";
import type { DoctorQueueStatus, FollowUpStatus, PatientTag } from "./types";
export const queueStatusLabel: Record<DoctorQueueStatus, string> = { waiting: "Waiting", in_consultation: "In consultation", completed: "Completed", no_show: "No-show" };
export const followUpStatusLabel: Record<FollowUpStatus, string> = { due_today: "Due today", upcoming: "Upcoming", overdue: "Overdue", completed: "Completed" };
export const ageGender = (age: number, gender: string) => `${age} yrs · ${gender}`;
export const tagTone = (tag: PatientTag): StatusTone => toneForStatus(tag);
