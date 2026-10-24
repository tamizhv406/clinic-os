import type { PaymentMode } from "../types";
import { paymentModeLabel } from "../utils";
import { StatusBadge } from "../../../components/common/StatusBadge";
export function PaymentModeBadge({ mode }: { mode: PaymentMode }) { return <StatusBadge>{paymentModeLabel[mode]}</StatusBadge>; }

