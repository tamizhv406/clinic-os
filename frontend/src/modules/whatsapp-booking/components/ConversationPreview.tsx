import { useState } from "react";
import { Button, Textarea } from "../../../components/ui";
import type { WhatsAppConversation } from "../types";
import { ChatSimulator } from "./ChatSimulator";
import { WhatsAppBookingSummary } from "./WhatsAppBookingSummary";

export function ConversationPreview({ conversation, onTransfer, onCloseConversation, onSendPlaceholder, loading = false }: { conversation: WhatsAppConversation; onTransfer?: () => void; onCloseConversation?: () => void; onSendPlaceholder?: (body: string) => void; loading?: boolean }) {
  const [body, setBody] = useState("Write a message to send.");
  return <div className="space-y-4"><div><h3 className="font-semibold">{conversation.patientName || conversation.phone}</h3><p className="text-sm text-slate-500">{conversation.phone} - {conversation.currentStep}</p></div><ChatSimulator compact messages={conversation.messages} />{conversation.bookingSummary && <WhatsAppBookingSummary summary={conversation.bookingSummary} />}<Textarea aria-label="Message body" value={body} onChange={(event) => setBody(event.target.value)} /><div className="flex flex-wrap gap-2"><Button loading={loading} disabled={!onTransfer} onClick={onTransfer}>Transfer to Reception</Button><Button loading={loading} disabled={!onCloseConversation} variant="secondary" onClick={onCloseConversation}>Mark Closed</Button><Button variant="secondary" to="/reception/appointments">Create Appointment</Button><Button loading={loading} disabled={!onSendPlaceholder} variant="secondary" onClick={() => onSendPlaceholder?.(body)}>Send Reminder</Button><Button variant="ghost" disabled={!onSendPlaceholder} onClick={() => onSendPlaceholder?.(body)}>Retry Failed Message</Button></div></div>;
}

