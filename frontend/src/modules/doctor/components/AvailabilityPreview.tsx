import { Card } from "../../../components/ui";
import type { DoctorAvailability } from "../types";

export function AvailabilityPreview({ availability }: { availability: DoctorAvailability }) {
  const enabled = availability.weekly.filter((day) => day.enabled);
  return <Card className="p-4 md:p-5"><h2 className="font-semibold">WhatsApp slot preview</h2><div className="mt-3 space-y-2 text-sm">{enabled.slice(0, 4).map((day) => <p key={day.day} className="rounded-xl bg-slate-50 p-3"><b>{day.day}</b> - {day.startTime} to {day.endTime} - {day.slotDurationMinutes} min slots</p>)}</div><p className="mt-3 text-xs text-slate-500">Blocked dates are hidden from the WhatsApp booking simulator.</p></Card>;
}
