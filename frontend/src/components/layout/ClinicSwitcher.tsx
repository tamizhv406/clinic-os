import { Building2, Check, ChevronDown } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { services } from "../../services/serviceProvider";
import type { MyClinic } from "../../services/interfaces";

/**
 * Lets a person who works in several clinics of one brand choose which one they are
 * looking at. Renders nothing for people with a single clinic. Switching reloads the
 * app so every screen starts from the new clinic's data instead of showing a mix.
 */
export function ClinicSwitcher({ onAvailable }: { onAvailable?: (available: boolean) => void }) {
  const [clinics, setClinics] = useState<MyClinic[]>([]);
  const [open, setOpen] = useState(false);
  const [switching, setSwitching] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let mounted = true;
    void services.brands.getMyClinics().then((rows) => { if (mounted) { setClinics(rows); onAvailable?.(rows.length > 1); } }).catch(() => undefined);
    return () => { mounted = false; };
  }, [onAvailable]);

  useEffect(() => {
    const close = (event: MouseEvent | KeyboardEvent) => {
      if (event instanceof KeyboardEvent) { if (event.key === "Escape") setOpen(false); return; }
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => { document.removeEventListener("mousedown", close); document.removeEventListener("keydown", close); };
  }, []);

  if (clinics.length < 2) return null;
  const active = clinics.find((clinic) => clinic.isActive) ?? clinics[0];
  const brand = active.organizationName && active.organizationName !== active.clinicName ? active.organizationName : null;

  const choose = async (clinic: MyClinic) => {
    if (clinic.isActive) { setOpen(false); return; }
    setSwitching(true);
    try {
      await services.brands.switchActiveClinic(clinic.clinicId);
      toast.success(`Switched to ${clinic.clinicName}`);
      window.location.reload();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to switch clinic.");
      setSwitching(false);
    }
  };

  return <div ref={ref} className="relative ml-3 min-w-0">
    <button type="button" aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen((value) => !value)} disabled={switching}
      className="flex min-h-11 max-w-[11rem] items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-left text-sm hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-brand-500 sm:max-w-xs">
      <Building2 className="size-4 shrink-0 text-brand-600" />
      <span className="min-w-0"><span className="block truncate font-semibold text-slate-900">{active.clinicName}</span>{brand && <span className="hidden truncate text-[11px] text-slate-500 sm:block">{brand}</span>}</span>
      <ChevronDown className="size-4 shrink-0 text-slate-400" />
    </button>
    {open && <ul role="listbox" aria-label="Switch clinic" className="absolute left-0 top-full z-40 mt-2 w-72 max-w-[calc(100vw-2rem)] rounded-xl border bg-white p-1.5 shadow-card">
      <li className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Your clinics</li>
      {clinics.map((clinic) => <li key={clinic.clinicId} role="option" aria-selected={clinic.isActive}>
        <button type="button" onClick={() => void choose(clinic)} className={`flex min-h-11 w-full items-center justify-between gap-2 rounded-lg px-3 text-left text-sm hover:bg-slate-50 ${clinic.isActive ? "bg-brand-50 font-semibold text-brand-700" : "text-slate-700"}`}>
          <span className="truncate">{clinic.clinicName}</span>{clinic.isActive && <Check className="size-4 shrink-0" />}
        </button>
      </li>)}
    </ul>}
  </div>;
}
