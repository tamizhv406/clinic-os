import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button, Card, PageHeader } from "../../../components/ui";
import { services } from "../../../services/serviceProvider";
import type { Tables, TablesInsert } from "../../../shared/types/database.types";
import { AvailabilityPreview } from "../components/AvailabilityPreview";
import { BlockedDateModal } from "../components/BlockedDateModal";
import type { DaySaveInput } from "../components/DayScheduleCard";
import { WeeklyAvailabilityEditor } from "../components/WeeklyAvailabilityEditor";
import type { DoctorAvailability } from "../types";

const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export default function Availability() {
  const [open, setOpen] = useState(false);
  const [profile, setProfile] = useState<Tables<"doctor_profiles"> | null>(null);
  const [rows, setRows] = useState<Tables<"doctor_availability">[]>([]);
  const [blockedDates, setBlockedDates] = useState<Tables<"doctor_blocked_dates">[]>([]);
  const [loading, setLoading] = useState(false);
  const [savingDay, setSavingDay] = useState<number | null>(null);

  const loadAvailability = async () => {
    setLoading(true);
    try {
      const context = await services.auth.getCurrentAuthContext();
      const nextProfile = await services.doctor.getDoctorProfileByStaffId(context.staffProfileId);
      if (!nextProfile) throw new Error("No doctor profile is linked to this staff user.");
      const [nextRows, nextBlockedDates] = await Promise.all([services.doctor.getDoctorAvailability(nextProfile.id), services.doctor.getDoctorBlockedDates(nextProfile.id)]);
      setProfile(nextProfile);
      setRows(nextRows.map((row) => ({
        id: row.id,
        clinic_id: row.clinicId || nextProfile.clinic_id,
        branch_id: row.branchId || nextProfile.branch_id,
        doctor_id: nextProfile.id,
        day_of_week: Number(row.weekday),
        start_time: row.startTime,
        end_time: row.endTime,
        break_start: row.breakStart,
        break_end: row.breakEnd,
        is_active: row.isActive,
        created_at: null,
      })));
      setBlockedDates(nextBlockedDates);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to load doctor availability.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void loadAvailability(); }, []);

  const availability: DoctorAvailability = useMemo(() => ({
    doctorId: profile?.id ?? "",
    weekly: dayNames.map((day, index) => {
      const row = rows.find((item) => item.day_of_week === index && item.is_active);
      return {
        day,
        enabled: Boolean(row),
        startTime: row?.start_time?.slice(0, 5) ?? "09:00",
        endTime: row?.end_time?.slice(0, 5) ?? "17:00",
        breakTime: row?.break_start && row?.break_end ? `${row.break_start.slice(0, 5)}-${row.break_end.slice(0, 5)}` : "",
        slotDurationMinutes: profile?.slot_duration_minutes ?? 15,
        maxAppointmentsPerSlot: profile?.max_appointments_per_slot ?? 1,
        maxAppointmentsPerDay: 0,
      };
    }),
    blockedDates: blockedDates.map((item) => ({ date: item.blocked_date, reason: item.reason ?? "" })),
  }), [blockedDates, profile, rows]);

  const saveDay = async (dayIndex: number, input: DaySaveInput) => {
    if (!profile) return;
    setSavingDay(dayIndex);
    try {
      const otherDays: TablesInsert<"doctor_availability">[] = rows.filter((row) => row.day_of_week !== dayIndex && row.is_active).map((row) => ({
        clinic_id: row.clinic_id,
        branch_id: row.branch_id,
        doctor_id: row.doctor_id,
        day_of_week: row.day_of_week,
        start_time: row.start_time,
        end_time: row.end_time,
        break_start: row.break_start,
        break_end: row.break_end,
        is_active: row.is_active,
      }));
      const nextRows: TablesInsert<"doctor_availability">[] = input.enabled ? [
        ...otherDays,
        {
          clinic_id: profile.clinic_id,
          branch_id: profile.branch_id,
          doctor_id: profile.id,
          day_of_week: dayIndex,
          start_time: input.startTime,
          end_time: input.endTime,
          break_start: input.breakStart || null,
          break_end: input.breakEnd || null,
          is_active: true,
        },
      ] : otherDays;
      await services.doctor.updateDoctorAvailability(profile.id, nextRows);
      toast.success(`${dayNames[dayIndex]} availability saved.`);
      await loadAvailability();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to save availability.");
    } finally {
      setSavingDay(null);
    }
  };

  const blockDate = async (input: { date: string; reason: string; emergencyLeave: boolean }) => {
    if (!profile) return;
    setLoading(true);
    try {
      await services.doctor.blockDoctorDate({
        clinic_id: profile.clinic_id,
        doctor_id: profile.id,
        blocked_date: input.date,
        reason: input.emergencyLeave ? `${input.reason || "Emergency leave"} (emergency)` : input.reason,
      });
      toast.success("Date blocked.");
      setOpen(false);
      await loadAvailability();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to block date.");
    } finally {
      setLoading(false);
    }
  };

  return <div className="space-y-6"><PageHeader title="Doctor Availability" description="Configure working hours used by appointment slots. Edit a day below and click Save on that card." action={<Button onClick={() => setOpen(true)} disabled={!profile}>Block date</Button>} />
    {loading && !profile ? <Card className="p-4 md:p-5 text-sm text-slate-500">Loading availability...</Card> : null}
    <div className="grid gap-4 xl:grid-cols-[1.2fr_.8fr]"><WeeklyAvailabilityEditor availability={availability} savingDay={savingDay} onSaveDay={saveDay} /><div className="space-y-6"><AvailabilityPreview availability={availability} /><Card className="p-4 md:p-5"><h2 className="font-semibold">Blocked dates</h2><div className="mt-3 space-y-2">{availability.blockedDates.map((blocked) => <p key={blocked.date} className="rounded-xl bg-danger-50 p-3 text-sm font-semibold text-danger-700">{blocked.date} - {blocked.reason || "Blocked"}</p>)}</div></Card></div></div>
    <BlockedDateModal open={open} onClose={() => setOpen(false)} onSave={blockDate} loading={loading} />
  </div>;
}
