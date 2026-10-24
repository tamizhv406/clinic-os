import { CalendarDays, Clock3, MapPin, Phone } from "lucide-react";
import { BrandLogo, Button } from "../../../components/ui";
import type { BookingDoctor, ClinicBookingProfile } from "../types";

export function ClinicHero({ clinic, doctors = [] }: { clinic: ClinicBookingProfile; doctors?: BookingDoctor[] }) {
  const availableToday = doctors.filter((doctor) => doctor.availableToday);
  const whatsappDigits = clinic.whatsapp.replace(/\D/g, "");

  return <section className="overflow-hidden rounded-xl bg-slate-900 text-white shadow-card">
    <div className="grid gap-6 p-6 md:grid-cols-[1fr_.8fr] md:p-8">
      <div>
        <div className="flex items-center gap-4">
          <div className="rounded-xl bg-white p-1"><BrandLogo className="size-16" /></div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[.18em] text-brand-100">Book Your Appointment</p>
            <h1 className="font-['Manrope'] text-3xl font-semibold">{clinic.name}</h1>
          </div>
        </div>
        {clinic.specialization && <p className="mt-4 text-brand-50">{clinic.specialization}</p>}
        <div className="mt-5 grid gap-2 text-sm text-slate-100">
          {clinic.address && <span className="flex gap-2"><MapPin className="size-4" />{clinic.address}</span>}
          {clinic.hours && <span className="flex gap-2"><Clock3 className="size-4" />{clinic.hours}</span>}
          {clinic.phone && <span className="flex gap-2"><Phone className="size-4" />{clinic.phone}</span>}
        </div>
        <div className="mt-6 flex flex-wrap gap-2">
          <Button to={`/book/${clinic.slug}/flow`} icon={<CalendarDays className="size-4" />}>Book Appointment</Button>
          {clinic.phone && <a href={`tel:${clinic.phone.replace(/\s/g, "")}`}><Button variant="secondary">Call clinic</Button></a>}
          {whatsappDigits && <a href={`https://wa.me/${whatsappDigits}`} target="_blank" rel="noreferrer"><Button variant="secondary">WhatsApp</Button></a>}
          {clinic.mapUrl && clinic.mapUrl !== "#" && <a href={clinic.mapUrl} target="_blank" rel="noreferrer"><Button variant="ghost" className="text-white hover:bg-white/10">Google Maps</Button></a>}
        </div>
      </div>
      <div className="rounded-xl bg-white/10 p-5">
        <p className="font-semibold">Available today</p>
        <div className="mt-4 grid gap-4">
          {availableToday.length > 0
            ? availableToday.slice(0, 4).map((doctor) => <div key={doctor.id} className="rounded-xl bg-white/10 p-3 text-sm">{doctor.name} Â· {doctor.specialization}</div>)
            : <p className="rounded-xl bg-white/10 p-3 text-sm">Pick a date in the booking flow to see open slots.</p>}
        </div>
      </div>
    </div>
  </section>;
}

