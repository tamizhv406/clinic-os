import { Search } from "lucide-react";
import { Input } from "../../../components/ui";

export function PatientSearchPanel() {
  return <div className="card p-4"><label className="relative block"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" /><Input className="pl-10" placeholder="Patient search is unavailable here" disabled aria-label="Patient search unavailable" /></label></div>;
}

