import { toast } from "sonner";
import { Button } from "../../../components/ui";
import type { WhatsAppMessage } from "../types";
import { ChatBubble } from "./ChatBubble";

export function ChatSimulator({ messages, compact = false, clinicName = "Clinic" }: { messages: WhatsAppMessage[]; compact?: boolean; clinicName?: string }) {
  const copyTranscript = async () => {
    const text = messages.map((message) => `${message.sender === "patient" ? "Patient" : "Clinic"}: ${message.text}`).join("\n");
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Conversation copied to clipboard.");
    } catch {
      toast.error("Your browser blocked clipboard access.");
    }
  };

  return <section className="overflow-hidden rounded-card border bg-brand-50">
    <div className="flex items-center justify-between bg-brand-900 px-4 py-3 text-white">
      <div><b>{clinicName}</b><p className="text-xs text-brand-100">WhatsApp booking conversation</p></div>
    </div>
    <div className={`space-y-3 overflow-y-auto p-4 ${compact ? "max-h-72" : "max-h-[min(620px,70vh)]"}`}>
      {messages.map((message) => <ChatBubble key={message.id} message={message} />)}
    </div>
    {!compact && <div className="sticky bottom-0 flex flex-wrap gap-2 border-t bg-white/90 p-3 backdrop-blur">
      <Button variant="secondary" size="sm" onClick={() => void copyTranscript()}>Copy conversation</Button>
    </div>}
  </section>;
}
