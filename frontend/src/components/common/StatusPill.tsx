import { StatusBadge } from "./StatusBadge";
import { toneForStatus } from "../../utils/statusColors";
export function StatusPill({ status }: { status: string }) { return <StatusBadge tone={toneForStatus(status)}>{status.replaceAll("_", " ")}</StatusBadge>; }
