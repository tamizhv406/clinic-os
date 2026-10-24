import { Stethoscope } from "lucide-react";
export function DoctorEmptyState({ title = "No patients waiting right now", description = "Your queue is clear. New check-ins will appear here." }: { title?: string; description?: string }) {
  return <div className="rounded-xl border border-dashed bg-white p-8 text-center"><Stethoscope className="mx-auto size-8 text-slate-400" /><h3 className="mt-3 font-semibold">{title}</h3><p className="mt-1 text-sm text-slate-500">{description}</p></div>;
}
