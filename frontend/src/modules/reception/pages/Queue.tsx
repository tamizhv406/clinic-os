import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button, PageHeader } from "../../../components/ui";
import { services } from "../../../services/serviceProvider";
import type { AppointmentRecord, PatientRecord } from "../../../shared/types/domain";
import type { Tables } from "../../../shared/types/database.types";
import { QueueBoard } from "../components/QueueBoard";
import type { QueueItem } from "../types";

type DoctorOption = Tables<"doctor_profiles"> & { label: string };

export default function Queue() {
  const [items, setItems] = useState<QueueItem[]>([]);
  const [loading, setLoading] = useState(false);

  const loadQueue = async () => {
    setLoading(true);
    try {
      const [queueRows, doctorRows] = await Promise.all([services.appointments.getQueue(), services.doctor.getDoctorProfiles()]);
      const doctors = await Promise.all(doctorRows.map(async (doctor) => {
        try {
          const staff = await services.users.getStaffUserById(doctor.staff_id);
          return { ...doctor, label: staff.fullName };
        } catch {
          return { ...doctor, label: doctor.specialization || doctor.department || "Doctor" };
        }
      }));
      const patientIds = Array.from(new Set(queueRows.map((item) => item.patientId)));
      const patientEntries = await Promise.all(patientIds.map(async (id): Promise<[string, PatientRecord | null]> => {
        try {
          return [id, await services.patients.getPatientById(id)];
        } catch {
          return [id, null];
        }
      }));
      const patientMap = new Map(patientEntries);
      setItems(queueRows.map((appointment) => mapQueueItem(appointment, patientMap.get(appointment.patientId), doctors.find((doctor) => doctor.id === appointment.doctorId))));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to load queue.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void loadQueue(); }, []);

  return <div className="space-y-6"><PageHeader title="Live Queue" description="Readable token board for waiting, in-consultation, completed, and no-show patients." action={<Button loading={loading} onClick={() => void loadQueue()}>Refresh queue</Button>} /><QueueBoard items={items} /></div>;
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
