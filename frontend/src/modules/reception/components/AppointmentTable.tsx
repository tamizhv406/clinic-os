import { Button } from "../../../components/ui";
import type { Appointment, AppointmentStatus } from "../types";
import { sourceLabel } from "../utils";
import { AppointmentCard } from "./AppointmentCard";
import { AppointmentStatusBadge, PaymentStatusBadge } from "./AppointmentStatusBadge";

type Props = {
  appointments: Appointment[];
  onStatusChange?: (id: string, status: AppointmentStatus) => void;
  onReschedule?: (appointment: Appointment) => void;
  onCancel?: (appointment: Appointment) => void;
};

export function AppointmentTable({ appointments, onStatusChange, onReschedule, onCancel }: Props) {
  if (appointments.length === 0) return <p className="text-sm text-slate-500">No appointments match the current filters.</p>;

  return <>
    <div className="grid gap-4 md:hidden">{appointments.map((appointment) => <AppointmentCard key={appointment.id} appointment={appointment} onStatusChange={onStatusChange} />)}</div>
    <div className="table-wrap hidden md:block"><table className="data-table">
      <thead><tr><th>Time</th><th>Token</th><th>Patient</th><th>Phone</th><th>Doctor</th><th>Service</th><th>Source</th><th>Status</th><th>Payment</th><th>Actions</th></tr></thead>
      <tbody>{appointments.map((appointment) => <tr key={appointment.id}>
        <td className="font-semibold">{appointment.time}</td>
        <td><span className="rounded-lg bg-slate-100 px-2 py-1 font-semibold">{appointment.token}</span></td>
        <td className="font-semibold">{appointment.patientName}</td>
        <td>{appointment.phone}</td>
        <td>{appointment.doctorName}</td>
        <td>{appointment.service}</td>
        <td>{sourceLabel[appointment.source]}</td>
        <td><AppointmentStatusBadge status={appointment.status} /></td>
        <td><PaymentStatusBadge status={appointment.paymentStatus} /></td>
        <td><div className="flex flex-wrap gap-2">
          <Button variant="secondary" className="min-h-8 px-3 py-1" onClick={() => onStatusChange?.(appointment.id, "arrived")}>Arrived</Button>
          <Button variant="secondary" className="min-h-8 px-3 py-1" onClick={() => onStatusChange?.(appointment.id, "waiting")}>Queue</Button>
          {onReschedule && <Button variant="ghost" className="min-h-8 px-3 py-1" onClick={() => onReschedule(appointment)}>Reschedule</Button>}
          {onCancel && <Button variant="ghost" className="min-h-8 px-3 py-1" onClick={() => onCancel(appointment)}>Cancel</Button>}
        </div></td>
      </tr>)}</tbody>
    </table></div>
  </>;
}
