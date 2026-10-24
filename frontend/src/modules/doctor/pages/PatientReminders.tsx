import { StatusBadge } from "../../../components/common/StatusBadge";
import { toneForStatus } from "../../../utils/statusColors";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button, PageHeader } from "../../../components/ui";
import { services } from "../../../services/serviceProvider";
import { DoctorEmptyState } from "../components/DoctorEmptyState";
import type { MedicineReminderSchedule, ReminderStatus } from "../types";

export default function PatientReminders() {
  const [schedules, setSchedules] = useState<MedicineReminderSchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const context = await services.auth.getCurrentAuthContext();
      const profile = context.role_key === "doctor" ? await services.doctor.getDoctorProfileByStaffId(context.staffProfileId) : null;
      setSchedules(await services.doctor.getMedicineReminderSchedules(profile?.id));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to load medicine reminders.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  // A schedule groups every reminder row of one prescription, so a status change applies to all of them.
  const setStatus = async (schedule: MedicineReminderSchedule, status: ReminderStatus) => {
    setSaving(schedule.id);
    try {
      const [patientId] = schedule.id.split(":");
      const reminders = await services.doctor.getMedicineReminders(patientId);
      const target = reminders.filter((reminder) => reminder.patientId === patientId);
      if (target.length === 0) throw new Error("No reminder rows were found for this schedule.");
      await Promise.all(target.map((reminder) => services.doctor.updateReminderStatus(reminder.id, status)));
      toast.success(`Reminder schedule ${status}.`);
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to update the reminder schedule.");
    } finally {
      setSaving("");
    }
  };

  const sendPreview = async (schedule: MedicineReminderSchedule) => {
    if (!schedule.phone) return toast.error("This patient has no WhatsApp number on record.");
    setSaving(schedule.id);
    try {
      await services.whatsapp.sendReminderPlaceholder({
        phone: schedule.phone,
        body: `Hello ${schedule.patientName}, this is your medicine reminder for: ${schedule.activeMedicines.join(", ")}.`,
        metadata: { type: "medicine_reminder", prescriptionId: schedule.prescriptionId },
      });
      toast.success("Preview reminder queued for WhatsApp delivery.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to queue the preview.");
    } finally {
      setSaving("");
    }
  };

  return <div className="space-y-6">
    <PageHeader title="Patient Reminders" description="Doctor-controlled WhatsApp medicine reminders. No patient portal required." />
    {loading ? <div className="card p-4 md:p-5 text-sm text-slate-500">Loading reminder schedules...</div>
      : schedules.length === 0 ? <DoctorEmptyState title="No active reminder schedules" description="Enable reminders while building a prescription and the schedule will appear here." />
      : <div className="grid gap-4 lg:grid-cols-2">{schedules.map((schedule) => <div key={schedule.id} className="card p-4">
          <div className="flex items-start justify-between gap-4">
            <div><h3 className="font-semibold">{schedule.patientName}</h3><p className="text-sm text-slate-500">{schedule.phone}</p></div>
            <StatusBadge tone={toneForStatus(schedule.status)}>{schedule.status}</StatusBadge>
          </div>
          <p className="mt-3 text-sm"><b>Active medicines:</b> {schedule.activeMedicines.join(", ")}</p>
          <p className="mt-1 text-sm"><b>Next reminder:</b> {schedule.nextReminder}</p>
          <p className="mt-1 text-sm"><b>Duration:</b> {schedule.duration} - <b>Consent:</b> {schedule.consent === "confirmed" ? "Patient consent confirmed" : "Consent not received"}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button variant="secondary" disabled={saving === schedule.id || schedule.status === "paused"} onClick={() => void setStatus(schedule, "paused")}>Pause</Button>
            <Button variant="secondary" disabled={saving === schedule.id || schedule.status === "active"} onClick={() => void setStatus(schedule, "active")}>Resume</Button>
            <Button variant="danger" disabled={saving === schedule.id} onClick={() => void setStatus(schedule, "cancelled")}>Stop</Button>
            <Button variant="ghost" disabled={saving === schedule.id} onClick={() => void sendPreview(schedule)}>Send test preview</Button>
          </div>
        </div>)}</div>}
  </div>;
}
