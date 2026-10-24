import { AlertTriangle, CalendarCheck, Clock3, FileText, MessageCircle, Send } from "lucide-react";
import { StatsCard } from "../../../components/ui";
import type { WhatsAppBookingStats } from "../types";

export function WhatsAppStatsGrid({ stats }: { stats: WhatsAppBookingStats }) {
  return <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6"><StatsCard label="Booking Requests" value={String(stats.bookingRequests)} icon={MessageCircle} tone="blue" /><StatsCard label="Appointments Confirmed" value={String(stats.appointmentsConfirmed)} icon={CalendarCheck} /><StatsCard label="Pending Conversations" value={String(stats.pendingConversations)} icon={Clock3} tone="amber" /><StatsCard label="Reminders Scheduled" value={String(stats.remindersScheduled)} icon={Send} /><StatsCard label="Failed Messages" value={String(stats.failedMessages)} icon={AlertTriangle} tone="violet" /><StatsCard label="Templates Active" value={String(stats.templatesActive)} icon={FileText} tone="blue" /></div>;
}
