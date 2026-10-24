import { Card } from "../../../components/ui";
import type { WhatsAppAvailability } from "../types";

export function AppointmentDateSelector({ dates, selectedDate, onSelect }: { dates: WhatsAppAvailability["dates"]; selectedDate?: string; onSelect?: (date: string) => void }) {
  return <Card className="p-4">
    <p className="font-semibold">Available dates</p>
    {dates.length === 0
      ? <p className="mt-3 text-sm text-slate-500">This doctor has no published availability.</p>
      : <div className="mt-3 grid gap-2 sm:grid-cols-3">{dates.map((date) => <button
          key={date.date}
          type="button"
          onClick={() => onSelect?.(date.date)}
          className={`rounded-xl p-3 text-left text-sm font-semibold transition ${date.date === selectedDate ? "bg-brand-600 text-white" : "bg-slate-50 hover:bg-slate-100"}`}
        >{date.label}<br /><small>{date.date}</small></button>)}</div>}
  </Card>;
}
