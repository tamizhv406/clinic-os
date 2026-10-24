import { useEffect, useMemo, useState } from "react";
import { CalendarPlus } from "lucide-react";
import { toast } from "sonner";
import { Button, Card, Input, PageHeader, Select } from "../../../components/ui";
import { services } from "../../../services/serviceProvider";
import type { AppointmentRecord, PatientRecord } from "../../../shared/types/domain";
import type { Tables } from "../../../shared/types/database.types";
import { AppointmentFormModal } from "../components/AppointmentFormModal";
import { AppointmentTable } from "../components/AppointmentTable";
import { CancelAppointmentModal } from "../components/CancelAppointmentModal";
import { RescheduleAppointmentModal } from "../components/RescheduleAppointmentModal";
import type { Appointment, AppointmentSource, AppointmentStatus } from "../types";

type DoctorOption = Tables<"doctor_profiles"> & { label: string };

const toSource = (source: string): AppointmentSource => {
  if (source === "phone") return "phone_call";
  if (source === "qr") return "qr_booking";
  if (source === "whatsapp" || source === "website" || source === "walk_in") return source;
  return "walk_in";
};

export default function Appointments() {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<AppointmentStatus | "all">("all");
  const [source, setSource] = useState<AppointmentSource | "all">("all");
  const [doctorId, setDoctorId] = useState("all");
  const [date, setDate] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [rescheduleTarget, setRescheduleTarget] = useState<Appointment | null>(null);
  const [cancelTarget, setCancelTarget] = useState<Appointment | null>(null);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [doctors, setDoctors] = useState<DoctorOption[]>([]);
  const [loading, setLoading] = useState(false);

  const loadAppointments = async () => {
    setLoading(true);
    try {
      const [appointmentRows, doctorRows] = await Promise.all([services.appointments.getAppointments(), services.doctor.getDoctorProfiles()]);
      const doctorOptions = await Promise.all(doctorRows.map(async (doctor) => {
        try {
          const staff = await services.users.getStaffUserById(doctor.staff_id);
          return { ...doctor, label: staff.fullName };
        } catch {
          return { ...doctor, label: doctor.specialization || doctor.department || "Doctor" };
        }
      }));
      const patientIds = Array.from(new Set(appointmentRows.map((item) => item.patientId)));
      const patientEntries = await Promise.all(patientIds.map(async (id): Promise<[string, PatientRecord | null]> => {
        try {
          return [id, await services.patients.getPatientById(id)];
        } catch {
          return [id, null];
        }
      }));
      const patientMap = new Map(patientEntries);
      setDoctors(doctorOptions);
      setAppointments(appointmentRows.map((appointment) => mapAppointment(appointment, patientMap.get(appointment.patientId), doctorOptions.find((doctor) => doctor.id === appointment.doctorId))));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to load appointments.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void loadAppointments(); }, []);

  const rows = useMemo(() => appointments.filter((appointment) =>
    (status === "all" || appointment.status === status) &&
    (source === "all" || appointment.source === source) &&
    (doctorId === "all" || appointment.doctorId === doctorId) &&
    (!date || appointment.date === date) &&
    `${appointment.patientName} ${appointment.phone} ${appointment.token}`.toLowerCase().includes(query.toLowerCase())
  ), [appointments, query, status, source, doctorId, date]);

  const updateStatus = async (id: string, nextStatus: AppointmentStatus) => {
    setLoading(true);
    try {
      await services.appointments.updateAppointmentStatus(id, nextStatus);
      toast.success("Appointment updated.");
      await loadAppointments();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to update appointment.");
    } finally {
      setLoading(false);
    }
  };

  return <div className="space-y-6"><PageHeader title="Appointments" description="Search, filter, book slots, and push patients into queue." action={<Button icon={<CalendarPlus className="size-4" />} onClick={() => setAddOpen(true)}>Add Appointment</Button>} />
    <Card className="p-4"><div className="grid gap-4 lg:grid-cols-6"><Input className="lg:col-span-2" placeholder="Search appointment" value={query} onChange={(event) => setQuery(event.target.value)} /><Select value={doctorId} onChange={(event) => setDoctorId(event.target.value)}><option value="all">All doctors</option>{doctors.map((doctor) => <option key={doctor.id} value={doctor.id}>{doctor.label}</option>)}</Select><Select value={status} onChange={(event) => setStatus(event.target.value as AppointmentStatus | "all")}><option value="all">All status</option><option value="booked">Booked</option><option value="arrived">Arrived</option><option value="waiting">Waiting</option><option value="in_consultation">In consultation</option><option value="completed">Completed</option><option value="cancelled">Cancelled</option><option value="no_show">No-show</option></Select><Select value={source} onChange={(event) => setSource(event.target.value as AppointmentSource | "all")}><option value="all">All sources</option><option value="walk_in">Walk-in</option><option value="phone_call">Phone call</option><option value="qr_booking">QR booking</option><option value="whatsapp">WhatsApp</option><option value="website">Website</option></Select><Input type="date" value={date} onChange={(event) => setDate(event.target.value)} /></div><div className="mt-3 flex flex-wrap gap-2"><Button variant="secondary" className="min-h-8 px-3 py-1" loading={loading} onClick={() => void loadAppointments()}>Refresh</Button></div></Card>
    <Card className="p-4 md:p-5"><AppointmentTable appointments={rows} onStatusChange={updateStatus} onReschedule={setRescheduleTarget} onCancel={setCancelTarget} /></Card>
    <AppointmentFormModal open={addOpen} onClose={() => setAddOpen(false)} onCreated={loadAppointments} />
    <RescheduleAppointmentModal appointment={rescheduleTarget} onClose={() => setRescheduleTarget(null)} onDone={loadAppointments} />
    <CancelAppointmentModal appointment={cancelTarget} onClose={() => setCancelTarget(null)} onDone={loadAppointments} />
  </div>;
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
    paymentStatus: appointment.paymentStatus as Appointment["paymentStatus"],
    notes: appointment.reason,
  };
}
