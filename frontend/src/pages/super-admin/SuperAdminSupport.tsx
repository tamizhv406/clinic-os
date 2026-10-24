import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, CheckCircle2, Clock3, Headphones } from "lucide-react";
import { Button, Card, EmptyState, LoadingSkeleton, PageHeader, Select, StatsCard, StatusPill } from "../../components/ui";
import { services } from "../../services/serviceProvider";
import type { ClinicRecord, SupportTicketRecord } from "../../shared/types/domain";

const label = (value: string) => value.replaceAll("_", " ").replace(/\b\w/, (character) => character.toUpperCase());

export default function SuperAdminSupport() {
  const [tickets, setTickets] = useState<SupportTicketRecord[]>([]);
  const [clinics, setClinics] = useState<ClinicRecord[]>([]);
  const [status, setStatus] = useState("all");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const [ticketRows, clinicRows] = await Promise.all([services.support.getTickets(), services.clinics.getClinics()]);
      setTickets(ticketRows);
      setClinics(clinicRows);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to load support tickets.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const clinicNames = useMemo(() => new Map(clinics.map((clinic) => [clinic.id, clinic.name])), [clinics]);
  const visible = useMemo(() => tickets.filter((ticket) => status === "all" || ticket.status === status), [status, tickets]);

  const setTicketStatus = async (ticket: SupportTicketRecord, next: SupportTicketRecord["status"]) => {
    setSaving(ticket.id);
    try {
      const updated = await services.support.updateTicketStatus(ticket.id, next);
      setTickets((current) => current.map((item) => item.id === ticket.id ? updated : item));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to update the ticket.");
    } finally {
      setSaving(null);
    }
  };

  if (loading) return <main className="p-5 md:p-7"><LoadingSkeleton rows={6} /></main>;

  const stats = [
    ["Open", String(tickets.filter((t) => t.status === "open").length), "Awaiting first response", AlertTriangle, "amber"],
    ["In progress", String(tickets.filter((t) => t.status === "in_progress").length), "Being worked on", Clock3, "blue"],
    ["Resolved", String(tickets.filter((t) => t.status === "resolved").length), "Closed out", CheckCircle2, "teal"],
    ["Total", String(tickets.length), "All clinics", Headphones, "violet"],
  ] as const;

  return <><PageHeader title="Support" description="Tickets raised by clinics across the platform." action={<Button variant="secondary" onClick={() => void load()}>Refresh</Button>} />
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{stats.map(([statLabel, value, detail, icon, tone]) => <StatsCard key={statLabel} label={statLabel} value={value} detail={detail} icon={icon} tone={tone} />)}</div>
    <Card className="mt-5 p-4"><Select aria-label="Filter by status" value={status} onChange={(event) => setStatus(event.target.value)} className="max-w-xs">
      <option value="all">All statuses</option><option value="open">Open</option><option value="in_progress">In progress</option><option value="resolved">Resolved</option>
    </Select></Card>
    <Card className="mt-5 overflow-hidden">
      <div className="p-5"><h2 className="font-semibold">Tickets</h2><p className="text-xs text-slate-500">{visible.length} of {tickets.length}</p></div>
      {visible.length > 0 ? <div className="table-wrap"><table className="data-table">
        <thead><tr><th>Subject</th><th>Clinic</th><th>Category</th><th>Priority</th><th>Status</th><th /></tr></thead>
        <tbody>{visible.map((ticket) => <tr key={ticket.id}>
          <td className="font-semibold">{ticket.subject}{ticket.description && <div className="text-xs font-normal text-slate-500">{ticket.description}</div>}</td>
          <td className="text-slate-500">{clinicNames.get(ticket.clinicId) ?? "Unknown"}</td>
          <td>{label(ticket.category)}</td>
          <td>{label(ticket.priority)}</td>
          <td><StatusPill status={ticket.status} /></td>
          <td><div className="flex flex-wrap gap-2">
            {ticket.status !== "in_progress" && <Button size="sm" variant="secondary" disabled={saving === ticket.id} onClick={() => void setTicketStatus(ticket, "in_progress")}>In progress</Button>}
            {ticket.status !== "resolved" && <Button size="sm" disabled={saving === ticket.id} onClick={() => void setTicketStatus(ticket, "resolved")}>Resolve</Button>}
          </div></td>
        </tr>)}</tbody>
      </table></div> : <div className="p-5"><EmptyState title="No tickets" description="Support requests from clinics will appear here." /></div>}
    </Card>
  </>;
}
