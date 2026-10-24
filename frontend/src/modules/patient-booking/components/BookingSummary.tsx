import type { AvailableDate, AvailableSlot, BookingDoctor, BookingService, ClinicBookingProfile, PatientBookingInput, PaymentOption } from "../types";
import { paymentLabel, rupee } from "../utils";

export function BookingSummary({ clinic, doctor, service, date, slot, patient, paymentOption }: {
  clinic: ClinicBookingProfile;
  doctor?: BookingDoctor;
  service?: BookingService;
  date?: AvailableDate;
  slot?: AvailableSlot;
  patient: PatientBookingInput;
  paymentOption: PaymentOption;
}) {
  const fee = service?.price ?? doctor?.consultationFee ?? 0;
  return <div className="rounded-xl border bg-white p-5">
    <h2 className="font-semibold">Booking Summary</h2>
    <div className="mt-4 space-y-2 text-sm">
      <Row label="Clinic" value={clinic.name} />
      <Row label="Doctor" value={doctor?.name ?? "Not selected"} />
      <Row label="Service" value={service?.name ?? "Not selected"} />
      <Row label="Date" value={date?.label ?? "Not selected"} />
      <Row label="Time" value={slot?.label ?? "Not selected"} />
      <Row label="Patient" value={patient.fullName || "Patient name"} />
      <Row label="Consultation fee" value={fee > 0 ? rupee(fee) : "Confirmed at the clinic"} />
      <Row label="Payment" value={paymentLabel[paymentOption]} />
    </div>
  </div>;
}

function Row({ label, value }: { label: string; value: string }) {
  return <div className="flex justify-between gap-4 border-b border-slate-100 pb-2"><span className="text-slate-500">{label}</span><b className="text-right">{value}</b></div>;
}
