import { Card } from "../../../components/ui";

export function PatientDetailsCollector({ details }: { details: string }) {
  return <Card className="p-4"><p className="font-semibold">Patient details collected</p><p className="mt-2 rounded-xl bg-slate-50 p-3 text-sm text-slate-600">{details}</p><p className="mt-2 text-xs text-slate-500">Collected one question at a time in the real WhatsApp flow.</p></Card>;
}
