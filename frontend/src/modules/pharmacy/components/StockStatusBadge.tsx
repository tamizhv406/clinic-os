import type { PaymentStatus, PrescriptionStatus, StockStatus } from "../types";
import { paymentLabel, rxStatusLabel, stockLabel } from "../utils";
import { StatusBadge } from "../../../components/common/StatusBadge";
import { toneForStatus } from "../../../utils/statusColors";
export function StockStatusBadge({ status }: { status: StockStatus }) { return <StatusBadge tone={toneForStatus(status)}>{stockLabel[status]}</StatusBadge>; }
export function PrescriptionStatusBadge({ status }: { status: PrescriptionStatus }) { return <StatusBadge tone={toneForStatus(status)}>{rxStatusLabel[status]}</StatusBadge>; }
export function PharmacyPaymentBadge({ status }: { status: PaymentStatus }) { return <StatusBadge tone={toneForStatus(status)}>{paymentLabel[status]}</StatusBadge>; }
