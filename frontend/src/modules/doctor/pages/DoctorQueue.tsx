import { useEffect, useMemo, useState } from "react";
import { Stethoscope } from "lucide-react";
import { toast } from "sonner";
import { Button, PageHeader } from "../../../components/ui";
import { services } from "../../../services/serviceProvider";
import type { AppointmentRecord, PatientRecord } from "../../../shared/types/domain";
import { DoctorEmptyState } from "../components/DoctorEmptyState";
import { DoctorQueueTable } from "../components/DoctorQueueTable";
import { DoctorStatsGrid } from "../components/DoctorStatsGrid";
import type { DoctorQueueItem, DoctorStats } from "../types";

export default function DoctorQueue() {
  const [doctorName, setDoctorName] = useState("Doctor");
  const [clinicName, setClinicName] = useState("Vernex Clinic");
  const [queue, setQueue] = useState<DoctorQueueItem[]>([]);
  const [loading, setLoading] = useState(false);

  const loadQueue = async () => {
    setLoading(true);
    try {
      const context = await services.auth.getCurrentAuthContext();
      const profile = await services.doctor.getDoctorProfileByStaffId(context.staffProfileId);
      if (!profile) throw new Error("No doctor profile is linked to this staff user.");
      const appointments = await services.appointments.getDoctorAppointments(profile.id);
      const patientIds = Array.from(new Set(appointments.map((item) => item.patientId)));
      const patientEntries = await Promise.all(patientIds.map(async (id): Promise<[string, PatientRecord | null]> => {
        try {
          return [id, await services.patients.getPatientById(id)];
        } catch {
          return [id, null];
        }
      }));
      const patientMap = new Map(patientEntries);
      setDoctorName(context.fullName);
      setClinicName((context.clinic as { name?: string } | null)?.name ?? "Vernex Clinic");
      setQueue(appointments.filter((appointment) => ["arrived", "waiting", "in_consultation", "completed", "no_show"].includes(appointment.status)).map((appointment) => mapQueueItem(appointment, patientMap.get(appointment.patientId), context.fullName)));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to load doctor queue.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void loadQueue(); }, []);

  const stats: DoctorStats = useMemo(() => ({
    waitingPatients: queue.filter((item) => item.status === "waiting").length,
    inConsultation: queue.filter((item) => item.status === "in_consultation").length,
    completedToday: queue.filter((item) => item.status === "completed").length,
    followUpsDue: 0,
    averageWaitingTime: 0,
    prescriptionsSent: 0,
  }), [queue]);

  const whatsappAppointment = queue.find((item) => item.source.toLowerCase() === "whatsapp");

  return <div className="space-y-6"><PageHeader title="Good morning, Doctor" description={`${doctorName} - ${clinicName} - Active queue`} action={<Button icon={<Stethoscope className="size-4" />} loading={loading} onClick={() => void loadQueue()}>Refresh Queue</Button>} />{whatsappAppointment && <div className="rounded-xl border border-info-200 bg-info-50 p-4"><p className="text-xs font-semibold uppercase text-info-700">New WhatsApp Appointment</p><div className="mt-2 flex flex-wrap items-center justify-between gap-4"><div><h2 className="font-semibold text-slate-900">{whatsappAppointment.patientName}</h2><p className="text-sm text-slate-700">{whatsappAppointment.department?.replace("_", " ")} - {whatsappAppointment.appointmentTime} - {whatsappAppointment.mainProblem}</p></div><Button to={`/doctor/consultation/${whatsappAppointment.patientId}`} variant="secondary">Open consultation</Button></div></div>}<DoctorStatsGrid stats={stats} />{queue.length ? <DoctorQueueTable items={queue} /> : <DoctorEmptyState />}</div>;
}

function mapQueueItem(appointment: AppointmentRecord, patient?: PatientRecord | null, doctorName = "Doctor"): DoctorQueueItem {
  return {
    id: appointment.id,
    token: appointment.tokenNumber || "Pending",
    appointmentId: appointment.id,
    tokenNumber: appointment.tokenNumber,
    patientId: appointment.patientId,
    patientName: patient?.fullName ?? "Unknown patient",
    phone: patient?.phone,
    whatsappNumber: patient?.whatsappNumber,
    age: patient?.age ?? 0,
    gender: patient?.gender ?? "other",
    department: appointment.department,
    doctorId: appointment.doctorId,
    doctorName,
    appointmentDate: appointment.date,
    appointmentTime: appointment.time,
    mainProblem: appointment.reason,
    reason: appointment.reason || "Appointment",
    source: appointment.source,
    waitingMinutes: 0,
    previousVisit: false,
    isNewPatient: false,
    tags: [],
    status: appointment.status === "arrived" ? "waiting" : appointment.status as DoctorQueueItem["status"],
  };
}
