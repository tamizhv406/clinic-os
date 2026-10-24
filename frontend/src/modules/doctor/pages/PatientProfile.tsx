import { useEffect, useState } from "react";
import { FileText } from "lucide-react";
import { useParams } from "react-router-dom";
import { toast } from "sonner";
import { Button, Card, LoadingSkeleton, PageHeader } from "../../../components/ui";
import { services } from "../../../services/serviceProvider";
import { PatientHistoryPanel } from "../components/PatientHistoryPanel";
import { PatientSummaryCard } from "../components/PatientSummaryCard";
import { DoctorEmptyState } from "../components/DoctorEmptyState";
import type { PatientProfile as PatientProfileType, PatientTimelineItem, Prescription } from "../types";

export default function PatientProfile() {
  const { id = "" } = useParams();
  const [patient, setPatient] = useState<PatientProfileType | null>(null);
  const [timeline, setTimeline] = useState<PatientTimelineItem[]>([]);
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [notes, setNotes] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    let mounted = true;
    const load = async () => {
      setLoading(true);
      try {
        const [nextPatient, nextTimeline, nextPrescriptions, patientNotes] = await Promise.all([
          services.doctor.getPatientProfile(id),
          services.doctor.getPatientTimeline(id),
          services.doctor.getPatientPrescriptionHistory(id),
          services.patients.getPatientNotes(id),
        ]);
        if (!mounted) return;
        setPatient(nextPatient);
        setTimeline(nextTimeline);
        setPrescriptions(nextPrescriptions);
        setNotes(patientNotes.map((note) => note.note));
      } catch (error) {
        if (mounted) toast.error(error instanceof Error ? error.message : "Unable to load this patient.");
      } finally {
        if (mounted) setLoading(false);
      }
    };
    void load();
    return () => { mounted = false; };
  }, [id]);

  if (loading) return <main className="p-5 md:p-7"><LoadingSkeleton rows={4} /></main>;
  if (!patient) return <main className="p-5 md:p-7"><DoctorEmptyState title="Patient not found" description="This patient record is not available in your clinic." /></main>;

  return <div className="space-y-6">
    <PageHeader title="Patient Profile" description="Clean clinical context before starting consultation." action={<Button to={`/doctor/consultation/${patient.id}`}>Start Consultation</Button>} />
    <div className="grid gap-4 xl:grid-cols-[.75fr_1.25fr]">
      <div className="space-y-6">
        <PatientSummaryCard patient={patient} />
        <Card className="p-4 md:p-5">
          <h2 className="font-semibold">Doctor notes</h2>
          {notes.length > 0
            ? <div className="mt-3 grid gap-2 text-sm">{notes.map((note, index) => <div key={index} className="flex items-start gap-2 rounded-xl bg-slate-50 p-3"><FileText className="mt-0.5 size-4 shrink-0 text-slate-400" />{note}</div>)}</div>
            : <p className="mt-2 text-sm text-slate-500">No notes recorded for this patient yet.</p>}
        </Card>
      </div>
      <PatientHistoryPanel timeline={timeline} prescriptions={prescriptions} />
    </div>
  </div>;
}
