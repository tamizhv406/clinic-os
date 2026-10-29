import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Calendar, Clock, ShieldCheck, UserCheck } from "lucide-react";
import { BrandLogo } from "../../components/common/BrandLogo";
import { LoadingSkeleton } from "../../components/ui";
import { useAuth } from "../../hooks/useAuth";
import { homeForRole } from "../../components/layout/navigation";
import { services } from "../../services/serviceProvider";

export default function LandingPage() {
  const navigate = useNavigate();
  const auth = useAuth();
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [bookingLoading, setBookingLoading] = useState(false);

  useEffect(() => {
    document.title = "Book an Appointment · Vernex Clinic OS";
    let mounted = true;

    auth
      .getSession()
      .then((session) => {
        if (!session) {
          if (mounted) setCheckingAuth(false);
          return;
        }
        return auth
          .getCurrentAuthContext()
          .then((context) => {
            if (mounted && context?.role_key && homeForRole[context.role_key]) {
              navigate(homeForRole[context.role_key], { replace: true });
            } else if (mounted) {
              setCheckingAuth(false);
            }
          })
          .catch(() => {
            if (mounted) setCheckingAuth(false);
          });
      })
      .catch(() => {
        if (mounted) setCheckingAuth(false);
      });

    return () => {
      mounted = false;
    };
  }, [auth, navigate]);

  const handleBookClick = async () => {
    setBookingLoading(true);
    try {
      const clinics = await services.booking.getPublishedClinics();
      if (clinics && clinics.length === 1) {
        navigate(`/book/${clinics[0].slug}`);
      } else {
        navigate("/book");
      }
    } catch {
      navigate("/book");
    } finally {
      setBookingLoading(false);
    }
  };

  if (checkingAuth) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
        <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-card">
          <LoadingSkeleton rows={3} />
        </div>
      </main>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 text-slate-900">
      {/* Quiet Top Header */}
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between px-4 py-4 sm:px-6">
        <Link to="/" className="flex items-center gap-2.5 transition hover:opacity-90">
          <BrandLogo className="size-9" />
          <span className="font-['Manrope'] text-lg font-bold tracking-tight text-slate-900">
            Vernex Clinic OS
          </span>
        </Link>
        <Link
          to="/login"
          className="rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-500 transition hover:bg-slate-200/60 hover:text-slate-800"
        >
          Staff login →
        </Link>
      </header>

      {/* Main Hero Section */}
      <main className="flex flex-1 items-center justify-center px-4 py-12 sm:px-6">
        <div className="mx-auto w-full max-w-2xl text-center">
          <div className="mx-auto mb-6 flex size-16 items-center justify-center rounded-2xl bg-brand-50 shadow-sm">
            <BrandLogo className="size-11" />
          </div>

          <h1 className="font-['Manrope'] text-3xl font-extrabold tracking-tight text-slate-900 sm:text-5xl">
            Vernex Clinic OS
          </h1>

          <p className="mx-auto mt-4 max-w-lg text-base leading-relaxed text-slate-600 sm:text-lg">
            Simple, honest healthcare booking. Choose your clinic and reserve an appointment in seconds.
          </p>

          {/* Action Buttons */}
          <div className="mt-8 flex flex-col items-center justify-center gap-3.5 sm:flex-row">
            <button
              type="button"
              onClick={handleBookClick}
              disabled={bookingLoading}
              className="inline-flex min-h-[52px] w-full items-center justify-center gap-2 rounded-xl bg-brand-600 px-6 py-3.5 text-base font-semibold text-white shadow-sm transition hover:bg-brand-700 active:scale-[0.99] disabled:opacity-75 sm:w-auto"
            >
              <Calendar className="size-5" />
              <span>{bookingLoading ? "Loading clinics..." : "Book an appointment"}</span>
            </button>

            <Link
              to="/booking/status"
              className="inline-flex min-h-[52px] w-full items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-6 py-3.5 text-base font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 hover:text-slate-900 active:scale-[0.99] sm:w-auto"
            >
              <Clock className="size-5 text-slate-500" />
              <span>My appointments</span>
            </Link>
          </div>

          {/* Trust Highlights */}
          <div className="mt-12 grid grid-cols-1 gap-3 text-left sm:grid-cols-3">
            <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-sm">
              <ShieldCheck className="size-5 text-brand-600" />
              <h3 className="mt-2 text-sm font-semibold text-slate-800">Instant Reservation</h3>
              <p className="mt-1 text-xs text-slate-500">Live slot confirmation without doctor approval delays.</p>
            </div>
            <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-sm">
              <UserCheck className="size-5 text-brand-600" />
              <h3 className="mt-2 text-sm font-semibold text-slate-800">Easy Lookup</h3>
              <p className="mt-1 text-xs text-slate-500">View upcoming and past appointments with just your phone number.</p>
            </div>
            <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-sm">
              <Clock className="size-5 text-brand-600" />
              <h3 className="mt-2 text-sm font-semibold text-slate-800">Zero Wait Tokens</h3>
              <p className="mt-1 text-xs text-slate-500">Get your consultation token immediately on booking.</p>
            </div>
          </div>
        </div>
      </main>

      {/* Quiet Footer */}
      <footer className="border-t border-slate-200/60 py-6 text-center text-xs text-slate-400">
        <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-2 px-4 sm:flex-row sm:px-6">
          <p>© {new Date().getFullYear()} Vernex Clinic OS. All rights reserved.</p>
          <div className="flex gap-4">
            <Link to="/booking/status" className="hover:text-slate-600">
              Find appointments
            </Link>
            <Link to="/login" className="hover:text-slate-600">
              Staff portal
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
