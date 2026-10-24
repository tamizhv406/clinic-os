import { PageHeader } from "../../../components/ui";
import { PatientRegistrationForm } from "../components/PatientRegistrationForm";

export default function NewPatient() {
  return <div className="space-y-6"><PageHeader title="New Patient Registration" description="Register a patient, capture medical context, and prepare an appointment token." /><PatientRegistrationForm /></div>;
}
