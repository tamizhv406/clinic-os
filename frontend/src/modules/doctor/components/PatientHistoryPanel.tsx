import { Card } from "../../../components/ui";
import type { PatientTimelineItem, Prescription } from "../types";
import { PatientTimeline } from "./PatientTimeline";

export function PatientHistoryPanel({ timeline, prescriptions }: { timeline: PatientTimelineItem[]; prescriptions: Prescription[] }) {
  return <Card className="p-4 md:p-5"><h2 className="font-semibold">History & past prescriptions</h2><div className="mt-4"><PatientTimeline items={timeline} /></div><div className="mt-5 space-y-2">{prescriptions.map((rx) => <div key={rx.id} className="rounded-xl bg-slate-50 p-3 text-sm"><b>{rx.date}</b> · {rx.items.length} medicine · {rx.doctorName}</div>)}</div></Card>;
}
