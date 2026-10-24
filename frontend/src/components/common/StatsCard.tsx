import type { LucideIcon } from "lucide-react";
export function StatsCard({ label, value, detail, delta, icon: Icon }: { label: string; value: string; detail?: string; delta?: string; icon: LucideIcon; tone?: "teal" | "blue" | "amber" | "violet" }) {
  return <div className="card p-4 md:p-5"><div className="flex items-start justify-between gap-4"><div className="min-w-0"><p className="text-sm font-medium text-slate-600">{label}</p><p className="mt-2 text-2xl font-semibold tabular-nums text-slate-900">{value}</p>{(delta || detail) && <p className="mt-1 text-xs leading-5 text-slate-500">{delta && <span className="mr-1 font-medium">{delta}</span>}{detail}</p>}</div><Icon className="mt-0.5 size-4 shrink-0 text-slate-400" aria-hidden="true" /></div></div>;
}
