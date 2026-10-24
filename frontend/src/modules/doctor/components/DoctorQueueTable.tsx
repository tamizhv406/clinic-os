import { DoctorQueueCard } from "./DoctorQueueCard";
import type { DoctorQueueItem } from "../types";

export function DoctorQueueTable({ items }: { items: DoctorQueueItem[] }) {
  return <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">{items.map((item) => <DoctorQueueCard key={item.id} item={item} />)}</div>;
}
