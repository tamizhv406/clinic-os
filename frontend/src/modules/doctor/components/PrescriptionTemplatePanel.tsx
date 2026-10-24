import { Button } from "../../../components/ui";
import type { PrescriptionItem, PrescriptionTemplate } from "../types";

export function PrescriptionTemplatePanel({ templates, onUse }: { templates: PrescriptionTemplate[]; onUse: (items: PrescriptionItem[]) => void }) {
  return <div className="card p-4 md:p-5"><h2 className="font-semibold">Prescription Templates</h2><div className="mt-3 flex flex-wrap gap-2">{templates.map((t) => <Button key={t.id} variant="secondary" className="min-h-8 px-3 py-1" onClick={() => onUse(t.medicines)}>{t.name}</Button>)}</div></div>;
}
