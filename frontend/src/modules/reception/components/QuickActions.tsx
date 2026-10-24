import { CalendarPlus, MessageCircle, ReceiptIndianRupee, Search, UserPlus, Users } from "lucide-react";
import { Link } from "react-router-dom";

const actions = [
  { label: "Add Walk-in", to: "/reception/new-patient", icon: UserPlus },
  { label: "Create Appointment", to: "/reception/appointments", icon: CalendarPlus },
  { label: "Search Patient", to: "/reception/new-patient", icon: Search },
  { label: "Generate Bill", to: "/reception/billing", icon: ReceiptIndianRupee },
  { label: "Open Queue", to: "/reception/queue", icon: Users },
  { label: "WhatsApp Booking Flow", to: "/reception/appointments", icon: MessageCircle }
];

export function QuickActions() {
  return <div className="card p-4 md:p-5"><h2 className="font-semibold">Quick actions</h2><div className="mt-4 grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6">{actions.map(({ label, to, icon: Icon }) => <Link key={label} to={to} className="rounded-xl border p-4 text-sm font-semibold transition hover:border-brand-300 hover:bg-brand-50"><span className="mb-3 inline-grid size-10 place-items-center rounded-xl bg-brand-50 text-brand-700"><Icon className="size-5" /></span><span className="block">{label}</span></Link>)}</div></div>;
}
