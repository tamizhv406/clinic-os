import { Card } from "../../../components/ui";
import type { WhatsAppDoctor } from "../types";

export function DoctorAvailabilitySelector({ doctors, selectedId, onSelect }: { doctors: WhatsAppDoctor[]; selectedId?: string; onSelect?: (doctorId: string) => void }) {
  return <Card className="p-4">
    <p className="font-semibold">Available doctors</p>
    {doctors.length === 0
      ? <p className="mt-3 text-sm text-slate-500">No active doctors match this department.</p>
      : <div className="mt-3 space-y-2">{doctors.map((doctor) => <button
          key={doctor.id}
          type="button"
          onClick={() => onSelect?.(doctor.id)}
          className={`w-full rounded-xl border p-3 text-left text-sm transition hover:border-brand-300 ${doctor.id === selectedId ? "border-brand-300 bg-brand-50" : ""}`}
        >
          <b>{doctor.name}</b>
          <p className="text-slate-500">{[doctor.qualification, doctor.specialisation].filter(Boolean).join(" - ")}</p>
          <p className="mt-1 text-xs font-semibold text-brand-700">Rs {doctor.consultationFee} - {doctor.nextAvailableSlot}</p>
        </button>)}</div>}
  </Card>;
}
