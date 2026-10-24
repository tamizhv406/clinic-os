import type { PaymentStatus, RefundStatus } from "../types";
import { paymentStatusLabel, refundStatusLabel } from "../utils";
import { StatusBadge } from "../../../components/common/StatusBadge";
import { toneForStatus } from "../../../utils/statusColors";
export function PaymentStatusBadge({ status }: { status: PaymentStatus }) { return <StatusBadge tone={toneForStatus(status)}>{paymentStatusLabel[status]}</StatusBadge>; }
export function RefundStatusBadge({ status }: { status: RefundStatus }) { return <StatusBadge tone={toneForStatus(status)}>{refundStatusLabel[status]}</StatusBadge>; }
