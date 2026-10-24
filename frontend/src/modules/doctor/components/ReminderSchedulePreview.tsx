import { Card } from "../../../components/ui";
import type { PrescriptionItem } from "../types";

export function ReminderSchedulePreview({ items }: { items: PrescriptionItem[] }) {
  return <Card className="p-4"><p className="font-semibold">Reminder schedule preview</p><div className="mt-3 space-y-2">{items.map((item) => <p key={item.id} className="rounded-xl bg-slate-50 p-3 text-sm">{item.medicineName || "Medicine"} - {item.frequency} - {item.timing} - {item.duration}</p>)}</div></Card>;
}
