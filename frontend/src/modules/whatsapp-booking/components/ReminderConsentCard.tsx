import { Card } from "../../../components/ui";

export function ReminderConsentCard({ consent = true }: { consent?: boolean }) {
  return <Card className="p-4"><p className="font-semibold">Reminder consent</p><p className={`mt-2 text-sm font-semibold ${consent ? "text-success-700" : "text-warning-700"}`}>{consent ? "Patient consent confirmed" : "Consent not received"}</p></Card>;
}
