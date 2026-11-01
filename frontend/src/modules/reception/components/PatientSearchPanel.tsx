import { Search } from "lucide-react";
import { useEffect, useState } from "react";
import { Input } from "../../../components/ui";
import { services } from "../../../services/serviceProvider";
import type { PatientRecord } from "../../../shared/types/domain";

/** Find a patient by name or phone without leaving the dashboard. */
export function PatientSearchPanel() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PatientRecord[]>([]);
  const [searching, setSearching] = useState(false);
  const term = query.trim();

  useEffect(() => {
    if (term.length < 2) { setResults([]); setSearching(false); return; }
    let active = true;
    setSearching(true);
    const timer = setTimeout(() => {
      void services.patients.searchPatients(term)
        .then((rows) => { if (active) setResults(rows.slice(0, 6)); })
        .catch(() => { if (active) setResults([]); })
        .finally(() => { if (active) setSearching(false); });
    }, 300);
    return () => { active = false; clearTimeout(timer); };
  }, [term]);

  return <div className="card p-4">
    <label className="relative block"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
      <Input className="pl-10" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search patients by name or phone" aria-label="Search patients" /></label>
    {term.length >= 2 && <div className="mt-3 divide-y rounded-xl border" role="status">
      {searching ? <p className="px-4 py-3 text-sm text-slate-500">Searching...</p>
        : results.length === 0 ? <p className="px-4 py-3 text-sm text-slate-500">No patient found. Use "Add Walk-in" to register a new patient.</p>
        : results.map((patient) => <div key={patient.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
          <span className="font-semibold text-slate-900">{patient.fullName}</span>
          <span className="text-slate-500">{[patient.phone, patient.age ? `${patient.age} yrs` : "", patient.gender].filter(Boolean).join(" · ")}</span>
        </div>)}
    </div>}
  </div>;
}
