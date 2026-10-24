import { StatusBadge } from "../../../components/common/StatusBadge";
import { AlertTriangle } from "lucide-react";
import { Button } from "../../../components/ui";
import type { PatientProfile } from "../types";
import { PatientTagBadge } from "./StatusBadge";

export function PatientSummaryCard({ patient, compact = false }: { patient: PatientProfile; compact?: boolean }) {
  return <div className="card p-4 md:p-5"><div className="flex items-start justify-between gap-4"><div><p className="text-xs font-semibold text-slate-400">{patient.id}</p><h2 className="font-['Manrope'] text-xl font-semibold">{patient.name}</h2><p className="text-sm text-slate-500">{patient.age} yrs · {patient.gender} · {patient.phone}</p></div><Button to={`/doctor/consultation/${patient.id}`} className="min-h-9 px-3 py-1">Start Consultation</Button></div><div className="mt-3 flex flex-wrap gap-2">{patient.tags.map((tag) => <PatientTagBadge key={tag} tag={tag} />)}{patient.pendingPayment && <StatusBadge tone="warning">Pending payment</StatusBadge>}</div><div className="mt-4 grid gap-4 text-sm"><p><b>Blood group:</b> {patient.bloodGroup}</p><p><b>Last visit:</b> {patient.lastVisit}</p>{patient.allergies.length > 0 && <p className="rounded-xl bg-danger-50 p-3 font-semibold text-danger-700"><AlertTriangle className="mr-2 inline size-4" />Allergy Alert: {patient.allergies.join(", ")}</p>}{!compact && <><p><b>Existing conditions:</b> {patient.conditions.join(", ")}</p><p><b>Current medicines:</b> {patient.medications.join(", ")}</p><p><b>Emergency:</b> {patient.emergencyContact}</p><p><b>Total visits:</b> {patient.totalVisits}</p></>}</div></div>;
}
