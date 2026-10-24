import { useState } from "react";
import { Button, Input, Modal, Select } from "../../../components/ui";
import type { Tables, TablesUpdate } from "../../../shared/types/database.types";
import { MEDICINE_CATEGORIES, medicineKey, parseNumber } from "../stockImport";

type MedicineRow = Tables<"medicines">;
type Fields = { name: string; genericName: string; category: string; manufacturer: string; strength: string; unit: string; hsnCode: string; gstRate: string; reorderLevel: string };

const fromMedicine = (medicine: MedicineRow): Fields => ({
  name: medicine.name, genericName: medicine.generic_name ?? "", category: medicine.category ?? "general", manufacturer: medicine.manufacturer ?? "",
  strength: medicine.strength ?? "", unit: medicine.unit ?? "", hsnCode: medicine.hsn_code ?? "",
  gstRate: medicine.gst_rate === null || medicine.gst_rate === undefined ? "" : String(medicine.gst_rate), reorderLevel: String(medicine.reorder_level ?? 0),
});

/** Edits master fields and the reorder level of one medicine. Mount with a fresh `key` per medicine. */
export function EditMedicineModal({ medicine, otherNames, onClose, onSave }: {
  medicine: MedicineRow | null;
  /** Lower-cased names of the clinic's other active medicines, to prevent duplicates. */
  otherNames: Set<string>;
  onClose: () => void;
  onSave: (id: string, patch: TablesUpdate<"medicines">) => Promise<boolean>;
}) {
  const [fields, setFields] = useState<Fields | null>(medicine ? fromMedicine(medicine) : null);
  const [saving, setSaving] = useState(false);
  if (!medicine || !fields) return null;

  const set = (patch: Partial<Fields>) => setFields({ ...fields, ...patch });
  const gst = parseNumber(fields.gstRate);
  const reorder = parseNumber(fields.reorderLevel);
  const errors: Partial<Record<keyof Fields, string>> = {};
  if (!fields.name.trim()) errors.name = "Name is required";
  else if (fields.name.trim().length > 200) errors.name = "Name is too long (max 200 characters)";
  else if (otherNames.has(medicineKey(fields.name))) errors.name = "Another active medicine already has this name";
  if (gst !== null && (Number.isNaN(gst) || gst < 0 || gst > 28)) errors.gstRate = "GST % must be between 0 and 28";
  if (reorder === null || Number.isNaN(reorder) || reorder < 0 || !Number.isInteger(reorder)) errors.reorderLevel = "Whole number of 0 or more";
  const valid = Object.keys(errors).length === 0;

  const submit = async () => {
    if (!valid) return;
    setSaving(true);
    try {
      const saved = await onSave(medicine.id, {
        name: fields.name.trim(),
        generic_name: fields.genericName.trim() || null,
        category: fields.category,
        manufacturer: fields.manufacturer.trim() || null,
        strength: fields.strength.trim() || null,
        unit: fields.unit.trim() || null,
        hsn_code: fields.hsnCode.trim() || null,
        gst_rate: gst ?? 0,
        reorder_level: reorder ?? 0,
      });
      if (saved) onClose();
    } finally {
      setSaving(false);
    }
  };

  return <Modal open onClose={onClose} title={`Edit ${medicine.name}`} description="Changes apply to every batch of this medicine." footer={<><Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button><Button loading={saving} disabled={!valid} onClick={() => void submit()}>Save changes</Button></>}>
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="sm:col-span-2"><Input label="Name" requiredMark value={fields.name} onChange={(event) => set({ name: event.target.value })} error={errors.name} maxLength={200} /></div>
      <Input label="Generic name" value={fields.genericName} onChange={(event) => set({ genericName: event.target.value })} />
      <Select label="Category" value={MEDICINE_CATEGORIES.includes(fields.category as never) ? fields.category : "general"} onChange={(event) => set({ category: event.target.value })}>{MEDICINE_CATEGORIES.map((category) => <option key={category} value={category}>{category}</option>)}</Select>
      <Input label="Manufacturer" value={fields.manufacturer} onChange={(event) => set({ manufacturer: event.target.value })} />
      <Input label="Strength" value={fields.strength} onChange={(event) => set({ strength: event.target.value })} placeholder="650mg" />
      <Input label="Unit" value={fields.unit} onChange={(event) => set({ unit: event.target.value })} placeholder="tablet" />
      <Input label="HSN code" value={fields.hsnCode} onChange={(event) => set({ hsnCode: event.target.value })} />
      <Input label="GST %" inputMode="decimal" value={fields.gstRate} onChange={(event) => set({ gstRate: event.target.value })} error={errors.gstRate} />
      <Input label="Reorder level" requiredMark inputMode="numeric" value={fields.reorderLevel} onChange={(event) => set({ reorderLevel: event.target.value })} error={errors.reorderLevel} helperText="A low-stock alert opens at or below this many units." />
    </div>
  </Modal>;
}
