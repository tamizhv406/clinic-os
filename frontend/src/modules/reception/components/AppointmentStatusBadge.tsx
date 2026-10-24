import type { AppointmentStatus, PaymentStatus } from "../types";
import { appointmentStatusLabel, paymentLabel } from "../utils";
import { StatusBadge } from "../../../components/common/StatusBadge";
import { toneForStatus } from "../../../utils/statusColors";
export function AppointmentStatusBadge({ status }: { status: AppointmentStatus }) { return <StatusBadge tone={toneForStatus(status)}>{appointmentStatusLabel[status]}</StatusBadge>; }
export function PaymentStatusBadge({ status }: { status: PaymentStatus }) { return <StatusBadge tone={toneForStatus(status)}>{paymentLabel[status]}</StatusBadge>; }
