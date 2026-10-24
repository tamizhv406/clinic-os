import { Button } from "../../../components/ui";
import type { PrescriptionQueueItem } from "../types";
import { PharmacyPaymentBadge, PrescriptionStatusBadge, StockStatusBadge } from "./StockStatusBadge";

export function PrescriptionQueueCard({ item, onView }: { item: PrescriptionQueueItem; onView?: () => void }) {
  return <div className="card p-4"><div className="flex items-start justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Token {item.token}</p><h3 className="font-['Manrope'] text-lg font-semibold">{item.patientName}</h3><p className="text-xs text-slate-500">{item.phone} · {item.doctorName}</p></div><PrescriptionStatusBadge status={item.status} /></div><p className="mt-3 text-sm"><b>{item.diagnosis}</b> · {item.medicines.length} medicines · {item.prescriptionTime}</p><div className="mt-3 flex flex-wrap gap-2">{item.medicines.slice(0, 2).map((m) => <StockStatusBadge key={m.medicineName} status={m.availability} />)}<PharmacyPaymentBadge status={item.paymentStatus} /></div><div className="mt-4 flex flex-wrap gap-2"><Button onClick={onView} disabled={!onView}>View Prescription</Button><Button variant="secondary" disabled title="Create a bill from the prescription detail view">Create Bill</Button><Button variant="ghost" disabled title="Coming soon">Mark Dispensed</Button></div></div>;
}
