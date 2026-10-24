import { Trash2 } from "lucide-react";
import { Button, Input, Select } from "../../../components/ui";
import type { PrescriptionItem } from "../types";
import { MedicineSearchInput } from "./MedicineSearchInput";

export function MedicineRow({ item, onChange, onRemove }: { item: PrescriptionItem; onChange: (item: PrescriptionItem) => void; onRemove: () => void }) {
  return <div className="rounded-xl border p-3"><div className="grid gap-4 md:grid-cols-[1.2fr_.7fr_.6fr_.7fr_.6fr_.9fr_auto]"><MedicineSearchInput value={item.medicineName} medicineId={item.medicineId} onChange={(name, medicineId) => onChange({ ...item, medicineName: name, medicineId })} /><Input value={item.dosage} onChange={(e) => onChange({ ...item, dosage: e.target.value })} placeholder="Dosage" /><Input value={item.frequency} onChange={(e) => onChange({ ...item, frequency: e.target.value })} placeholder="1-0-1" /><Select value={item.timing} onChange={(e) => onChange({ ...item, timing: e.target.value })}><option>After food</option><option>Before food</option><option>Empty stomach</option><option>Bedtime</option></Select><Input value={item.duration} onChange={(e) => onChange({ ...item, duration: e.target.value })} placeholder="3 days" /><Input value={item.instructions ?? ""} onChange={(e) => onChange({ ...item, instructions: e.target.value })} placeholder="Instructions" /><Button type="button" variant="ghost" onClick={onRemove}><Trash2 className="size-4" /></Button></div></div>;
}
