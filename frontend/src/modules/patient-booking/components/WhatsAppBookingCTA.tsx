import { MessageCircle } from "lucide-react";
import { Button } from "../../../components/ui";
import type { ClinicBookingProfile } from "../types";

export function WhatsAppBookingCTA({ clinic }: { clinic: ClinicBookingProfile }) {
  const digits = clinic.whatsapp.replace(/\D/g, "");
  const href = digits ? `https://wa.me/${digits}?text=${encodeURIComponent("Hi")}` : "";

  return <div className="rounded-xl border bg-white p-5">
    <div className="flex items-center gap-2"><MessageCircle className="size-5 text-brand-700" /><h2 className="font-semibold">Book through WhatsApp</h2></div>
    <p className="mt-2 text-sm text-slate-500">Send “Hi” to {clinic.whatsapp || "the clinic WhatsApp number"} to book an appointment.</p>
    <div className="mt-4 space-y-2 text-sm">
      <div className="ml-auto max-w-[78%] rounded-xl rounded-br-sm bg-success-50 p-3">Patient: Hi</div>
      <div className="max-w-[90%] rounded-xl rounded-bl-sm bg-slate-100 p-3">Bot: Welcome to {clinic.name}. Please choose:<br />1. Book Appointment<br />2. View Appointment<br />3. Talk to Reception</div>
    </div>
    {href
      ? <a href={href} target="_blank" rel="noreferrer"><Button className="mt-4 w-full" variant="secondary">Open WhatsApp</Button></a>
      : <Button className="mt-4 w-full" variant="secondary" disabled>WhatsApp number not published</Button>}
  </div>;
}
