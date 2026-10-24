import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { Button, Card, PageHeader } from "../../../components/ui";
import { services } from "../../../services/serviceProvider";
import { BookingFlowTimeline } from "../components/BookingFlowTimeline";
import { ConversationList } from "../components/ConversationList";
import { TemplateMessageCard } from "../components/TemplateMessageCard";
import { WhatsAppEmptyState } from "../components/WhatsAppEmptyState";
import { WhatsAppStatsGrid } from "../components/WhatsAppStatsGrid";
import { WhatsAppStatusBadge } from "../components/WhatsAppStatusBadge";
import { bookingFlowSteps } from "../flowSteps";
import type { WhatsAppBookingSettings, WhatsAppBookingStats, WhatsAppConversation, WhatsAppTemplate } from "../types";

const emptyStats: WhatsAppBookingStats = { bookingRequests: 0, appointmentsConfirmed: 0, pendingConversations: 0, remindersScheduled: 0, failedMessages: 0, templatesActive: 0 };

export default function WhatsAppBookingDashboard() {
  const [conversations, setConversations] = useState<WhatsAppConversation[]>([]);
  const [templates, setTemplates] = useState<WhatsAppTemplate[]>([]);
  const [stats, setStats] = useState<WhatsAppBookingStats>(emptyStats);
  const [settings, setSettings] = useState<WhatsAppBookingSettings | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      setLoading(true);
      try {
        const [nextConversations, nextTemplates, nextStats, nextSettings] = await Promise.all([
          services.whatsapp.getConversations(),
          services.whatsapp.getTemplates(),
          services.whatsapp.getStats(),
          services.whatsapp.getSettings(),
        ]);
        if (!mounted) return;
        setConversations(nextConversations.slice(0, 5));
        setTemplates(nextTemplates.slice(0, 6));
        setStats(nextStats);
        setSettings(nextSettings);
      } catch (error) {
        if (mounted) toast.error(error instanceof Error ? error.message : "Unable to load the WhatsApp dashboard.");
      } finally {
        if (mounted) setLoading(false);
      }
    };
    void load();
    return () => { mounted = false; };
  }, []);

  return <div className="space-y-6">
    <PageHeader
      title="WhatsApp Booking"
      description="Patients can book appointments by sending 'Hi' to the clinic WhatsApp number."
      action={<div className="flex flex-wrap gap-2"><WhatsAppStatusBadge status={settings?.apiStatus === "connected" ? "connected" : "demo"} /><Button to="/whatsapp-booking/simulator">Open booking console</Button></div>}
    />
    <Card className="p-4"><p className="text-sm font-semibold text-slate-600">Clinic WhatsApp number: <span className="text-brand-700">{settings?.businessNumber || "Not configured yet"}</span></p></Card>
    <WhatsAppStatsGrid stats={stats} />
    <Card className="p-4 md:p-5"><h2 className="mb-4 font-semibold">How It Works</h2><BookingFlowTimeline steps={bookingFlowSteps} /></Card>
    <div className="grid gap-4 xl:grid-cols-[1.1fr_.9fr]">
      <Card className="p-4 md:p-5">
        <div className="mb-4 flex justify-between"><h2 className="font-semibold">Recent WhatsApp Conversations</h2><Link className="text-sm font-semibold text-brand-700" to="/whatsapp-booking/conversations">View all</Link></div>
        {loading ? <p className="text-sm text-slate-500">Loading conversations...</p>
          : conversations.length === 0 ? <WhatsAppEmptyState title="No conversations yet" description="Patient chats will appear here once WhatsApp booking starts." />
          : <ConversationList conversations={conversations} onView={() => undefined} />}
      </Card>
      <Card className="p-4 md:p-5">
        <div className="mb-4 flex justify-between"><h2 className="font-semibold">Templates</h2><Link className="text-sm font-semibold text-brand-700" to="/whatsapp-booking/templates">Manage</Link></div>
        {loading ? <p className="text-sm text-slate-500">Loading templates...</p>
          : templates.length === 0 ? <WhatsAppEmptyState title="No templates yet" description="Create message templates to prepare for official WhatsApp API approval." />
          : <div className="grid gap-4">{templates.map((template) => <TemplateMessageCard key={template.id} template={template} onEdit={() => undefined} />)}</div>}
      </Card>
    </div>
  </div>;
}
