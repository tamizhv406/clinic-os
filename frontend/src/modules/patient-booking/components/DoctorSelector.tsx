import { StatusBadge } from "../../../components/common/StatusBadge";
import { Button } from "../../../components/ui";
import type { BookingDoctor } from "../types";
import { rupee } from "../utils";

export function DoctorSelector({ doctors, selectedId, onSelect }: { doctors: BookingDoctor[]; selectedId: string; onSelect: (id: string) => void }) {
  return <div className="grid gap-4 md:grid-cols-2">{doctors.map((doctor) => <button key={doctor.id} disabled={!doctor.availableToday} onClick={() => onSelect(doctor.id)} className={`min-h-36 rounded-card border bg-white p-4 text-left transition disabled:cursor-not-allowed disabled:opacity-50 ${selectedId === doctor.id ? "border-brand-500 bg-brand-50" : "hover:border-brand-300 hover:bg-slate-50"}`}><div className="flex items-start justify-between gap-4"><div><h3 className="font-semibold text-slate-900">{doctor.name}</h3><p className="text-sm text-slate-500">{doctor.specialization}</p><p className="mt-1 text-xs text-slate-400">{doctor.qualification} - {doctor.experience} yrs</p></div>{doctor.availableToday && <StatusBadge tone="success">Available today</StatusBadge>}</div><div className="mt-4 flex items-center justify-between"><b>{rupee(doctor.consultationFee)}</b><Button size="sm">{selectedId === doctor.id ? "Selected" : "Select"}</Button></div></button>)}</div>;
}
