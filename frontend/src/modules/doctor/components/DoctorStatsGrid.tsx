import { Calendar, CheckCircle2, Clock3, FileCheck, Stethoscope, Users } from "lucide-react";
import { StatsCard } from "../../../components/ui";
import type { DoctorStats } from "../types";

export function DoctorStatsGrid({ stats }: { stats: DoctorStats }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
      <StatsCard
        label="Today's Appointments"
        value={String(stats.todayTotal)}
        icon={Calendar}
        tone="blue"
      />
      <StatsCard
        label="Checked In"
        value={String(stats.checkedIn)}
        icon={CheckCircle2}
        tone="amber"
      />
      <StatsCard
        label="Waiting Queue"
        value={String(stats.waitingPatients)}
        icon={Users}
        tone="amber"
      />
      <StatsCard
        label="In Consultation"
        value={String(stats.inConsultation)}
        icon={Stethoscope}
        tone="violet"
      />
      <StatsCard
        label="Completed Today"
        value={String(stats.completedToday)}
        icon={FileCheck}
        tone="blue"
      />
      <StatsCard
        label="Upcoming This Week"
        value={String(stats.upcomingThisWeek)}
        icon={Clock3}
        tone="blue"
      />
    </div>
  );
}
