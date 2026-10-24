import { Button } from "../../../components/ui";
import type { WhatsAppTemplate } from "../types";
import { WhatsAppStatusBadge } from "./WhatsAppStatusBadge";

export function TemplateMessageCard({ template, onEdit }: { template: WhatsAppTemplate; onEdit: () => void }) {
  return <div className="card p-4"><div className="flex items-start justify-between gap-4"><div><h3 className="font-semibold">{template.name}</h3><p className="text-xs font-semibold uppercase text-slate-400">{template.category}</p></div><WhatsAppStatusBadge status={template.status} /></div><p className="mt-3 rounded-xl bg-slate-50 p-3 text-sm text-slate-600">{template.previewText}</p><p className="mt-2 text-xs text-slate-400">Variables: {template.variables.slice(0, 4).join(", ")} · Updated {template.lastUpdated}</p><Button className="mt-4" variant="secondary" onClick={onEdit}>Edit template</Button></div>;
}
