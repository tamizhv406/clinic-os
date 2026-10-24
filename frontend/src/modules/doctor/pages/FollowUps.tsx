import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button, Input, PageHeader, Select } from "../../../components/ui";
import { services } from "../../../services/serviceProvider";
import type { FollowUp, FollowUpStatus } from "../types";
import { FollowUpStatusBadge } from "../components/StatusBadge";
import { DoctorEmptyState } from "../components/DoctorEmptyState";

export default function FollowUps() {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<FollowUpStatus | "all">("all");
  const [followUps, setFollowUps] = useState<FollowUp[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState("");

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      setLoading(true);
      try {
        const context = await services.auth.getCurrentAuthContext();
        // A doctor sees only their own follow-ups; owners and reception see the clinic's.
        const profile = context.role_key === "doctor" ? await services.doctor.getDoctorProfileByStaffId(context.staffProfileId) : null;
        const rows = await services.doctor.getFollowUps(profile?.id);
        if (mounted) setFollowUps(rows);
      } catch (error) {
        if (mounted) toast.error(error instanceof Error ? error.message : "Unable to load follow-ups.");
      } finally {
        if (mounted) setLoading(false);
      }
    };
    void load();
    return () => { mounted = false; };
  }, []);

  const rows = useMemo(
    () => followUps.filter((item) => (status === "all" || item.status === status) && `${item.patientName} ${item.phone} ${item.lastDiagnosis}`.toLowerCase().includes(query.toLowerCase())),
    [followUps, query, status],
  );

  const sendReminder = async (followUp: FollowUp) => {
    if (!followUp.phone) return toast.error("This patient has no WhatsApp number on record.");
    setSending(followUp.id);
    try {
      await services.whatsapp.sendReminderPlaceholder({
        phone: followUp.phone,
        body: `Hello ${followUp.patientName}, this is a reminder for your follow-up on ${followUp.followUpDate} regarding ${followUp.reason}.`,
        relatedId: followUp.patientId,
        metadata: { type: "follow_up", consultationId: followUp.id },
      });
      toast.success("Follow-up reminder queued for WhatsApp delivery.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to queue the reminder.");
    } finally {
      setSending("");
    }
  };

  return <div className="space-y-6">
    <PageHeader title="Follow-ups" description="Follow-up reminders go to WhatsApp. Patients do not use a portal." />
    <div className="card p-4"><div className="grid gap-4 md:grid-cols-[1fr_220px]">
      <Input placeholder="Search patient" value={query} onChange={(event) => setQuery(event.target.value)} />
      <Select value={status} onChange={(event) => setStatus(event.target.value as FollowUpStatus | "all")}>
        <option value="all">All follow-ups</option>
        <option value="due_today">Today</option>
        <option value="upcoming">Upcoming</option>
        <option value="overdue">Overdue</option>
        <option value="completed">Completed</option>
      </Select>
    </div></div>
    {loading ? <div className="card p-4 md:p-5 text-sm text-slate-500">Loading follow-ups...</div>
      : rows.length === 0 ? <DoctorEmptyState title="No follow-ups found" description="Follow-ups appear here once a consultation records a follow-up date." />
      : <div className="grid gap-4 lg:grid-cols-2">{rows.map((followUp) => <div key={followUp.id} className="card p-4">
          <div className="flex items-start justify-between gap-4">
            <div><h3 className="font-semibold">{followUp.patientName}</h3><p className="text-sm text-slate-500">{followUp.phone} - {followUp.lastDiagnosis}</p></div>
            <FollowUpStatusBadge status={followUp.status} />
          </div>
          <p className="mt-3 text-sm"><b>{followUp.followUpDate}</b> - {followUp.reason}</p>
          <div className="mt-3 grid gap-2 text-xs sm:grid-cols-2">
            <span className="rounded-xl bg-slate-50 p-2 font-semibold capitalize">Reminder: {followUp.reminderStatus}</span>
            <span className="rounded-xl bg-slate-50 p-2 font-semibold capitalize">Response: {(followUp.patientResponseStatus ?? "no_response").replace("_", " ")}</span>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button to={`/doctor/consultation/${followUp.patientId}`}>Start Follow-up Consultation</Button>
            <Button variant="secondary" loading={sending === followUp.id} onClick={() => void sendReminder(followUp)}>Send WhatsApp Reminder</Button>
            <Button to={`/doctor/patient/${followUp.patientId}`} variant="ghost">View patient</Button>
          </div>
        </div>)}</div>}
  </div>;
}
