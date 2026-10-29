import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { Button, Card, LoadingSkeleton } from "../../../components/ui";
import { services } from "../../../services/serviceProvider";
import { BookingStepper } from "../components/BookingStepper";
import { BookingSummary } from "../components/BookingSummary";
import { DateSelector } from "../components/DateSelector";
import { DoctorSelector } from "../components/DoctorSelector";
import { PatientDetailsForm } from "../components/PatientDetailsForm";
import { PaymentOptionCard } from "../components/PaymentOptionCard";
import { ServiceSelector } from "../components/ServiceSelector";
import { SlotSelector } from "../components/SlotSelector";
import { BookingEmptyState } from "../components/BookingEmptyState";
import type { AvailableDate, AvailableSlot, BookingDoctor, BookingService, ClinicBookingProfile, PatientBookingInput, PaymentOption } from "../types";

const defaultPatient: PatientBookingInput = { fullName: "", phone: "", age: 0, gender: "", reason: "", existingPatient: false, patientId: "", notes: "" };

export default function BookingFlow() {
  const navigate = useNavigate();
  const { clinicSlug = "" } = useParams();
  const [searchParams] = useSearchParams();

  const [clinic, setClinic] = useState<ClinicBookingProfile | null>(null);
  const [doctors, setDoctors] = useState<BookingDoctor[]>([]);
  const [clinicServices, setClinicServices] = useState<BookingService[]>([]);
  const [dates, setDates] = useState<AvailableDate[]>([]);
  const [slots, setSlots] = useState<AvailableSlot[]>([]);

  const [step, setStep] = useState(0);
  const [doctorId, setDoctorId] = useState("");
  const [serviceId, setServiceId] = useState("");
  const [dateId, setDateId] = useState("");
  const [slotId, setSlotId] = useState("");
  const [patient, setPatient] = useState<PatientBookingInput>(defaultPatient);
  const [payment, setPayment] = useState<PaymentOption>("pay_at_clinic");

  const [loading, setLoading] = useState(true);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [booking, setBooking] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      setLoading(true);
      try {
        const [profile, nextDoctors, nextServices] = await Promise.all([
          services.booking.getClinicProfile(clinicSlug),
          services.booking.getDoctors(clinicSlug),
          services.booking.getServices(clinicSlug),
        ]);
        if (!mounted) return;
        setClinic(profile);
        setDoctors(nextDoctors);
        setClinicServices(nextServices);
        setDoctorId(searchParams.get("doctorId") ?? nextDoctors[0]?.id ?? "");
        setServiceId(searchParams.get("serviceId") ?? nextServices[0]?.id ?? "");
      } catch (err) {
        if (mounted) setError(err instanceof Error ? err.message : "This booking page is not available.");
      } finally {
        if (mounted) setLoading(false);
      }
    };
    void load();
    return () => { mounted = false; };
  }, [clinicSlug]);

  // Dates depend on the chosen doctor's weekly availability.
  useEffect(() => {
    if (!doctorId) return;
    let mounted = true;
    void services.booking
      .getAvailableDates(doctorId)
      .then((nextDates) => {
        if (!mounted) return;
        setDates(nextDates);
        setDateId(nextDates.find((date) => date.available)?.id ?? "");
      })
      .catch((err) => { if (mounted) toast.error(err instanceof Error ? err.message : "Unable to load available dates."); });
    return () => { mounted = false; };
  }, [doctorId]);

  // Slots are materialised per doctor and date.
  useEffect(() => {
    if (!doctorId || !dateId) { setSlots([]); setSlotId(""); return; }
    let mounted = true;
    setLoadingSlots(true);
    void services.booking
      .getAvailableSlots(doctorId, dateId)
      .then((nextSlots) => {
        if (!mounted) return;
        setSlots(nextSlots);
        setSlotId(nextSlots.find((slot) => slot.status !== "booked")?.id ?? "");
      })
      .catch((err) => { if (mounted) toast.error(err instanceof Error ? err.message : "Unable to load slots."); })
      .finally(() => { if (mounted) setLoadingSlots(false); });
    return () => { mounted = false; };
  }, [doctorId, dateId]);

  const doctor = useMemo(() => doctors.find((item) => item.id === doctorId), [doctorId, doctors]);
  const service = useMemo(() => clinicServices.find((item) => item.id === serviceId), [clinicServices, serviceId]);
  const date = useMemo(() => dates.find((item) => item.id === dateId), [dateId, dates]);
  const slot = useMemo(() => slots.find((item) => item.id === slotId), [slotId, slots]);

  const next = () => setStep((current) => Math.min(4, current + 1));
  const back = () => setStep((current) => Math.max(0, current - 1));

  const confirm = async () => {
    if (!clinic || !slot) return toast.error("Pick an available time slot first.");
    if (!patient.fullName.trim() || !patient.phone.trim()) return toast.error("Enter the patient name and phone number.");
    setBooking(true);
    try {
      const result = await services.booking.createBooking({
        clinicSlug: clinic.slug,
        slotId: slot.id,
        serviceId: serviceId || undefined,
        patient,
        paymentOption: payment,
        source: "website",
      });
      navigate(`/book/${clinic.slug}/success`, { state: { ...result, phone: patient.phone } });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Unable to complete this booking.");
      // The slot may have been taken while the patient was filling the form.
      if (doctorId && dateId) setSlots(await services.booking.getAvailableSlots(doctorId, dateId).catch(() => slots));
    } finally {
      setBooking(false);
    }
  };

  if (loading) return <main className="min-h-screen bg-slate-50 p-5"><div className="mx-auto max-w-5xl"><LoadingSkeleton rows={5} /></div></main>;
  if (error || !clinic) return <main className="grid min-h-screen place-items-center bg-slate-50 p-5"><BookingEmptyState title="Booking unavailable" description={error || "This clinic is not accepting online bookings right now."} /></main>;

  const canContinue = step === 0 ? Boolean(doctorId) : step === 1 ? true : step === 2 ? Boolean(slotId) : true;

  return <main className="min-h-screen bg-slate-50 px-4 py-5"><div className="mx-auto max-w-5xl space-y-6">
    <div className="flex items-center justify-between">
      <Link className="text-sm font-semibold text-slate-500" to={`/book/${clinic.slug}`}>← Back to clinic</Link>
      <Link className="text-sm font-semibold text-brand-700" to="/booking/status">Check booking status</Link>
    </div>
    <Card className="p-4 md:p-5"><BookingStepper current={step} /></Card>
    <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
      <Card className="p-4 md:p-5">
        {step === 0 && <><h1 className="mb-4 text-xl font-semibold">Choose Doctor</h1>{doctors.length > 0 ? <DoctorSelector doctors={doctors} selectedId={doctorId} onSelect={setDoctorId} /> : <BookingEmptyState title="No doctors available" description="This clinic has not published any doctors for online booking." />}</>}
        {step === 1 && <><h1 className="mb-4 text-xl font-semibold">Select Service</h1>{clinicServices.length > 0 ? <ServiceSelector services={clinicServices} selectedId={serviceId} onSelect={setServiceId} /> : <BookingEmptyState title="No services listed" description="You can continue; the clinic will confirm the service at the front desk." />}</>}
        {step === 2 && <div className="space-y-6">
          <h1 className="text-xl font-semibold">Pick Date &amp; Time</h1>
          {dates.length > 0 ? <DateSelector dates={dates} selectedId={dateId} onSelect={setDateId} /> : <BookingEmptyState title="No open dates" description="This doctor has no published availability. Please try another doctor." />}
          {loadingSlots ? <p className="text-sm text-slate-500">Loading slots...</p>
            : slots.length > 0 ? <SlotSelector slots={slots} selectedId={slotId} onSelect={setSlotId} />
            : dates.length > 0 ? <BookingEmptyState title="No slots on this date" description="Please pick another date." /> : null}
        </div>}
        {step === 3 && <><h1 className="mb-4 text-xl font-semibold">Enter Patient Details</h1><PatientDetailsForm defaultValue={patient} onSubmit={(input) => { setPatient(input); next(); }} /></>}
        {step === 4 && <div className="space-y-6">
          <h1 className="text-xl font-semibold">Confirm Appointment</h1>
          <div className="grid gap-4 sm:grid-cols-2">
            <PaymentOptionCard option="pay_at_clinic" selected={payment === "pay_at_clinic"} onSelect={() => setPayment("pay_at_clinic")} />
            <PaymentOptionCard option="pay_online" selected={payment === "pay_online"} onSelect={() => setPayment("pay_online")} />
          </div>
          <BookingSummary clinic={clinic} doctor={doctor} service={service} date={date} slot={slot} patient={patient} paymentOption={payment} />
          <Button className="w-full" loading={booking} disabled={!slotId} onClick={() => void confirm()}>Confirm Appointment</Button>
        </div>}
        <div className="mt-5 flex flex-wrap gap-2">
          {step > 0 && <Button variant="secondary" onClick={back}>Back</Button>}
          {step < 3 && <Button onClick={next} disabled={!canContinue}>Continue</Button>}
          {step < 4 && <Button variant="ghost" onClick={() => setStep(0)}>Reset</Button>}
        </div>
      </Card>
      <aside className="lg:sticky lg:top-5 lg:self-start">
        <BookingSummary clinic={clinic} doctor={doctor} service={service} date={date} slot={slot} patient={patient} paymentOption={payment} />
      </aside>
    </div>
  </div></main>;
}

