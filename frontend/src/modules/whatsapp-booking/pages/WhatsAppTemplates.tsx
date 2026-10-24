import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button, Card, Input, PageHeader, Select } from "../../../components/ui";
import { services } from "../../../services/serviceProvider";
import { TemplateEditorModal } from "../components/TemplateEditorModal";
import { TemplateMessageCard } from "../components/TemplateMessageCard";
import { WhatsAppEmptyState } from "../components/WhatsAppEmptyState";
import type { WhatsAppTemplate, WhatsAppTemplateStatus } from "../types";

export default function WhatsAppTemplates() {
  const [query, setQuery] = useState(""); const [status, setStatus] = useState<WhatsAppTemplateStatus | "all">("all"); const [selected, setSelected] = useState<WhatsAppTemplate | null>(null); const [templates, setTemplates] = useState<WhatsAppTemplate[]>([]); const [loading, setLoading] = useState(true); const [saving, setSaving] = useState(false);
  const load = () => { setLoading(true); services.whatsapp.getTemplates().then(setTemplates).catch((error) => toast.error(error instanceof Error ? error.message : "Unable to load WhatsApp templates.")).finally(() => setLoading(false)); };
  useEffect(load, []);
  const rows = useMemo(() => templates.filter((template) => (status === "all" || template.status === status) && `${template.name} ${template.category}`.toLowerCase().includes(query.toLowerCase())), [query, status, templates]);
  const startNew = () => setSelected({ id: "new", name: "New WhatsApp Template", category: "booking", status: "draft", previewText: "Hello {{patient_name}}.", variables: ["{{patient_name}}"], lastUpdated: "Now" });
  const saveTemplate = async (template: WhatsAppTemplate) => {
    setSaving(true);
    try {
      if (template.id === "new") await services.whatsapp.createTemplate(template); else await services.whatsapp.updateTemplate(template.id, template);
      toast.success("WhatsApp template saved.");
      setSelected(null);
      load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to save WhatsApp template.");
    } finally {
      setSaving(false);
    }
  };
  return <div className="space-y-6"><PageHeader title="WhatsApp Templates" description="Manage message templates and their approval status." action={<Button onClick={startNew}>New Template</Button>} /><Card className="p-4"><div className="grid gap-4 md:grid-cols-[1fr_240px]"><Input placeholder="Search templates" value={query} onChange={(e) => setQuery(e.target.value)} /><Select value={status} onChange={(e) => setStatus(e.target.value as WhatsAppTemplateStatus | "all")}><option value="all">All statuses</option><option value="active">Active</option><option value="draft">Draft</option><option value="needs_api_approval">Needs API approval</option><option value="disabled">Disabled</option></Select></div></Card>{loading ? <Card className="p-4 md:p-5 text-sm text-slate-500">Loading templates...</Card> : rows.length === 0 ? <WhatsAppEmptyState title="No templates found" description="Try a different search term or template status." /> : <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{rows.map((template) => <TemplateMessageCard key={template.id} template={template} onEdit={() => setSelected(template)} />)}</div>}<TemplateEditorModal template={selected} onClose={() => setSelected(null)} onSave={(template) => void saveTemplate(template)} saving={saving} /></div>;
}
