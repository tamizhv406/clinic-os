import { StatusBadge } from "../../../components/common/StatusBadge";
import { useState } from "react";
import { toast } from "sonner";
import { Button, Input } from "../../../components/ui";
import { services } from "../../../services/serviceProvider";
import { BookingEmptyState } from "../components/BookingEmptyState";
import type { BookingStatusResult } from "../types";

export default function BookingStatus() {
  const [phone, setPhone] = useState("");
  const [reference, setReference] = useState("");
  const [result, setResult] = useState<BookingStatusResult | null>(null);
  const [searched, setSearched] = useState(false);
  const [loading, setLoading] = useState(false);

  const search = async () => {
    if (!phone.trim() || !reference.trim()) return toast.error("Enter both your phone number and your booking ID or token.");
    setLoading(true);
    try {
      const next = await services.booking.getBookingStatus(phone.trim(), reference.trim());
      setResult(next);
      setSearched(true);
      if (!next) toast.error("No appointment matched that phone number and reference.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to look up this booking.");
    } finally {
      setLoading(false);
    }
  };

  return <main className="min-h-screen bg-slate-50 px-4 py-8"><div className="mx-auto max-w-xl">
    <div className="card p-6">
      <h1 className="text-2xl font-semibold">Check Booking Status</h1>
      <p className="mt-2 text-sm text-slate-500">Enter the phone number you booked with and your booking ID or token number.</p>
      <form className="mt-5 grid gap-4" onSubmit={(event) => { event.preventDefault(); void search(); }}>
        <Input placeholder="Phone number" value={phone} onChange={(event) => setPhone(event.target.value)} />
        <Input placeholder="Booking ID or token number" value={reference} onChange={(event) => setReference(event.target.value)} />
        <Button type="submit" loading={loading}>Search</Button>
      </form>
    </div>

    {searched && !result && <div className="mt-5"><BookingEmptyState title="Appointment not found" description="Double-check the phone number and the token from your confirmation message." /></div>}

    {result && <div className="card mt-5 p-5">
      <div className="flex items-start justify-between">
        <div><p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Appointment status</p><h2 className="mt-1 text-xl font-semibold">{result.status.toUpperCase()}</h2></div>
        <StatusBadge tone="success">{result.token}</StatusBadge>
      </div>
      <div className="mt-4 space-y-2 text-sm">
        <p><b>Doctor:</b> {result.doctorName}</p>
        <p><b>Date/time:</b> {result.dateTime}</p>
        <p><b>Clinic:</b> {result.clinicName}</p>
        <p><b>Patient:</b> {result.patientName}</p>
        <p><b>Booking ID:</b> {result.bookingId}</p>
      </div>
      <p className="mt-5 rounded-xl bg-brand-50 p-3 text-sm text-brand-700">To reschedule or cancel, please contact the clinic reception.</p>
    </div>}
  </div></main>;
}

