import { Card } from "../../../components/ui";

export function AppointmentSlotSelector({ slots, selected, onSelect }: { slots: string[]; selected?: string; onSelect?: (slot: string) => void }) {
  return <Card className="p-4">
    <p className="font-semibold">Time slots</p>
    {slots.length === 0
      ? <p className="mt-3 text-sm text-slate-500">No open slots on the selected date.</p>
      : <div className="mt-3 flex flex-wrap gap-2">{slots.map((slot) => <button
          key={slot}
          type="button"
          onClick={() => onSelect?.(slot)}
          className={`rounded-full px-3 py-1 text-xs font-semibold transition ${slot === selected ? "bg-brand-600 text-white" : "bg-brand-50 text-brand-700 hover:bg-brand-100"}`}
        >{slot}</button>)}</div>}
  </Card>;
}
