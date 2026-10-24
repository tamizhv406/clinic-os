import { BrandLogo } from "../../../components/ui";
import { useClinicProfile } from "../../../hooks/useClinicProfile";
import type { PatientProfile, PrescriptionItem } from "../types";

export function PrescriptionPreview({ patient, items, diagnosis = "", doctorName = "", advice = "", followUpDate = "" }: {
  patient: PatientProfile;
  items: PrescriptionItem[];
  diagnosis?: string;
  doctorName?: string;
  advice?: string;
  followUpDate?: string;
}) {
  const clinic = useClinicProfile();
  const today = new Date().toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" });

  return <div className="card p-4 md:p-5">
    <div className="flex items-center justify-between border-b pb-4">
      <div className="flex items-center gap-4">
        <BrandLogo className="size-14" />
        <div>
          <h2 className="font-['Manrope'] font-semibold">{clinic.name || "Clinic"}</h2>
          <p className="text-xs text-slate-500">{clinic.address || "Digital prescription"}</p>
        </div>
      </div>
      <p className="text-right text-sm"><b>{doctorName || "Attending doctor"}</b><br />{today}</p>
    </div>
    <div className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
      <p><b>Patient:</b> {patient.name}</p>
      <p><b>Age/Gender:</b> {patient.age}/{patient.gender}</p>
      <p><b>Diagnosis:</b> {diagnosis || "Not recorded"}</p>
      {patient.allergies.length > 0 && <p className="text-danger-700"><b>Allergies:</b> {patient.allergies.join(", ")}</p>}
    </div>
    <div className="mt-4 overflow-x-auto"><table className="data-table min-w-[560px]">
      <thead><tr><th>Medicine</th><th>Dosage</th><th>Frequency</th><th>Timing</th><th>Duration</th></tr></thead>
      <tbody>{items.filter((item) => item.medicineName.trim()).map((item) => <tr key={item.id}>
        <td>{item.medicineName}</td><td>{item.dosage}</td><td>{item.frequency}</td><td>{item.timing}</td><td>{item.duration}</td>
      </tr>)}</tbody>
    </table></div>
    {advice && <p className="mt-4 whitespace-pre-line text-sm text-slate-600"><b>Advice:</b> {advice}</p>}
    {followUpDate && <p className="mt-1 text-sm text-slate-600"><b>Follow-up:</b> {followUpDate}</p>}
  </div>;
}
