import { Search } from "lucide-react";
import { Input } from "../../../components/ui";
export function MedicineSearchInput({ value, onChange, placeholder = "Search medicine, batch, or prescription" }: { value: string; onChange: (v: string) => void; placeholder?: string }) { return <label className="relative block"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" /><Input className="pl-10" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} /></label>; }
