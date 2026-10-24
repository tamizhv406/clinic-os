import { Clock, FileHeart, Hourglass, Send, Stethoscope, Users } from "lucide-react";
import { StatsCard } from "../../../components/ui";
import type { DoctorStats } from "../types";

export function DoctorStatsGrid({ stats }: { stats: DoctorStats }) {
  return <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6"><StatsCard label="Waiting Patients" value={String(stats.waitingPatients)} icon={Users} tone="amber" /><StatsCard label="In Consultation" value={String(stats.inConsultation)} icon={Stethoscope} tone="violet" /><StatsCard label="Completed Today" value={String(stats.completedToday)} icon={FileHeart} /><StatsCard label="Follow-ups Due" value={String(stats.followUpsDue)} icon={Hourglass} tone="blue" /><StatsCard label="Average Waiting" value={`${stats.averageWaitingTime}m`} icon={Clock} tone="amber" /><StatsCard label="Prescriptions Sent" value={String(stats.prescriptionsSent)} icon={Send} /></div>;
}
