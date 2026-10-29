import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, CalendarPlus, UserPlus } from "lucide-react";
import { Button, Card, ErrorState, LoadingSkeleton, PageHeader } from "../../../components/ui";
import { services } from "../../../services/serviceProvider";
import type { AppointmentRecord, PatientRecord } from "../../../shared/types/domain";
import type { Tables } from "../../../shared/types/database.types";
import { AppointmentTable } from "../components/AppointmentTable";
import { PatientSearchPanel } from "../components/PatientSearchPanel";
import { QuickActions } from "../components/QuickActions";
import { QueueTokenCard } from "../components/QueueTokenCard";
import { ReceptionStatsGrid } from "../components/ReceptionStatsGrid";
import { WhatsAppBookingPanel } from "../components/WhatsAppBookingPanel";
import type { Appointment, AppointmentSource, BillingShortcut, QueueItem, ReceptionStats } from "../types";
import { loadPendingBills } from "../pendingBills";
import { rupee } from "../utils";
import { localDateISO } from "../../../utils/formatDate";

type DoctorOption = Tables<"doctor_profiles"> & { label: string };

const toSource = (source: string): AppointmentSource =>
  source === "phone"
    ? "phone_call"
    : source === "qr"
    ? "qr_booking"
    : source === "whatsapp" || source === "website" || source === "walk_in"
    ? source
    : "walk_in";

export default function ReceptionDashboard() {
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [clinicName, setClinicName] = useState("");
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [bills, setBills] = useState<BillingShortcut[]>([]);

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const [context, appointmentRows, queueRows, doctorRows, pendingBills] = await Promise.all([
        services.auth.getCurrentAuthContext(),
        services.appointments.getTodayAppointments(),
        services.appointments.getQueue(),
        services.doctor.getDoctorProfiles(),
        loadPendingBills(),
      ]);
      const doctors = await loadDoctorLabels(doctorRows);
      const patientIds = Array.from(new Set([...appointmentRows, ...queueRows].map((item) => item.patientId)));
      const patientEntries = await Promise.all(
        patientIds.map(async (id): Promise<[string, PatientRecord | null]> => {
          try {
            return [id, await services.patients.getPatientById(id)];
          } catch {
            return [id, null];
          }
        })
      );
      const patientMap = new Map(patientEntries);
      const clinicObj = context.clinic as { name?: string } | null;
      setClinicName(clinicObj?.name || "");
      setBills(pendingBills);
      setAppointments(
        appointmentRows.map((appointment) =>
          mapAppointment(
            appointment,
            patientMap.get(appointment.patientId),
            doctors.find((doctor) => doctor.id === appointment.doctorId)
          )
        )
      );
      setQueue(
        queueRows
          .slice(0, 3)
          .map((appointment) =>
            mapQueueItem(
              appointment,
              patientMap.get(appointment.patientId),
              doctors.find((doctor) => doctor.id === appointment.doctorId)
            )
          )
      );
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Unable to load reception dashboard.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  const today = localDateISO();
  const now = new Date();
  const greeting = now.getHours() < 12 ? "Good morning" : now.getHours() < 18 ? "Good afternoon" : "Good evening";

  const stats: ReceptionStats = useMemo(
    () => ({
      todayAppointments: appointments.filter((item) => item.date === today).length,
      waitingPatients: queue.filter((item) => item.status === "waiting" || item.status === "arrived").length,
      inConsultation: queue.filter((item) => item.status === "in_consultation").length,
      completed: appointments.filter((item) => item.status === "completed").length,
      cancelledNoShow: appointments.filter((item) => item.status === "cancelled" || item.status === "no_show").length,
      pendingBills: bills.length,
      activeDoctors: new Set(appointments.map((item) => item.doctorId).filter(Boolean)).size,
    }),
    [appointments, bills, queue, today]
  );

  if (loading)
    return (
      <main aria-busy="true">
        <PageHeader title="Reception dashboard" description="Loading today’s clinic activity…" />
        <LoadingSkeleton rows={5} />
      </main>
    );

  if (loadError)
    return (
      <div className="space-y-6">
        <PageHeader title="Reception dashboard" description={clinicName} />
        <ErrorState title="Dashboard didn’t load" description={loadError} onRetry={() => void loadDashboard()} />
      </div>
    );

  return (
    <div className="space-y-6">
      <PageHeader
        title={`${greeting}, Reception`}
        description={`${clinicName ? `${clinicName} · ` : ""}${stats.activeDoctors} doctors scheduled today`}
        action={
          <div className="flex gap-2">
            <Button to="/reception/new-patient" icon={<UserPlus className="size-4" />}>
              Add Walk-in
            </Button>
            <Button to="/reception/appointments" variant="secondary" icon={<CalendarPlus className="size-4" />}>
              Create Appointment
            </Button>
          </div>
        }
      />
      <PatientSearchPanel />
      <ReceptionStatsGrid stats={stats} />
      <QuickActions />
      <div className="grid gap-4 xl:grid-cols-[1.3fr_.7fr]">
        <Card className="p-4 md:p-5">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="font-semibold">Live Queue Preview</h2>
              <p className="text-xs text-slate-500">Fast token actions for front desk</p>
            </div>
            <Link className="text-sm font-semibold text-brand-700" to="/reception/queue">
              Open Queue <ArrowRight className="inline size-4" />
            </Link>
          </div>
          <div className="grid gap-4 lg:grid-cols-3">
            {queue.map((item) => (
              <QueueTokenCard key={item.id} item={item} />
            ))}
          </div>
        </Card>
        <WhatsAppBookingPanel />
      </div>
      <Card className="p-4 md:p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-semibold">Upcoming Appointments</h2>
          <Link className="text-sm font-semibold text-brand-700" to="/reception/appointments">
            Manage all
          </Link>
        </div>
        <AppointmentTable appointments={appointments.slice(0, 4)} />
      </Card>
      <Card className="p-4 md:p-5">
        <h2 className="font-semibold">Pending Billing</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          {bills.length > 0 ? (
            bills.slice(0, 6).map((bill) => (
              <div key={bill.id} className="rounded-xl border p-4">
                <p className="font-semibold">{bill.patientName}</p>
                <p className="text-sm text-slate-500">
                  {bill.service}
                  {bill.doctorName ? ` - ${bill.doctorName}` : ""}
                </p>
                <div className="mt-3 flex items-center justify-between">
                  <span className="font-['Manrope'] text-xl font-semibold">
                    {rupee(bill.amount - bill.discount)}
                  </span>
                  <Button to="/reception/billing" variant="secondary" className="min-h-8 px-3 py-1">
                    Collect
                  </Button>
                </div>
              </div>
            ))
          ) : (
            <p className="text-sm text-slate-500">Every invoice is fully settled.</p>
          )}
        </div>
      </Card>
    </div>
  );
}

async function loadDoctorLabels(rows: Tables<"doctor_profiles">[]): Promise<DoctorOption[]> {
  return Promise.all(
    rows.map(async (doctor) => {
      try {
        const staff = await services.users.getStaffUserById(doctor.staff_id);
        return { ...doctor, label: staff.fullName };
      } catch {
        return { ...doctor, label: doctor.specialization || doctor.department || "Doctor" };
      }
    })
  );
}

function mapAppointment(appointment: AppointmentRecord, patient?: PatientRecord | null, doctor?: DoctorOption): Appointment {
  return {
    id: appointment.id,
    token: appointment.tokenNumber || "Pending",
    patientId: appointment.patientId,
    patientName: patient?.fullName ?? "Unknown patient",
    phone: patient?.phone ?? "",
    age: patient?.age ?? 0,
    gender: patient?.gender ?? "other",
    doctorId: appointment.doctorId,
    doctorName: doctor?.label ?? "Unassigned",
    service: appointment.department || "General",
    date: appointment.date,
    time: appointment.time,
    source: toSource(appointment.source),
    status: appointment.status,
    paymentStatus: "pending",
    notes: appointment.reason,
  };
}

function mapQueueItem(appointment: AppointmentRecord, patient?: PatientRecord | null, doctor?: DoctorOption): QueueItem {
  return {
    id: appointment.id,
    token: appointment.tokenNumber || "Pending",
    patientName: patient?.fullName ?? "Unknown patient",
    age: patient?.age ?? 0,
    gender: patient?.gender ?? "other",
    doctorName: doctor?.label ?? "Unassigned",
    service: appointment.department || "General",
    status: appointment.status,
    arrivalTime: appointment.time || appointment.date,
    waitingMinutes: 0,
    reason: appointment.reason || "Appointment",
  };
}
