import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button, Input, Modal, Select, Textarea } from "../../../components/ui";
import { services } from "../../../services/serviceProvider";
import type { PatientRecord } from "../../../shared/types/domain";
import { localDateISO } from "../../../utils/formatDate";
import type { Tables } from "../../../shared/types/database.types";

type DoctorOption = Tables<"doctor_profiles"> & { label: string };

type Props = {
  open: boolean;
  onClose: () => void;
  onCreated?: () => void;
};

const today = localDateISO();

export function AppointmentFormModal({ open, onClose, onCreated }: Props) {
  const [patients, setPatients] = useState<PatientRecord[]>([]);
  const [doctors, setDoctors] = useState<DoctorOption[]>([]);
  const [slots, setSlots] = useState<Tables<"appointment_slots">[]>([]);
  const [patientId, setPatientId] = useState("");
  const [doctorId, setDoctorId] = useState("");
  const [slotId, setSlotId] = useState("");
  const [date, setDate] = useState(today);
  const [source, setSource] = useState("reception");
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [slotLoading, setSlotLoading] = useState(false);

  const selectedDoctor = useMemo(() => doctors.find((doctor) => doctor.id === doctorId), [doctorId, doctors]);

  useEffect(() => {
    if (!open) return;
    let mounted = true;
    setLoading(true);
    Promise.all([services.patients.getPatients({ status: "active" }), services.doctor.getDoctorProfiles()])
      .then(async ([nextPatients, profiles]) => {
        const withLabels = await Promise.all(profiles.map(async (profile) => {
          try {
            const staff = await services.users.getStaffUserById(profile.staff_id);
            return { ...profile, label: `${staff.fullName} (${profile.specialization || profile.department || "Doctor"})` };
          } catch {
            return { ...profile, label: profile.specialization || profile.department || "Doctor" };
          }
        }));
        if (!mounted) return;
        setPatients(nextPatients);
        setDoctors(withLabels);
        setPatientId((current) => current || nextPatients[0]?.id || "");
        setDoctorId((current) => current || withLabels[0]?.id || "");
      })
      .catch((error) => toast.error(error instanceof Error ? error.message : "Unable to load appointment form data."))
      .finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, [open]);

  useEffect(() => {
    if (!open || !doctorId || !date) return;
    let mounted = true;
    setSlotId("");
    setSlotLoading(true);
    services.doctor.getAvailableSlots(doctorId, date)
      .then((nextSlots) => {
        if (!mounted) return;
        setSlots(nextSlots);
        setSlotId(nextSlots[0]?.id ?? "");
      })
      .catch((error) => toast.error(error instanceof Error ? error.message : "Unable to load slots."))
      .finally(() => { if (mounted) setSlotLoading(false); });
    return () => { mounted = false; };
  }, [open, doctorId, date]);

  const generateSlots = async () => {
    if (!doctorId || !date) return;
    setLoading(true);
    try {
      await services.doctor.generateSlotsForDoctor(doctorId, date);
      const nextSlots = await services.doctor.getAvailableSlots(doctorId, date);
      setSlots(nextSlots);
      setSlotId(nextSlots[0]?.id ?? "");
      toast.success("Slots generated.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to generate slots.");
    } finally {
      setLoading(false);
    }
  };

  const createAppointment = async () => {
    if (!patientId || !doctorId || !slotId || !selectedDoctor) {
      toast.error("Select patient, doctor, date, and slot.");
      return;
    }
    setLoading(true);
    try {
      await services.appointments.bookAppointmentWithSlot({
        patient_id: patientId,
        slot_id: slotId,
        branch_id: selectedDoctor.branch_id,
        department: selectedDoctor.department || selectedDoctor.specialization || "General",
        main_problem: reason,
        source,
        status: "booked",
        is_new_patient: false,
        metadata: { created_from: "reception_appointments" },
      });
      toast.success("Appointment created.");
      onCreated?.();
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to create appointment.");
    } finally {
      setLoading(false);
    }
  };

  return <Modal open={open} onClose={onClose} title="Add Appointment">
    <div className="max-h-[70vh] space-y-4 overflow-y-auto pr-1">
      <div className="grid gap-4 sm:grid-cols-2">
        <Select label="Patient" value={patientId} onChange={(event) => setPatientId(event.target.value)} disabled={loading}>{patients.map((patient) => <option key={patient.id} value={patient.id}>{patient.fullName} - {patient.phone}</option>)}</Select>
        <Select label="Doctor" value={doctorId} onChange={(event) => setDoctorId(event.target.value)} disabled={loading}><option value="">{doctors.length ? "Select doctor" : "No active doctors"}</option>{doctors.map((doctor) => <option key={doctor.id} value={doctor.id}>{doctor.label}</option>)}</Select>
        <Input label="Date" type="date" value={date} onChange={(event) => setDate(event.target.value)} />
        <Select label="Time slot" value={slotId} onChange={(event) => setSlotId(event.target.value)} disabled={loading || slotLoading || slots.length === 0}>
          <option value="">{slotLoading ? "Loading slots..." : slots.length ? "Select slot" : "No available slots"}</option>
          {slots.map((slot) => <option key={slot.id} value={slot.id}>{slot.start_time} - {slot.end_time} ({slot.booked_count}/{slot.capacity})</option>)}
        </Select>
        <Select label="Source" value={source} onChange={(event) => setSource(event.target.value)}><option value="reception">Reception</option><option value="walk_in">Walk-in</option><option value="phone">Phone</option><option value="whatsapp">WhatsApp</option><option value="website">Website</option></Select>
      </div>
      {!slotLoading && doctorId && date && slots.length === 0 && <div className="rounded-xl bg-warning-50 p-3 text-sm font-semibold text-warning-700">No slots available. Check doctor availability.</div>}
      <Textarea label="Notes" value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Reason, symptoms, or reception notes" />
      <div className="flex justify-between gap-2">
        <Button variant="secondary" type="button" onClick={generateSlots} loading={loading} disabled={!doctorId || !date}>Generate slots</Button>
        <div className="flex gap-2"><Button variant="secondary" onClick={onClose}>Cancel</Button><Button onClick={createAppointment} loading={loading} disabled={!patientId || !doctorId || !slotId}>Create appointment</Button></div>
      </div>
    </div>
  </Modal>;
}
