import { MessageCircle } from "lucide-react";
import { Button } from "../../../components/ui";

export function WhatsAppBookingPanel() {
  const steps = ["Select doctor", "Select service", "Select date", "Select slot", "Share name and age", "Confirm appointment"];
  return <div className="card overflow-hidden"><div className="bg-slate-900 p-5 text-white"><div className="flex items-center gap-2"><MessageCircle className="size-5" /><h2 className="font-semibold">WhatsApp “Hi” Booking Preview</h2></div><p className="mt-2 text-sm text-brand-100">Patients can book appointments by sending “Hi” on WhatsApp.</p></div><div className="space-y-3 p-5 text-sm"><div className="ml-auto max-w-[78%] rounded-xl rounded-br-sm bg-success-50 p-3">Patient: Hi</div><div className="max-w-[88%] rounded-xl rounded-bl-sm bg-slate-100 p-3">Bot: Welcome to Vernex Clinic OS. How can we help you?<div className="mt-2 grid gap-2">{["Book Appointment", "View Appointment", "Talk to Reception"].map((x) => <button key={x} type="button" disabled title="Preview only" className="rounded-lg bg-white px-3 py-2 text-left font-semibold disabled:cursor-not-allowed disabled:opacity-70">{x}</button>)}</div></div><div className="max-w-[88%] rounded-xl rounded-bl-sm bg-slate-100 p-3">Bot asks: {steps.join(" → ")}</div><div className="max-w-[88%] rounded-xl rounded-bl-sm bg-slate-100 p-3 font-semibold">Your appointment is confirmed. Token: A014. Please arrive 10 minutes early.</div><Button variant="secondary" className="w-full" disabled>WhatsApp booking preview</Button></div></div>;
}


