import type { WhatsAppMessage } from "../types";

export function ChatBubble({ message }: { message: WhatsAppMessage }) {
  const isPatient = message.sender === "patient";
  const isReception = message.sender === "reception";
  return <div className={`flex ${isPatient ? "justify-end" : "justify-start"}`}><div className={`max-w-[88%] whitespace-pre-line rounded-lg px-4 py-3 text-sm leading-6 shadow-card sm:max-w-[78%] ${isPatient ? "rounded-br-sm bg-brand-600 text-white" : isReception ? "rounded-bl-sm bg-warning-50 text-warning-700 " : "rounded-bl-sm bg-white text-slate-700 "}`}><p>{message.text}</p><p className={`mt-1 text-[10px] font-semibold uppercase ${isPatient ? "text-brand-100" : "text-slate-400"}`}>{message.sender} - {message.time}</p></div></div>;
}
