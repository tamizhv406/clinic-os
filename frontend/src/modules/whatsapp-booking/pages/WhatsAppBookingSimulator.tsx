import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button, Card, Input, PageHeader, Select, Textarea } from "../../../components/ui";
import { services } from "../../../services/serviceProvider";
import { AppointmentDateSelector } from "../components/AppointmentDateSelector";
import { AppointmentSlotSelector } from "../components/AppointmentSlotSelector";
import { BookingConfirmationCard } from "../components/BookingConfirmationCard";
import { BookingToDashboardPreview } from "../components/BookingToDashboardPreview";
import { ChatSimulator } from "../components/ChatSimulator";
import { DepartmentSelector } from "../components/DepartmentSelector";
import { DoctorAvailabilitySelector } from "../components/DoctorAvailabilitySelector";
import { DoctorNotificationPreview } from "../components/DoctorNotificationPreview";
import { PatientDetailsCollector } from "../components/PatientDetailsCollector";
import { ProblemCollector } from "../components/ProblemCollector";
import { ReminderConsentCard } from "../components/ReminderConsentCard";
import { departmentLabel } from "../utils";
import type { ClinicDepartment, WhatsAppAvailability, WhatsAppConfirmedAppointment, WhatsAppDoctor, WhatsAppMessage } from "../types";

const emptyPatient = { fullName: "", age: "", gender: "female" as "female" | "male" | "other", phone: "", mainProblem: "" };

export default function WhatsAppBookingSimulator() {
  const [departments, setDepartments] = useState<Array<{ id: ClinicDepartment; label: string }>>([]);
  const [doctors, setDoctors] = useState<WhatsAppDoctor[]>([]);
  const [availability, setAvailability] = useState<WhatsAppAvailability>({ doctorId: "", dates: [] });
  const [clinicName, setClinicName] = useState("");

  const [department, setDepartment] = useState<ClinicDepartment | undefined>();
  const [doctorId, setDoctorId] = useState("");
  const [date, setDate] = useState("");
  const [slot, setSlot] = useState("");
  const [patient, setPatient] = useState(emptyPatient);
  const [reminderConsent, setReminderConsent] = useState(true);

  const [loading, setLoading] = useState(true);
  const [booking, setBooking] = useState(false);
  const [confirmed, setConfirmed] = useState<WhatsAppConfirmedAppointment | null>(null);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      setLoading(true);
      try {
        const [context, nextDepartments, nextDoctors] = await Promise.all([
          services.auth.getCurrentAuthContext(),
          services.whatsapp.getDepartments(),
          services.whatsapp.getClinicDoctors(),
        ]);
        if (!mounted) return;
        setClinicName((context.clinic as { name?: string } | null)?.name ?? "the clinic");
        setDepartments(nextDepartments);
        setDoctors(nextDoctors);
      } catch (error) {
        if (mounted) toast.error(error instanceof Error ? error.message : "Unable to load clinic data for the simulator.");
      } finally {
        if (mounted) setLoading(false);
      }
    };
    void load();
    return () => { mounted = false; };
  }, []);

  const visibleDoctors = useMemo(() => department ? doctors.filter((doctor) => doctor.department === department) : doctors, [department, doctors]);

  useEffect(() => {
    if (!doctorId) { setAvailability({ doctorId: "", dates: [] }); setDate(""); setSlot(""); return; }
    let mounted = true;
    void services.whatsapp
      .getDoctorAvailability(doctorId)
      .then((next) => {
        if (!mounted) return;
        setAvailability(next);
        setDate(next.dates[0]?.date ?? "");
        setSlot(next.dates[0]?.slots[0] ?? "");
      })
      .catch((error) => { if (mounted) toast.error(error instanceof Error ? error.message : "Unable to load this doctor's availability."); });
    return () => { mounted = false; };
  }, [doctorId]);

  useEffect(() => {
    const slots = availability.dates.find((item) => item.date === date)?.slots ?? [];
    setSlot(slots[0] ?? "");
  }, [availability, date]);

  const selectedDoctor = doctors.find((doctor) => doctor.id === doctorId);
  const slotsForDate = availability.dates.find((item) => item.date === date)?.slots ?? [];
  const patientSummary = [patient.fullName, patient.age && `${patient.age} yrs`, patient.gender, patient.phone].filter(Boolean).join(", ") || "Not collected yet";

  // The transcript mirrors exactly what the patient has chosen so far.
  const messages = useMemo((): WhatsAppMessage[] => {
    const rows: Array<[WhatsAppMessage["sender"], string]> = [["patient", "Hi"], ["bot", `Welcome to ${clinicName}. Reply 1 to book an appointment, 2 to view an appointment, 3 to talk to reception.`], ["patient", "1"]];
    if (departments.length > 1) {
      rows.push(["bot", `Please choose a department: ${departments.map((item) => item.label).join(", ")}.`]);
      if (department) rows.push(["patient", departmentLabel(department)]);
    }
    if (department || departments.length <= 1) {
      rows.push(["bot", visibleDoctors.length > 0 ? `Available doctors: ${visibleDoctors.map((doctor) => doctor.name).join(", ")}.` : "No doctors are available for this department."]);
    }
    if (selectedDoctor) {
      rows.push(["patient", selectedDoctor.name]);
      rows.push(["bot", availability.dates.length > 0 ? `${selectedDoctor.name} is available on: ${availability.dates.map((item) => item.label).join(", ")}.` : `${selectedDoctor.name} has no open dates right now.`]);
    }
    if (date) {
      rows.push(["patient", date]);
      rows.push(["bot", slotsForDate.length > 0 ? `Open time slots: ${slotsForDate.join(", ")}.` : "No open slots on that date."]);
    }
    if (slot) rows.push(["patient", slot]);
    if (slot) rows.push(["bot", "Please share the patient name, age, gender and phone number."]);
    if (patient.fullName) rows.push(["patient", patientSummary]);
    if (patient.mainProblem) {
      rows.push(["bot", "What is the main health problem?"]);
      rows.push(["patient", patient.mainProblem]);
    }
    if (confirmed) rows.push(["bot", `Your appointment is confirmed. Token ${confirmed.tokenNumber} with ${confirmed.doctorName} on ${confirmed.appointmentDate} at ${confirmed.appointmentTime}.`]);
    return rows.map(([sender, text], index) => ({ id: `m${index}`, sender, text, time: "" }));
  }, [availability.dates, clinicName, confirmed, date, department, departments, patient, patientSummary, selectedDoctor, slot, slotsForDate, visibleDoctors]);

  const reset = () => {
    setDepartment(undefined); setDoctorId(""); setDate(""); setSlot("");
    setPatient(emptyPatient); setConfirmed(null);
  };

  const confirm = async () => {
    if (!selectedDoctor) return toast.error("Select a doctor.");
    if (!date || !slot) return toast.error("Select a date and time slot.");
    if (!patient.fullName.trim() || !patient.phone.trim()) return toast.error("Enter the patient name and WhatsApp number.");

    setBooking(true);
    try {
      const context = await services.auth.getCurrentAuthContext();
      const existing = await services.patients.findPatientByWhatsAppNumber(patient.phone.trim());
      const isNewPatient = !existing;
      const record = existing ?? await services.patients.createPatient({
        clinicId: context.clinic_id ?? "",
        branchId: context.branch_id ?? "",
        fullName: patient.fullName.trim(),
        phone: patient.phone.trim(),
        whatsappNumber: patient.phone.trim(),
        age: Number(patient.age) || 0,
        gender: patient.gender,
        source: "whatsapp",
        allergies: [],
        medicalHistory: [],
        currentMedications: [],
        whatsappConsent: true,
        reminderConsent,
      });

      const appointment = await services.appointments.bookForPatient({
        patientId: record.id,
        doctorId: selectedDoctor.id,
        appointmentDate: date,
        appointmentTime: slot,
        department: selectedDoctor.department,
        mainProblem: patient.mainProblem,
        source: "whatsapp",
        isNewPatient,
        metadata: { channel: "whatsapp_simulator", reminderConsent },
      });

      // Persist the conversation so it shows up on the Conversations screen.
      const conversation = await services.whatsapp.createConversation({
        phone: patient.phone.trim(),
        patientId: record.id,
        status: "appointment_confirmed",
        source: "whatsapp",
        currentStep: "confirmed",
        linkedAppointmentId: appointment.id,
        lastMessage: `Appointment confirmed. Token ${appointment.tokenNumber}.`,
        metadata: { patientName: record.fullName, appointmentToken: appointment.tokenNumber },
      }).catch(() => null);

      if (conversation) {
        for (const message of messages) {
          await services.whatsapp.createMessage({
            conversationId: conversation.id,
            patientId: record.id,
            phone: patient.phone.trim(),
            direction: message.sender === "patient" ? "inbound" : "outbound",
            sender: message.sender,
            body: message.text,
            deliveryStatus: message.sender === "patient" ? "received" : "sent",
          }).catch(() => undefined);
        }
      }

      setConfirmed({
        appointmentId: appointment.id,
        tokenNumber: appointment.tokenNumber,
        patientName: record.fullName,
        phone: record.phone,
        whatsappNumber: record.whatsappNumber || record.phone,
        age: record.age,
        gender: (record.gender as "female" | "male" | "other") ?? "other",
        department: selectedDoctor.department,
        doctorId: selectedDoctor.id,
        doctorName: selectedDoctor.name,
        appointmentDate: appointment.date,
        appointmentTime: appointment.time || slot,
        mainProblem: patient.mainProblem,
        source: "whatsapp",
        status: "booked",
        isNewPatient,
        reminderStatus: reminderConsent ? "consent confirmed" : "consent not received",
      });
      toast.success(`Appointment booked. Token ${appointment.tokenNumber}.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to book this appointment.");
    } finally {
      setBooking(false);
    }
  };

  if (loading) return <main className="p-5 md:p-7"><PageHeader title="WhatsApp Booking" description="Loading clinic data..." /></main>;

  return <div className="space-y-6">
    <PageHeader title="WhatsApp Booking Console" description="Walk a patient through the WhatsApp booking flow. Confirming creates a real appointment with source “whatsapp”." action={<Button variant="secondary" onClick={reset}>Restart</Button>} />
    <div className="grid gap-4 xl:grid-cols-[.8fr_1.2fr]">
      <div className="space-y-6">
        <DepartmentSelector departments={departments} selected={department} onSelect={(next) => { setDepartment(next); setDoctorId(""); }} />
        <DoctorAvailabilitySelector doctors={visibleDoctors} selectedId={doctorId} onSelect={setDoctorId} />
        <AppointmentDateSelector dates={availability.dates} selectedDate={date} onSelect={setDate} />
        <AppointmentSlotSelector slots={slotsForDate} selected={slot} onSelect={setSlot} />
      </div>
      <div className="space-y-6">
        <ChatSimulator messages={messages} clinicName={clinicName} />
        <Card className="p-4 md:p-5">
          <h2 className="font-semibold">Patient details</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <Input placeholder="Full name" value={patient.fullName} onChange={(event) => setPatient({ ...patient, fullName: event.target.value })} />
            <Input placeholder="WhatsApp number" value={patient.phone} onChange={(event) => setPatient({ ...patient, phone: event.target.value })} />
            <Input type="number" placeholder="Age" value={patient.age} onChange={(event) => setPatient({ ...patient, age: event.target.value })} />
            <Select value={patient.gender} onChange={(event) => setPatient({ ...patient, gender: event.target.value as typeof patient.gender })}>
              <option value="female">Female</option>
              <option value="male">Male</option>
              <option value="other">Other</option>
            </Select>
            <Textarea className="md:col-span-2" placeholder="Main health problem" value={patient.mainProblem} onChange={(event) => setPatient({ ...patient, mainProblem: event.target.value })} />
            <label className="flex items-center gap-2 rounded-xl border p-3 text-sm font-semibold md:col-span-2">
              <input type="checkbox" checked={reminderConsent} onChange={(event) => setReminderConsent(event.target.checked)} />
              Patient consents to WhatsApp reminders
            </label>
          </div>
          <Button className="mt-4" loading={booking} onClick={() => void confirm()}>Confirm appointment</Button>
        </Card>
        <div className="grid gap-4 lg:grid-cols-2">
          <PatientDetailsCollector details={patientSummary} />
          <ProblemCollector problem={patient.mainProblem || "Not collected yet"} />
          {confirmed && <>
            <BookingConfirmationCard appointment={confirmed} />
            <DoctorNotificationPreview appointment={confirmed} />
            <BookingToDashboardPreview appointment={confirmed} />
            <ReminderConsentCard consent={reminderConsent} />
          </>}
        </div>
      </div>
    </div>
  </div>;
}
