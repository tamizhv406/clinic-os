import { CalendarPlus } from "lucide-react";
import { Button } from "../../../components/ui";

export function ReceptionEmptyState({ title = "Nothing here yet", description = "Create today’s first appointment to get started." }: { title?: string; description?: string }) {
  return <div className="rounded-xl border border-dashed bg-slate-50 p-8 text-center"><CalendarPlus className="mx-auto size-8 text-slate-400" /><h3 className="mt-3 font-semibold text-slate-800">{title}</h3><p className="mx-auto mt-1 max-w-sm text-sm text-slate-500">{description}</p><Button className="mt-4" variant="secondary" to="/reception/appointments">Create appointment</Button></div>;
}
