import type { PatientTimelineItem } from "../types";

export function PatientTimeline({ items }: { items: PatientTimelineItem[] }) {
  return <div className="space-y-3">{items.map((item) => <div key={item.id} className="rounded-xl border p-4"><div className="flex flex-wrap items-center justify-between gap-2"><b>{item.date}</b><span className="text-xs font-semibold text-slate-400">{item.paymentStatus}</span></div><p className="mt-1 text-sm font-semibold">{item.diagnosis}</p><p className="text-sm text-slate-500">{item.doctor} · {item.prescriptionSummary}</p><p className="mt-2 text-xs text-brand-700">{item.followUpStatus}</p></div>)}</div>;
}
