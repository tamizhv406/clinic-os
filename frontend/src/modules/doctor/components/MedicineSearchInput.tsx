import { useEffect, useId, useState } from "react";
import { Input } from "../../../components/ui";
import { services } from "../../../services/serviceProvider";
import type { MedicineAvailability } from "../../../services/interfaces";

const AVAILABILITY_TTL_MS = 60_000;
let cached: { at: number; promise: Promise<MedicineAvailability[]> } | null = null;

/**
 * The clinic's catalogue with current usable stock. Shared by every medicine
 * row on the page and refreshed at most once a minute.
 */
function loadAvailability() {
  if (!cached || Date.now() - cached.at > AVAILABILITY_TTL_MS) {
    const promise = services.pharmacy.getMedicineAvailability().catch(() => [] as MedicineAvailability[]);
    cached = { at: Date.now(), promise };
  }
  return cached.promise;
}

const stockText = (units: number) => (units > 0 ? `in stock ${units}` : "out of stock");

/**
 * Medicine name input. When the text matches a catalogue medicine, its id is
 * passed back so the pharmacy order links to exactly that medicine.
 */
export function MedicineSearchInput({ value, medicineId, onChange }: { value: string; medicineId?: string; onChange: (value: string, medicineId?: string) => void }) {
  const listId = useId();
  const [medicines, setMedicines] = useState<MedicineAvailability[]>([]);

  useEffect(() => {
    let mounted = true;
    void loadAvailability().then((next) => { if (mounted) setMedicines(next); });
    return () => { mounted = false; };
  }, []);

  const match = (text: string) => medicines.find((medicine) => medicine.name.trim().toLowerCase() === text.trim().toLowerCase());
  const selected = medicineId ? medicines.find((medicine) => medicine.id === medicineId) : match(value);

  return <div>
    <Input list={listId} value={value} onChange={(event) => onChange(event.target.value, match(event.target.value)?.id)} placeholder="Medicine name e.g. Paracetamol 650mg" aria-label="Medicine" />
    <datalist id={listId}>{medicines.map((medicine) => <option key={medicine.id} value={medicine.name}>{stockText(medicine.availableUnits)}</option>)}</datalist>
    {value.trim() && <p className={`mt-1 text-[11px] ${selected ? (selected.availableUnits > 0 ? "text-success-700" : "text-danger-700") : "text-slate-500"}`}>
      {selected ? `Pharmacy: ${stockText(selected.availableUnits)}` : "Not in the pharmacy catalogue"}
    </p>}
  </div>;
}
