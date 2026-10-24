import { Button } from "../../../components/ui";
import type { QueueItem } from "../types";
import { ageGender } from "../utils";
import { AppointmentStatusBadge } from "./AppointmentStatusBadge";

export function QueueTokenCard({ item }: { item: QueueItem }) {
  return <div className="rounded-card border bg-white p-4 shadow-card"><div className="flex items-start justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Token #{item.token}</p><h3 className="mt-1 font-['Manrope'] text-lg font-semibold text-slate-900">{item.patientName}</h3><p className="text-xs text-slate-500">{ageGender(item.age, item.gender)}</p></div><AppointmentStatusBadge status={item.status} /></div><div className="mt-4 rounded-lg bg-slate-50 p-3 text-sm"><p className="font-semibold">{item.doctorName}</p><p className="text-slate-500">{item.service} - {item.reason}</p><p className="mt-2 text-xs font-semibold text-warning-700">{item.waitingMinutes} mins waiting - Arrived {item.arrivalTime}</p></div><div className="mt-4 grid gap-2 sm:grid-cols-3"><Button variant="secondary" size="sm" disabled title="Coming soon">Mark Arrived</Button><Button size="sm" disabled title="Coming soon">Send to Doctor</Button><Button variant="ghost" size="sm" disabled title="Coming soon">No-show</Button></div></div>;
}
