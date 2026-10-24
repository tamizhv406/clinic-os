import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { MapPin, Phone } from "lucide-react";
import { BrandLogo, LoadingSkeleton } from "../../../components/ui";
import { services } from "../../../services/serviceProvider";
import { BookingEmptyState } from "../components/BookingEmptyState";
import type { ClinicDirectoryEntry } from "../types";

export default function ClinicDirectory() {
  const [clinics, setClinics] = useState<ClinicDirectoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      setLoading(true);
      try {
        const list = await services.booking.getPublishedClinics();
        if (mounted) setClinics(list);
      } catch (err) {
        if (mounted) setError(err instanceof Error ? err.message : "Could not load clinics.");
      } finally {
        if (mounted) setLoading(false);
      }
    };
    void load();
    return () => { mounted = false; };
  }, []);

  return <main className="min-h-screen bg-slate-50 px-4 py-8">
    <div className="mx-auto max-w-4xl space-y-6">
      <header className="text-center">
        <div className="mx-auto w-fit rounded-xl bg-white p-2 shadow-card"><BrandLogo className="size-14" /></div>
        <h1 className="mt-4 font-['Manrope'] text-2xl font-semibold text-slate-800 sm:text-3xl">Choose a clinic</h1>
        <p className="mt-1 text-sm text-slate-500">Select a clinic below to book your appointment.</p>
      </header>

      {loading && <LoadingSkeleton rows={4} />}

      {!loading && (error || clinics.length === 0) && (
        <BookingEmptyState title="No clinics available" description={error || "No clinics are currently accepting online bookings."} />
      )}

      {!loading && !error && clinics.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2">
          {clinics.map((clinic) => (
            <Link
              key={clinic.id}
              to={`/book/${clinic.slug}`}
              className="rounded-xl border border-slate-100 bg-white p-5 shadow-card transition hover:-translate-y-0.5 hover:shadow-card"
            >
              <div className="flex items-start gap-4">
                <div className="rounded-xl bg-brand-50 p-2">
                  {clinic.logoUrl ? <img src={clinic.logoUrl} alt="" className="size-10 rounded-xl object-cover" /> : <BrandLogo className="size-10" />}
                </div>
                <div className="min-w-0">
                  <h2 className="truncate font-semibold text-slate-800">{clinic.name}</h2>
                  {clinic.specialization && <p className="truncate text-sm text-slate-500">{clinic.specialization}</p>}
                </div>
              </div>
              <div className="mt-4 grid gap-1.5 text-sm text-slate-500">
                {clinic.address && <span className="flex items-center gap-2 truncate"><MapPin className="size-4 shrink-0" />{clinic.address}</span>}
                {clinic.phone && <span className="flex items-center gap-2"><Phone className="size-4 shrink-0" />{clinic.phone}</span>}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  </main>;
}

