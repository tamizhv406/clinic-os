import { useEffect, useState } from "react";
import { useLocation, useParams } from "react-router-dom";
import { LoadingSkeleton } from "../../../components/ui";
import { services } from "../../../services/serviceProvider";
import { AppointmentSuccessCard } from "../components/AppointmentSuccessCard";
import { BookingEmptyState } from "../components/BookingEmptyState";
import type { ClinicBookingProfile } from "../types";
import type { PublicBookingResult } from "../../../services/interfaces";

export default function AppointmentSuccess() {
  const { clinicSlug = "" } = useParams();
  const location = useLocation();
  const result = location.state as PublicBookingResult | null;
  const [clinic, setClinic] = useState<ClinicBookingProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    void services.booking
      .getClinicProfile(clinicSlug)
      .then((profile) => { if (mounted) setClinic(profile); })
      .catch(() => undefined)
      .finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, [clinicSlug]);

  if (loading) return <main className="grid min-h-screen place-items-center bg-slate-50 p-5"><div className="w-full max-w-xl"><LoadingSkeleton rows={3} /></div></main>;

  // Landing here without navigation state means the confirmation did not happen in this session.
  if (!result || !clinic) {
    return <main className="grid min-h-screen place-items-center bg-slate-50 p-5">
      <BookingEmptyState title="No booking to show" description="Open this page right after confirming an appointment, or look it up with your phone number and token on the booking status page." />
    </main>;
  }

  return <main className="grid min-h-screen place-items-center bg-slate-50 p-5"><AppointmentSuccessCard result={result} clinic={clinic} /></main>;
}
