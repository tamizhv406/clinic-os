import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button, Modal, Textarea } from "../../../components/ui";
import { services } from "../../../services/serviceProvider";
import type { Appointment } from "../types";

export function CancelAppointmentModal({ appointment, onClose, onDone }: { appointment: Appointment | null; onClose: () => void; onDone?: () => void }) {
  const [reason, setReason] = useState("");
  const [notify, setNotify] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => { setReason(""); setNotify(true); }, [appointment]);

  const cancel = async () => {
    if (!appointment) return;
    if (!reason.trim()) return toast.error("Add a cancellation reason.");
    setSaving(true);
    try {
      await services.appointments.cancelAppointment(appointment.id, reason.trim());
      if (notify && appointment.phone) {
        await services.whatsapp.sendAppointmentPlaceholder({
          phone: appointment.phone,
          body: `Hello ${appointment.patientName}, your appointment on ${appointment.date} at ${appointment.time} has been cancelled. Reason: ${reason.trim()}.`,
          relatedId: appointment.id,
          metadata: { type: "appointment_cancelled" },
        }).catch(() => toast.error("Appointment cancelled, but the WhatsApp notice could not be queued."));
      }
      toast.success("Appointment cancelled.");
      onDone?.();
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to cancel this appointment.");
    } finally {
      setSaving(false);
    }
  };

  return <Modal open={Boolean(appointment)} onClose={onClose} title="Cancel Appointment">
    <div className="space-y-4">
      <p className="rounded-xl bg-slate-50 p-3 text-sm text-slate-600">{appointment?.patientName} · {appointment?.doctorName} · {appointment?.date} {appointment?.time}</p>
      <label className="text-xs font-semibold">Cancellation reason<Textarea className="mt-1" placeholder="Patient requested cancellation, doctor unavailable..." value={reason} onChange={(event) => setReason(event.target.value)} /></label>
      <label className="flex items-center gap-2 text-sm text-slate-600"><input type="checkbox" checked={notify} onChange={(event) => setNotify(event.target.checked)} /> Send WhatsApp cancellation notice</label>
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose}>Keep appointment</Button>
        <Button variant="danger" loading={saving} onClick={() => void cancel()}>Confirm cancel</Button>
      </div>
    </div>
  </Modal>;
}
