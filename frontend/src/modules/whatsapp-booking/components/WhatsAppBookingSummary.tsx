import type { WhatsAppBookingSummary as Summary } from "../types";

export function WhatsAppBookingSummary({ summary }: { summary: Summary }) {
  return <div className="rounded-xl border bg-slate-50 p-4 text-sm"><h3 className="font-semibold text-slate-700">Booking Summary</h3><div className="mt-3 space-y-1 text-slate-700"><p><b>Token:</b> {summary.token}</p><p><b>Patient:</b> {summary.patientName}</p><p><b>Doctor:</b> {summary.doctorName}</p><p><b>Service:</b> {summary.service}</p><p><b>Date/time:</b> {summary.dateTime}</p></div></div>;
}
