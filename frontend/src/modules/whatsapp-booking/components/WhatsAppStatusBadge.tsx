import type { WhatsAppConversationStatus, WhatsAppTemplateStatus } from "../types";
import { conversationStatusLabel, statusTone, templateStatusLabel } from "../utils";
import { StatusBadge } from "../../../components/common/StatusBadge";
export function WhatsAppStatusBadge({ status }: { status: WhatsAppConversationStatus | WhatsAppTemplateStatus | "demo" | "connected" }) {
  if (status === "demo") return <StatusBadge tone="warning">WhatsApp not connected</StatusBadge>;
  if (status === "connected") return <StatusBadge tone="success">WhatsApp connected</StatusBadge>;
  const label = status in conversationStatusLabel ? conversationStatusLabel[status as WhatsAppConversationStatus] : templateStatusLabel[status as WhatsAppTemplateStatus];
  return <StatusBadge tone={statusTone(status)}>{label}</StatusBadge>;
}
