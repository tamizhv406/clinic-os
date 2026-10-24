import { Search } from "lucide-react";
import { Input } from "./Input";
export function SearchBar({ placeholder = "Search patients, appointments..." }: { placeholder?: string }) { return <div className="relative"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" /><Input aria-label="Search" placeholder={placeholder} className="pl-9" disabled /></div>; }

