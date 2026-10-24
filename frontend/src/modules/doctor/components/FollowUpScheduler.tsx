import { CalendarDays } from "lucide-react";
import { Input, Textarea } from "../../../components/ui";
export function FollowUpScheduler() {
  return <section className="card p-4 md:p-5"><div className="flex items-center gap-2"><CalendarDays className="size-5 text-brand-700" /><h2 className="font-semibold">Follow-up</h2></div><label className="mt-4 flex items-center gap-2 text-sm font-semibold"><input type="checkbox" defaultChecked /> Follow-up required</label><div className="mt-3 grid gap-4 md:grid-cols-2"><Input type="date" defaultValue="2026-07-05" /><Input placeholder="Reminder channel placeholder" defaultValue="WhatsApp" /><Textarea className="md:col-span-2" placeholder="Follow-up reason" defaultValue="Review symptoms and fever trend" /></div></section>;
}
