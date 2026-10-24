import type { AvailableSlot } from "../types";
import { slotTone } from "../utils";

export function SlotSelector({ slots, selectedId, onSelect }: { slots: AvailableSlot[]; selectedId: string; onSelect: (id: string) => void }) {
  return <div className="space-y-4">{(["morning", "afternoon", "evening"] as const).map((period) => <div key={period}><h3 className="mb-2 text-sm font-semibold capitalize">{period} slots</h3><div className="grid grid-cols-2 gap-2 sm:grid-cols-4">{slots.filter((slot) => slot.period === period).map((slot) => <button key={slot.id} disabled={slot.status === "booked"} onClick={() => onSelect(slot.id)} className={`min-h-14 rounded-lg border px-3 py-3 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-55 ${selectedId === slot.id ? "border-brand-600 bg-brand-600 text-white" : slotTone[slot.status]}`}><span>{slot.label}</span><span className="block text-[10px] uppercase">{slot.status}</span></button>)}</div></div>)}</div>;
}
