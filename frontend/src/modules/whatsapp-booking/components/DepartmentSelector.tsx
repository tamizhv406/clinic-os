import { Card } from "../../../components/ui";
import type { ClinicDepartment } from "../types";

export function DepartmentSelector({ departments, selected, onSelect }: { departments: Array<{ id: ClinicDepartment; label: string }>; selected?: ClinicDepartment; onSelect?: (department: ClinicDepartment) => void }) {
  return <Card className="p-4">
    <p className="font-semibold">Department options</p>
    {departments.length === 0
      ? <p className="mt-3 text-sm text-slate-500">No departments are staffed at this clinic yet.</p>
      : <div className="mt-3 flex flex-wrap gap-2">{departments.map((department) => <button
          key={department.id}
          type="button"
          onClick={() => onSelect?.(department.id)}
          className={`rounded-full px-3 py-1 text-xs font-semibold transition ${department.id === selected ? "bg-brand-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
        >{department.label}</button>)}</div>}
  </Card>;
}
