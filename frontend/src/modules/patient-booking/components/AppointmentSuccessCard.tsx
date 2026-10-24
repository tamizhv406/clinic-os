import { CalendarPlus, CheckCircle2, Printer } from "lucide-react";
import { Button } from "../../../components/ui";
import type { BookingStatusResult, ClinicBookingProfile } from "../types";

function calendarHref(result: BookingStatusResult, clinic: ClinicBookingProfile) {
  const details = encodeURIComponent(`Appointment with ${result.doctorName}. Token ${result.token}. Booking ID ${result.bookingId}.`);
  const text = encodeURIComponent(`Appointment at ${clinic.name}`);
  const location = encodeURIComponent(clinic.address);
  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${text}&details=${details}&location=${location}`;
}

export function AppointmentSuccessCard({ result, clinic }: { result: BookingStatusResult; clinic: ClinicBookingProfile }) {
  const whatsappDigits = clinic.whatsapp.replace(/\D/g, "");
  return <div className="card mx-auto w-full max-w-xl p-6 text-center">
    <div className="mx-auto grid size-16 place-items-center rounded-full bg-success-50 text-success-700"><CheckCircle2 className="size-9" /></div>
    <h1 className="mt-5 text-2xl font-semibold">Appointment Confirmed</h1>
    <p className="mt-2 text-sm text-slate-500">Your appointment is confirmed. Please arrive 10 minutes early.</p>
    <div className="mt-5 rounded-xl bg-slate-50 p-4 text-left text-sm">
      <p><b>Booking ID:</b> {result.bookingId}</p>
      <p><b>Token:</b> {result.token}</p>
      <p><b>Doctor:</b> {result.doctorName}</p>
      <p><b>Date/time:</b> {result.dateTime}</p>
      <p><b>Patient:</b> {result.patientName}</p>
      <p><b>Clinic:</b> {clinic.address || clinic.name}</p>
    </div>
    <div className="mt-5 grid gap-2 sm:grid-cols-2">
      <a href={calendarHref(result, clinic)} target="_blank" rel="noreferrer"><Button className="w-full" variant="secondary" icon={<CalendarPlus className="size-4" />}>Add to Calendar</Button></a>
      <Button variant="secondary" icon={<Printer className="size-4" />} onClick={() => window.print()}>Print</Button>
      {whatsappDigits && <a href={`https://wa.me/${whatsappDigits}`} target="_blank" rel="noreferrer"><Button className="w-full" variant="secondary">WhatsApp clinic</Button></a>}
      {clinic.phone && <a href={`tel:${clinic.phone.replace(/\s/g, "")}`}><Button className="w-full" variant="secondary">Call clinic</Button></a>}
      <Button to={`/book/${clinic.slug}`} className="sm:col-span-2 w-full">Back to clinic page</Button>
    </div>
  </div>;
}
