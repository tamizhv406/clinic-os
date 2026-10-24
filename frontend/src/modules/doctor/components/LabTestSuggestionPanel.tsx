import type { LabTest } from "../types";

export function LabTestSuggestionPanel({ tests, selected = [], onToggle }: { tests: LabTest[]; selected?: string[]; onToggle?: (name: string) => void }) {
  return <div className="card p-4 md:p-5">
    <h2 className="font-semibold">Lab Test Suggestions</h2>
    {tests.length === 0
      ? <p className="mt-3 text-sm text-slate-500">No lab tests are configured for this clinic yet.</p>
      : <div className="mt-3 flex flex-wrap gap-2">{tests.map((test) => {
          const isSelected = selected.includes(test.name);
          return <label key={test.id} className={`cursor-pointer rounded-full border px-3 py-1.5 text-sm font-semibold ${isSelected ? "border-brand-300 bg-brand-50 text-brand-700" : ""}`}>
            <input type="checkbox" className="mr-2" checked={isSelected} onChange={() => onToggle?.(test.name)} />
            {test.name}
          </label>;
        })}</div>}
  </div>;
}
