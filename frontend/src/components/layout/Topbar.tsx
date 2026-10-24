import { LogOut, Search, Menu, UserRound } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { services } from "../../services/serviceProvider";
import { Input } from "../common/Input";
import { StatusBadge } from "../common/StatusBadge";
import type { PatientRecord } from "../../shared/types/domain";
import type { UserRole } from "../../types/user";

const labels: Record<UserRole, string> = { owner: "Owner", admin: "Admin", receptionist: "Receptionist", doctor: "Doctor", pharmacist: "Pharmacist", super_admin: "Super Admin" };
function initials(name: string, role: UserRole) {
  const letters = name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join("");
  return letters.toUpperCase() || (role === "super_admin" ? "SA" : "VX");
}

export function Topbar({ role, openMenu }: { role: UserRole; openMenu: () => void }) {
  const navigate = useNavigate();
  const [loggingOut, setLoggingOut] = useState(false);
  const [workspaceName, setWorkspaceName] = useState(role === "super_admin" ? "Vernex Platform" : "");
  const [userName, setUserName] = useState("");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PatientRecord[]>([]);
  const [searching, setSearching] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let mounted = true;
    void services.auth.getCurrentAuthContext().then((context) => {
      if (!mounted) return;
      setUserName(context.fullName);
      const clinic = context.clinic as { name?: string } | null;
      setWorkspaceName(role === "super_admin" ? "Vernex Platform" : clinic?.name ?? "");
    }).catch(() => undefined);
    return () => { mounted = false; };
  }, [role]);

  useEffect(() => {
    const term = query.trim();
    if (term.length < 2) { setResults([]); setSearching(false); return; }
    let mounted = true;
    setSearching(true);
    const timer = setTimeout(() => {
      void services.patients.searchPatients(term)
        .then((rows) => { if (mounted) { setResults(rows.slice(0, 6)); setActiveIndex(-1); } })
        .catch(() => { if (mounted) setResults([]); })
        .finally(() => { if (mounted) setSearching(false); });
    }, 300);
    return () => { mounted = false; clearTimeout(timer); };
  }, [query]);

  useEffect(() => {
    const onClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) setResults([]);
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) setUserMenuOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") { setResults([]); setUserMenuOpen(false); }
    };
    document.addEventListener("mousedown", onClickOutside);
    document.addEventListener("keydown", onKeyDown);
    return () => { document.removeEventListener("mousedown", onClickOutside); document.removeEventListener("keydown", onKeyDown); };
  }, []);

  useEffect(() => {
    const focusSearch = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        searchRef.current?.querySelector("input")?.focus();
      }
    };
    window.addEventListener("keydown", focusSearch);
    return () => window.removeEventListener("keydown", focusSearch);
  }, []);

  const openPatient = (patient: PatientRecord) => {
    setQuery(""); setResults([]); setActiveIndex(-1);
    navigate(`/doctor/patient/${patient.id}`);
  };
  const logout = async () => {
    setLoggingOut(true);
    try {
      await services.auth.signOut();
      localStorage.removeItem("vernex_auth");
      localStorage.removeItem("vernex_role");
      navigate("/login", { replace: true });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to log out.");
    } finally {
      setLoggingOut(false);
    }
  };
  const searchKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Escape") { setResults([]); return; }
    if (event.key === "ArrowDown" && results.length) { event.preventDefault(); setActiveIndex((index) => (index + 1) % results.length); }
    if (event.key === "ArrowUp" && results.length) { event.preventDefault(); setActiveIndex((index) => (index <= 0 ? results.length - 1 : index - 1)); }
    if (event.key === "Enter" && activeIndex >= 0 && results[activeIndex]) { event.preventDefault(); openPatient(results[activeIndex]); }
  };
  const today = new Date().toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  return <header className="sticky top-0 z-20 flex h-16 items-center border-b border-slate-200 bg-white px-4 md:px-6">
    <button onClick={openMenu} className="mr-2 rounded-lg p-2 text-slate-600 hover:bg-slate-100 lg:hidden" aria-label="Open menu"><Menu className="size-5" /></button>
    <div className="hidden min-w-0 md:block"><p className="truncate text-sm font-semibold text-slate-900">{workspaceName || "Vernex Clinic OS"}</p><p className="text-xs text-slate-500">{today}</p></div>
    {role === "doctor" && <div ref={searchRef} className="relative mx-auto hidden max-w-xl flex-1 px-6 lg:block">
      <label className="relative block"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" /><Input value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={searchKeyDown} className="pl-9 pr-24" placeholder="Search patients by name or phone..." aria-label="Search patients" aria-expanded={query.trim().length >= 2} aria-controls="patient-search-results" aria-activedescendant={activeIndex >= 0 ? `patient-result-${activeIndex}` : undefined} />
      <kbd className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 rounded-md border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] font-medium text-slate-500">⌘K / Ctrl K</kbd>
      </label>
      {query.trim().length >= 2 && <div id="patient-search-results" role="listbox" className="absolute left-6 right-6 top-full z-30 mt-1 overflow-hidden rounded-xl border bg-white shadow-card">
        {searching ? <p className="px-4 py-3 text-sm text-slate-500" role="status">Searching patientsâ€¦</p>
          : results.length === 0 ? <p className="px-4 py-3 text-sm text-slate-500">No patients found.</p>
          : results.map((patient, index) => <button id={`patient-result-${index}`} role="option" aria-selected={activeIndex === index} key={patient.id} onMouseEnter={() => setActiveIndex(index)} onClick={() => openPatient(patient)} className={`block w-full px-4 py-2.5 text-left text-sm hover:bg-slate-50 ${activeIndex === index ? "bg-slate-50" : ""}`}><b>{patient.fullName}</b><span className="ml-2 text-slate-500">{patient.phone}</span></button>)}
      </div>}
    </div>}
    <div className="relative ml-auto" ref={userMenuRef}>
      <button type="button" aria-haspopup="menu" aria-expanded={userMenuOpen} aria-label={`User menu for ${userName || labels[role]}`} onClick={() => setUserMenuOpen((open) => !open)} className="flex min-h-11 items-center gap-2 rounded-xl px-2 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-brand-500"><span className="grid size-10 place-items-center rounded-lg bg-slate-100 text-sm font-semibold text-slate-700">{initials(userName, role)}</span><span className="hidden text-left sm:block"><span className="block max-w-40 truncate text-sm font-semibold">{userName || labels[role]}</span><span className="block text-xs text-slate-500">{labels[role]}</span></span><UserRound className="hidden size-4 text-slate-400 sm:block" /></button>
      {userMenuOpen && <div role="menu" className="absolute right-0 top-full z-40 mt-2 w-64 rounded-xl border bg-white p-2 shadow-card"><div className="border-b px-3 py-2"><p className="truncate text-sm font-semibold">{userName || labels[role]}</p><StatusBadge className="mt-1">{labels[role]}</StatusBadge><p className="mt-2 truncate text-xs text-slate-500">{workspaceName}</p></div><button type="button" role="menuitem" disabled={loggingOut} onClick={() => void logout()} className="mt-2 flex min-h-11 w-full items-center gap-2 rounded-lg px-3 text-left text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"><LogOut className="size-4" />{loggingOut ? "Logging outâ€¦" : "Log out"}</button></div>}
    </div>
  </header>;
}

