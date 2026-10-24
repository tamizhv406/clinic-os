import { Card } from "../../../components/ui";
import type { WhatsAppConversation } from "../types";

export function WhatsAppConversationCard({ conversation }: { conversation: WhatsAppConversation }) {
  return <Card className="p-4"><b>{conversation.patientName ?? conversation.phone}</b><p className="mt-1 text-sm text-slate-500">{conversation.currentStep} - {conversation.lastMessage}</p></Card>;
}
