import type { AppointmentStatus, QueueItem } from "../types";
import { QueueTokenCard } from "./QueueTokenCard";
import { ReceptionEmptyState } from "./ReceptionEmptyState";

const columns: { title: string; statuses: AppointmentStatus[] }[] = [
  { title: "Waiting", statuses: ["arrived", "waiting"] },
  { title: "In Consultation", statuses: ["in_consultation"] },
  { title: "Completed", statuses: ["completed"] },
  { title: "No-show / Cancelled", statuses: ["no_show", "cancelled"] }
];

export function QueueBoard({ items }: { items: QueueItem[] }) {
  return <div className="grid gap-4 xl:grid-cols-4">{columns.map((column) => {
    const filtered = items.filter((item) => column.statuses.includes(item.status));
    return <section key={column.title} className="rounded-xl border bg-slate-50 p-3"><h2 className="mb-3 px-1 font-semibold">{column.title} <span className="text-xs text-slate-400">({filtered.length})</span></h2><div className="space-y-3">{filtered.length ? filtered.map((item) => <QueueTokenCard key={item.id} item={item} />) : <ReceptionEmptyState title="No patients waiting right now" description="The queue is clear for this lane." />}</div></section>;
  })}</div>;
}
