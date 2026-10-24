import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { Button, Card, Input, PageHeader, Select, Textarea } from "../../../components/ui";
import { services } from "../../../services/serviceProvider";
import type { AppointmentRecord } from "../../../shared/types/domain";
import type { Tables, TablesInsert } from "../../../shared/types/database.types";
import { PatientHistoryPanel } from "../components/PatientHistoryPanel";
import { PatientSummaryCard } from "../components/PatientSummaryCard";
import type { PatientProfile, PatientTimelineItem, Prescription } from "../types";

type ConsultationRow = Tables<"consultations">;

const emptyVitals = {
  temperature: "",
  bloodPressure: "",
  pulse: "",
  respiratoryRate: "",
  weight: "",
  height: "",
  oxygen: "",
  sugar: "",
  vitalsNotes: "",
};

export default function Consultation() {
  const { patientId = "" } = useParams();
  const [searchParams] = useSearchParams();
  const appointmentId = searchParams.get("appointmentId") ?? "";
  const [patientProfile, setPatientProfile] = useState<PatientProfile | null>(null);
  const [appointment, setAppointment] = useState<AppointmentRecord | null>(null);
  const [consultation, setConsultation] = useState<ConsultationRow | null>(null);
  const [timeline, setTimeline] = useState<PatientTimelineItem[]>([]);
  const [pastPrescriptions, setPastPrescriptions] = useState<Prescription[]>([]);
  const [doctorId, setDoctorId] = useState("");
  const [loading, setLoading] = useState(false);
  const [symptoms, setSymptoms] = useState("");
  const [severity, setSeverity] = useState("Moderate");
  const [diagnosis, setDiagnosis] = useState("");
  const [clinicalNotes, setClinicalNotes] = useState("");
  const [advice, setAdvice] = useState("");
  const [followUpDate, setFollowUpDate] = useState("");
  const [followUpReason, setFollowUpReason] = useState("");
  const [vitals, setVitals] = useState(emptyVitals);

  const loadConsultation = async () => {
    setLoading(true);
    try {
      const context = await services.auth.getCurrentAuthContext();
      const profile = await services.doctor.getDoctorProfileByStaffId(context.staffProfileId);
      if (!profile) throw new Error("No doctor profile is linked to this staff user.");
      const [nextProfile, doctorAppointments, priorConsultations, nextTimeline, nextPrescriptions] = await Promise.all([
        services.doctor.getPatientProfile(patientId),
        services.appointments.getDoctorAppointments(profile.id),
        services.doctor.getConsultationsByPatient(patientId),
        services.doctor.getPatientTimeline(patientId),
        services.doctor.getPatientPrescriptionHistory(patientId),
      ]);
      const nextAppointment = appointmentId
        ? await services.appointments.getAppointmentById(appointmentId)
        : doctorAppointments.find((item) => item.patientId === patientId && !["completed", "cancelled", "no_show"].includes(item.status)) ?? null;
      const existing = nextAppointment ? await services.doctor.getConsultationByAppointment(nextAppointment.id) : priorConsultations[0] ?? null;
      const nextVitals = existing ? await services.doctor.getVitals(existing.id) : [];
      setPatientProfile(nextProfile);
      setAppointment(nextAppointment);
      setConsultation(existing);
      setTimeline(nextTimeline);
      setPastPrescriptions(nextPrescriptions);
      setDoctorId(profile.id);
      setSymptoms(existing?.symptoms?.replace(/\nSeverity:.*/, "") ?? nextAppointment?.reason ?? "");
      setDiagnosis(existing?.diagnosis ?? "");
      setClinicalNotes(existing?.clinical_notes ?? "");
      setAdvice(existing?.advice ?? "");
      setFollowUpDate(existing?.follow_up_date ?? "");
      setFollowUpReason(existing?.follow_up_reason ?? "");
      setVitals({
        temperature: String(nextVitals[0]?.temperature_c ?? ""),
        bloodPressure: nextVitals[0]?.blood_pressure ?? "",
        pulse: String(nextVitals[0]?.pulse_rate ?? ""),
        respiratoryRate: String(nextVitals[0]?.respiratory_rate ?? ""),
        weight: String(nextVitals[0]?.weight_kg ?? ""),
        height: String(nextVitals[0]?.height_cm ?? ""),
        oxygen: String(nextVitals[0]?.oxygen_saturation ?? ""),
        sugar: nextVitals[0]?.blood_sugar ?? "",
        vitalsNotes: nextVitals[0]?.notes ?? "",
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to load consultation.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (patientId) void loadConsultation(); }, [patientId, appointmentId]);

  const saveDraft = async () => {
    if (!patientProfile || !appointment || !doctorId) {
      toast.error("An assigned appointment is required to save a consultation.");
      return null;
    }
    setLoading(true);
    try {
      const payload: TablesInsert<"consultations"> = {
        clinic_id: appointment.clinicId,
        branch_id: appointment.branchId || null,
        appointment_id: appointment.id,
        patient_id: patientProfile.id,
        doctor_id: doctorId,
        symptoms: `${symptoms}${severity ? `\nSeverity: ${severity}` : ""}`.trim(),
        diagnosis,
        clinical_notes: clinicalNotes,
        advice,
        follow_up_date: followUpDate || null,
        follow_up_reason: followUpReason,
        status: "draft",
        metadata: { source: "doctor_consultation_page" },
      };
      const saved = consultation ? await services.doctor.updateConsultation(consultation.id, payload) : await services.doctor.createConsultation(payload);
      await services.doctor.saveVitals({
        clinic_id: saved.clinic_id,
        consultation_id: saved.id,
        patient_id: saved.patient_id,
        temperature_c: numberOrNull(vitals.temperature),
        blood_pressure: vitals.bloodPressure || null,
        pulse_rate: integerOrNull(vitals.pulse),
        respiratory_rate: integerOrNull(vitals.respiratoryRate),
        weight_kg: numberOrNull(vitals.weight),
        height_cm: numberOrNull(vitals.height),
        oxygen_saturation: integerOrNull(vitals.oxygen),
        blood_sugar: vitals.sugar || null,
        notes: vitals.vitalsNotes || null,
      });
      if (clinicalNotes.trim()) {
        await services.doctor.addConsultationNote({ clinic_id: saved.clinic_id, consultation_id: saved.id, note_type: "doctor", note: clinicalNotes });
      }
      setConsultation(saved);
      toast.success("Consultation draft saved.");
      return saved;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to save consultation.");
      return null;
    } finally {
      setLoading(false);
    }
  };

  const complete = async () => {
    const saved = await saveDraft();
    if (!saved) return;
    setLoading(true);
    try {
      const completed = await services.doctor.completeConsultation(saved.id);
      setConsultation(completed);
      toast.success("Consultation completed.");
      await loadConsultation();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to complete consultation.");
    } finally {
      setLoading(false);
    }
  };

  if (!patientProfile) return <main className="p-5 md:p-7"><PageHeader title="Consultation" description="Loading consultation context..." /></main>;

  return <div className="space-y-6"><PageHeader title="Consultation" description="Capture complaint, vitals, diagnosis, notes, and follow-up quickly." />
    {!appointment && <div className="rounded-xl bg-warning-50 p-3 text-sm font-semibold text-warning-700">No active assigned appointment was found. Saving requires an appointment.</div>}
    <div className="grid gap-4 xl:grid-cols-[.62fr_1.1fr_.7fr]"><aside className="xl:sticky xl:top-24 xl:self-start"><PatientSummaryCard patient={patientProfile} compact /></aside>
      <main className="space-y-6">
        <Card className="p-4 md:p-5"><h2 className="font-semibold">Chief Complaint / Symptoms</h2><div className="mt-4 grid gap-4 md:grid-cols-2"><Input placeholder="Symptoms" value={symptoms} onChange={(event) => setSymptoms(event.target.value)} /><Input placeholder="Duration" value={appointment?.reason ?? ""} readOnly /><Select value={severity} onChange={(event) => setSeverity(event.target.value)}><option>Mild</option><option>Moderate</option><option>Severe</option></Select><Textarea className="md:col-span-2" placeholder="Notes" value={clinicalNotes} onChange={(event) => setClinicalNotes(event.target.value)} /></div></Card>
        <section className="card p-4 md:p-5"><h2 className="font-semibold">Vitals</h2><div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4"><Input placeholder="Temperature" value={vitals.temperature} onChange={(event) => setVitals({ ...vitals, temperature: event.target.value })} /><Input placeholder="BP" value={vitals.bloodPressure} onChange={(event) => setVitals({ ...vitals, bloodPressure: event.target.value })} /><Input placeholder="Pulse" value={vitals.pulse} onChange={(event) => setVitals({ ...vitals, pulse: event.target.value })} /><Input placeholder="Respiratory rate" value={vitals.respiratoryRate} onChange={(event) => setVitals({ ...vitals, respiratoryRate: event.target.value })} /><Input placeholder="Weight" value={vitals.weight} onChange={(event) => setVitals({ ...vitals, weight: event.target.value })} /><Input placeholder="Height" value={vitals.height} onChange={(event) => setVitals({ ...vitals, height: event.target.value })} /><Input placeholder="SpO2" value={vitals.oxygen} onChange={(event) => setVitals({ ...vitals, oxygen: event.target.value })} /><Input placeholder="Sugar level" value={vitals.sugar} onChange={(event) => setVitals({ ...vitals, sugar: event.target.value })} /></div><Textarea className="mt-3" placeholder="Vitals notes" value={vitals.vitalsNotes} onChange={(event) => setVitals({ ...vitals, vitalsNotes: event.target.value })} /></section>
        <section className="card p-4 md:p-5"><h2 className="font-semibold">Diagnosis</h2><div className="mt-4 grid gap-4 md:grid-cols-[1fr_.45fr]"><Input placeholder="Search/select diagnosis" value={diagnosis} onChange={(event) => setDiagnosis(event.target.value)} /><Select defaultValue="provisional"><option>provisional</option><option>final</option></Select><Textarea className="md:col-span-2" placeholder="Advice" value={advice} onChange={(event) => setAdvice(event.target.value)} /></div></section>
        <section className="card p-4 md:p-5"><h2 className="font-semibold">Follow-up</h2><div className="mt-3 grid gap-4 md:grid-cols-2"><Input type="date" value={followUpDate} onChange={(event) => setFollowUpDate(event.target.value)} /><Textarea className="md:col-span-2" placeholder="Follow-up reason" value={followUpReason} onChange={(event) => setFollowUpReason(event.target.value)} /></div></section>
        <div className="flex flex-wrap gap-2 rounded-xl border bg-white p-3"><Button loading={loading} onClick={() => void saveDraft()}>Save Draft</Button><Button to={`/doctor/prescription/${patientProfile.id}`} variant="secondary">Continue to Prescription</Button><Button loading={loading} variant="secondary" onClick={() => void complete()}>Complete Without Prescription</Button><Button to="/doctor/queue" variant="ghost">Back to queue</Button></div>
      </main>
      <aside className="xl:sticky xl:top-24 xl:self-start"><PatientHistoryPanel timeline={timeline} prescriptions={pastPrescriptions} /></aside>
    </div>
  </div>;
}

function numberOrNull(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && value !== "" ? parsed : null;
}

function integerOrNull(value: string) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && value !== "" ? parsed : null;
}
