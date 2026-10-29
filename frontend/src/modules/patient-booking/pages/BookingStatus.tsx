import { useEffect, useState, useMemo, useCallback } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { Calendar, Clock, MapPin, ShieldCheck, Stethoscope, User } from "lucide-react";
import { Button, Card, Input, LoadingSkeleton, Select, StatusBadge } from "../../../components/ui";
import { BrandLogo } from "../../../components/common/BrandLogo";
import { services } from "../../../services/serviceProvider";
import { BookingEmptyState } from "../components/BookingEmptyState";
import type { ClinicDirectoryEntry, PatientAppointmentItem } from "../types";
import { getAppointmentStatusLabel, getAppointmentStatusTone } from "../../../shared/utils/appointmentStatus";

export default function BookingStatus() {
  const [searchParams] = useSearchParams();
  const initialClinic = searchParams.get("clinic") || "";
  const initialPhone = searchParams.get("phone") || "";

  const [clinics, setClinics] = useState<ClinicDirectoryEntry[]>([]);
  const [selectedClinic, setSelectedClinic] = useState(initialClinic);
  const [phone, setPhone] = useState(initialPhone);
  const [loadingClinics, setLoadingClinics] = useState(true);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [appointments, setAppointments] = useState<PatientAppointmentItem[]>([]);
  const [rateLimited, setRateLimited] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    document.title = "My Appointments · Vernex Clinic OS";
    let mounted = true;

    void services.booking
      .getPublishedClinics()
      .then((data) => {
        if (!mounted) return;
        setClinics(data);
        if (data.length === 1 && !selectedClinic) {
          setSelectedClinic(data[0].slug);
        } else if (!selectedClinic && initialClinic) {
          setSelectedClinic(initialClinic);
        }
      })
      .catch(() => {
        if (mounted) toast.error("Unable to load clinic directory.");
      })
      .finally(() => {
        if (mounted) setLoadingClinics(false);
      });

    return () => {
      mounted = false;
    };
  }, [initialClinic, selectedClinic]);

  const handleSearch = useCallback(async (overrideClinic?: string, overridePhone?: string) => {
    const targetClinic = (overrideClinic ?? selectedClinic).trim();
    const targetPhone = (overridePhone ?? phone).trim();

    if (!targetClinic) {
      toast.error("Please choose a clinic.");
      return;
    }
    const cleanDigits = targetPhone.replace(/\D/g, "");
    if (cleanDigits.length < 10) {
      toast.error("Please enter a valid 10-digit mobile number.");
      return;
    }

    setLoading(true);
    setRateLimited(false);
    setErrorMessage(null);
    setSearched(true);

    try {
      const items = await services.booking.getMyAppointments(targetClinic, targetPhone);
      setAppointments(items);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unable to look up appointments.";
      if (message.toLowerCase().includes("too many tries")) {
        setRateLimited(true);
        setErrorMessage("Too many tries, please try again in a few minutes.");
      } else {
        setErrorMessage(message);
        toast.error(message);
      }
      setAppointments([]);
    } finally {
      setLoading(false);
    }
  }, [phone, selectedClinic]);

  // Trigger search on mount if both clinic and phone were provided in URL
  useEffect(() => {
    if (initialClinic && initialPhone && initialPhone.replace(/\D/g, "").length >= 10) {
      void handleSearch(initialClinic, initialPhone);
    }
  }, [handleSearch, initialClinic, initialPhone]);

  const upcomingList = useMemo(() => appointments.filter((a) => a.isUpcoming), [appointments]);
  const pastList = useMemo(() => appointments.filter((a) => !a.isUpcoming), [appointments]);

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 text-slate-900">
      {/* Top Header */}
      <header className="border-b border-slate-200/80 bg-white">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3.5 sm:px-6">
          <Link to="/" className="flex items-center gap-2.5 transition hover:opacity-90">
            <BrandLogo className="size-8" />
            <span className="font-['Manrope'] text-base font-bold tracking-tight text-slate-900">
              Vernex Clinic OS
            </span>
          </Link>
          <div className="flex items-center gap-3">
            <Link
              to="/book"
              className="text-xs font-semibold text-brand-600 transition hover:text-brand-700"
            >
              Book an appointment
            </Link>
            <Link
              to="/login"
              className="rounded-lg px-2.5 py-1 text-xs font-semibold text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
            >
              Staff login
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 sm:px-6">
        <div className="mb-6 text-center sm:text-left">
          <h1 className="font-['Manrope'] text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            My Appointments
          </h1>
          <p className="mt-1.5 text-sm text-slate-600">
            Find your upcoming consultation tokens and past visit history with your mobile number.
          </p>
        </div>

        {/* Lookup Card */}
        <Card className="p-5 sm:p-6 shadow-card">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void handleSearch();
            }}
            className="grid gap-4 sm:grid-cols-2"
          >
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Clinic
              </label>
              {loadingClinics ? (
                <div className="h-10 animate-pulse rounded-lg bg-slate-100" />
              ) : (
                <Select
                  value={selectedClinic}
                  onChange={(e) => setSelectedClinic(e.target.value)}
                  className="w-full"
                >
                  <option value="">Choose your clinic...</option>
                  {clinics.map((c) => (
                    <option key={c.id} value={c.slug}>
                      {c.name}
                    </option>
                  ))}
                </Select>
              )}
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Mobile Number
              </label>
              <Input
                type="tel"
                placeholder="10-digit mobile number"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full"
              />
            </div>

            <div className="sm:col-span-2 flex flex-col gap-2 pt-1 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-slate-400">
                Accepts 10 digits with or without country code (+91, spaces or leading 0).
              </p>
              <Button type="submit" loading={loading} className="w-full sm:w-auto">
                Show my appointments
              </Button>
            </div>
          </form>
        </Card>

        {/* Rate Limiting Notice */}
        {rateLimited && (
          <div className="mt-6 rounded-2xl border border-warning-200 bg-warning-50 p-5 text-sm text-warning-800">
            <h3 className="font-semibold text-warning-900">Too many lookup attempts</h3>
            <p className="mt-1">
              For security, lookups are limited per number. Please wait a few minutes before trying again.
            </p>
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div className="mt-6 space-y-4">
            <Card className="p-5">
              <LoadingSkeleton rows={3} />
            </Card>
            <Card className="p-5">
              <LoadingSkeleton rows={3} />
            </Card>
          </div>
        )}

        {/* General Error State */}
        {!loading && errorMessage && !rateLimited && (
          <div className="mt-6 rounded-2xl border border-danger-200 bg-danger-50 p-5 text-sm text-danger-800">
            <p>{errorMessage}</p>
          </div>
        )}

        {/* Empty State */}
        {!loading && searched && !rateLimited && !errorMessage && appointments.length === 0 && (
          <div className="mt-6">
            <BookingEmptyState
              title="No appointments found"
              description="We could not find any appointments for this number at this clinic. Check the number or the clinic."
            />
            <div className="mt-4 flex justify-center">
              <Button to={selectedClinic ? `/book/${selectedClinic}` : "/book"}>
                Book a new appointment
              </Button>
            </div>
          </div>
        )}

        {/* Results */}
        {!loading && !rateLimited && appointments.length > 0 && (
          <div className="mt-8 space-y-8">
            {/* Upcoming Appointments */}
            {upcomingList.length > 0 && (
              <section className="space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500">
                    Upcoming Appointments ({upcomingList.length})
                  </h2>
                </div>
                <div className="space-y-4">
                  {upcomingList.map((item) => (
                    <AppointmentCard key={item.bookingId} item={item} />
                  ))}
                </div>
              </section>
            )}

            {/* Past Appointments (last 90 days) */}
            {pastList.length > 0 && (
              <section className="space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500">
                    Past Appointments — Last 90 Days ({pastList.length})
                  </h2>
                </div>
                <div className="space-y-4">
                  {pastList.map((item) => (
                    <AppointmentCard key={item.bookingId} item={item} muted />
                  ))}
                </div>
              </section>
            )}

            {/* Bottom Booking Action */}
            <div className="pt-4 text-center">
              <Button
                variant="secondary"
                to={selectedClinic ? `/book/${selectedClinic}` : "/book"}
              >
                Book another appointment
              </Button>
            </div>
          </div>
        )}

        {/* Privacy Note */}
        <div className="mt-12 rounded-xl border border-slate-200/60 bg-white/60 p-4 text-xs text-slate-500">
          <div className="flex items-start gap-2.5">
            <ShieldCheck className="size-4 shrink-0 text-slate-400 mt-0.5" />
            <div>
              <p className="font-semibold text-slate-700">Patient Privacy Protection</p>
              <p className="mt-0.5 leading-relaxed text-slate-500">
                To protect confidentiality without requiring an account, patient names are partially masked (e.g. Rahul S.) and private medical records, vitals, prescriptions, and billing notes are never accessible through this lookup.
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

function AppointmentCard({ item, muted }: { item: PatientAppointmentItem; muted?: boolean }) {
  const isInactive = item.status === "cancelled" || item.status === "no_show";

  return (
    <Card
      className={`p-5 transition shadow-card ${
        muted || isInactive
          ? "border-slate-200 bg-slate-50/70 opacity-80"
          : "border-slate-200 bg-white"
      }`}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        {/* Token and Main Info */}
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <span className="font-['Manrope'] text-3xl font-extrabold tracking-tight text-brand-700">
              {item.token || "No Token"}
            </span>
            <StatusBadge tone={getAppointmentStatusTone(item.status)}>
              {getAppointmentStatusLabel(item.status, "compact")}
            </StatusBadge>
          </div>
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            {getAppointmentStatusLabel(item.status, "patient")}
          </p>
        </div>

        {/* Date and Time */}
        <div className="text-left sm:text-right">
          <div className="flex items-center gap-1.5 text-sm font-bold text-slate-900 sm:justify-end">
            <Calendar className="size-4 text-slate-400" />
            <span>{item.date}</span>
          </div>
          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 sm:justify-end mt-0.5">
            <Clock className="size-3.5 text-slate-400" />
            <span>{item.time}</span>
          </div>
        </div>
      </div>

      {/* Details Grid */}
      <div className="mt-4 grid gap-2 border-t border-slate-100 pt-3 text-sm sm:grid-cols-2">
        <div className="space-y-1">
          <div className="flex items-center gap-1.5 text-slate-700 font-medium">
            <Stethoscope className="size-4 text-brand-600 shrink-0" />
            <span>{item.doctorName}</span>
          </div>
          <p className="text-xs text-slate-500 pl-5.5">{item.doctorSpecialty}</p>
        </div>

        <div className="space-y-1">
          <div className="flex items-center gap-1.5 text-slate-700">
            <User className="size-4 text-slate-400 shrink-0" />
            <span className="font-medium">{item.patientName}</span>
          </div>
          {item.serviceName && (
            <p className="text-xs text-slate-500 pl-5.5">{item.serviceName}</p>
          )}
        </div>

        <div className="space-y-0.5 sm:col-span-2 text-xs text-slate-500 pt-1">
          <div className="flex items-center gap-1.5">
            <MapPin className="size-3.5 text-slate-400 shrink-0" />
            <span>{item.clinicName} · {item.clinicAddress}</span>
          </div>
        </div>
      </div>

      {/* Reception Instruction Banner */}
      <div className="mt-4 flex flex-col gap-1 rounded-xl bg-brand-50/80 px-3.5 py-2 text-xs text-brand-800 sm:flex-row sm:items-center sm:justify-between">
        <span className="font-semibold">{item.instructions || "Show your token number at reception."}</span>
        <span className="font-mono text-[11px] text-brand-600/80">Ref: {item.bookingId.slice(0, 8)}...</span>
      </div>
    </Card>
  );
}
