import { Input, Select } from "../../../components/ui";
import type { PrescriptionItem } from "../types";

export function MedicineReminderSetup({ items }: { items: PrescriptionItem[] }) {
  return <div className="space-y-3">{items.map((item) => <div key={item.id} className="rounded-xl border p-3"><div className="grid gap-2 md:grid-cols-4"><Input defaultValue={item.medicineName} placeholder="Medicine" /><Input defaultValue={item.dosage} placeholder="Dosage" /><Select defaultValue="three_times_daily"><option value="once_daily">Once daily</option><option value="twice_daily">Twice daily</option><option value="three_times_daily">Three times daily</option><option value="four_times_daily">Four times daily</option><option value="custom">Custom</option></Select><Select defaultValue="after_food"><option value="before_food">Before food</option><option value="after_food">After food</option></Select><Input type="time" defaultValue="08:00" /><Input type="time" defaultValue="14:00" /><Input type="time" defaultValue="20:00" /><label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" defaultChecked /> Reminder enabled</label></div></div>)}</div>;
}
