import type { WhatsAppFlowStep } from "../types";

export function FlowStepCard({ step, index }: { step: WhatsAppFlowStep; index: number }) {
  return <div className="rounded-xl border bg-white p-4"><div className="flex gap-4"><span className="grid size-9 shrink-0 place-items-center rounded-full bg-slate-100 text-sm font-semibold tabular-nums text-slate-700">{index + 1}</span><div><h3 className="font-semibold">{step.title}</h3><p className="mt-1 text-sm text-slate-500">{step.description}</p><p className="mt-3 rounded-xl bg-slate-50 p-3 text-xs font-semibold text-slate-600">{step.sampleMessage}</p></div></div></div>;
}
