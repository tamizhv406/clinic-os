import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button, Input, Modal, Select, Textarea } from "../../../components/ui";
import { services } from "../../../services/serviceProvider";
import type { Appointment } from "../types";

export function RescheduleAppointmentModal({ appointment, onClose, onDone }: { appointment: Appointment | null; onClose: () => void; onDone?: () => void }) {
  const [date, setDate] = useState("");
  const [slotId, setSlotId] = useState("");
  const [slots, setSlots] = useState<Array<{ id: string; label: string }>>([]);
  const [reason, setReason] = useState("");
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setDate(appointment?.date ?? "");
    setSlotId(""); setReason(""); setSlots([]);
  }, [appointment]);

  // Slots are generated on demand for the doctor already assigned to this appointment.
  useEffect(() => {
    if (!appointment?.doctorId || !date) { setSlots([]); return; }
    let mounted = true;
    setLoadingSlots(true);
    void services.doctor
      .getAvailableSlots(appointment.doctorId, date)
      .then((rows) => { if (mounted) setSlots(rows.map((slot) => ({ id: slot.id, label: String(slot.start_time).slice(0, 5) }))); })
      .catch((error) => { if (mounted) toast.error(error instanceof Error ? error.message : "Unable to load slots."); })
      .finally(() => { if (mounted) setLoadingSlots(false); });
    return () => { mounted = false; };
  }, [appointment?.doctorId, date]);

  const save = async () => {
    if (!appointment) return;
    if (!appointment.doctorId) return toast.error("Assign a doctor before rescheduling.");
    if (!slotId) return toast.error("Pick a new time slot.");
    setSaving(true);
    try {
      await services.appointments.assignDoctor(appointment.id, appointment.doctorId, slotId);
      if (reason.trim()) {
        await services.appointments.updateAppointmentStatus(appointment.id, "booked");
      }
      toast.success("Appointment rescheduled.");
      onDone?.();
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to reschedule this appointment.");
    } finally {
      setSaving(false);
    }
  };

  return <Modal open={Boolean(appointment)} onClose={onClose} title="Reschedule Appointment">
    <div className="space-y-4">
      <p className="rounded-xl bg-slate-50 p-3 text-sm text-slate-600">{appointment?.patientName} · {appointment?.doctorName} · currently {appointment?.date} {appointment?.time}</p>
      <label className="text-xs font-semibold">New date<Input className="mt-1" type="date" value={date} onChange={(event) => setDate(event.target.value)} /></label>
      <label className="text-xs font-semibold">New time slot
        <Select className="mt-1" value={slotId} onChange={(event) => setSlotId(event.target.value)} disabled={loadingSlots || slots.length === 0}>
          <option value="">{loadingSlots ? "Loading slots..." : slots.length === 0 ? "No open slots on this date" : "Select a slot"}</option>
          {slots.map((slot) => <option key={slot.id} value={slot.id}>{slot.label}</option>)}
        </Select>
      </label>
      <label className="text-xs font-semibold">Reason<Textarea className="mt-1" placeholder="Why is this being rescheduled?" value={reason} onChange={(event) => setReason(event.target.value)} /></label>
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose}>Close</Button>
        <Button loading={saving} onClick={() => void save()}>Save</Button>
      </div>
    </div>
  </Modal>;
}
