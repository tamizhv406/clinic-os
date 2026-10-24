import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { toast } from "sonner";
import { LoadingSkeleton, PageHeader } from "../../../components/ui";
import { services } from "../../../services/serviceProvider";
import { PatientSummaryCard } from "../components/PatientSummaryCard";
import { PrescriptionBuilder } from "../components/PrescriptionBuilder";
import { DoctorEmptyState } from "../components/DoctorEmptyState";
import type { PatientProfile } from "../types";

export default function Prescription() {
  const { patientId = "" } = useParams();
  const [patient, setPatient] = useState<PatientProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!patientId) { setLoading(false); return; }
    let mounted = true;
    const load = async () => {
      setLoading(true);
      try {
        const profile = await services.doctor.getPatientProfile(patientId);
        if (mounted) setPatient(profile);
      } catch (error) {
        if (mounted) toast.error(error instanceof Error ? error.message : "Unable to load the patient for this prescription.");
      } finally {
        if (mounted) setLoading(false);
      }
    };
    void load();
    return () => { mounted = false; };
  }, [patientId]);

  if (loading) return <main className="p-5 md:p-7"><LoadingSkeleton rows={4} /></main>;
  if (!patient) return <main className="p-5 md:p-7"><DoctorEmptyState title="Patient not found" description="Open a prescription from the doctor queue or from a patient profile." /></main>;

  return <div className="space-y-6">
    <PageHeader title="Prescription" description="Build a digital prescription with favourites, templates, lab tests, preview and WhatsApp sharing." />
    <PatientSummaryCard patient={patient} compact />
    <PrescriptionBuilder patient={patient} />
  </div>;
}
