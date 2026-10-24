import type { DoctorQueueStatus, FollowUpStatus, PatientTag } from "../types";
import { followUpStatusLabel, queueStatusLabel } from "../utils";
import { StatusBadge } from "../../../components/common/StatusBadge";
import { toneForStatus } from "../../../utils/statusColors";
export function QueueStatusBadge({ status }: { status: DoctorQueueStatus }) { return <StatusBadge tone={toneForStatus(status)}>{queueStatusLabel[status]}</StatusBadge>; }
export function FollowUpStatusBadge({ status }: { status: FollowUpStatus }) { return <StatusBadge tone={toneForStatus(status)}>{followUpStatusLabel[status]}</StatusBadge>; }
export function PatientTagBadge({ tag }: { tag: PatientTag }) { return <StatusBadge tone={toneForStatus(tag)}>{tag}</StatusBadge>; }
