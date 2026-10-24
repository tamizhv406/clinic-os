import { Textarea } from "../../../components/ui";
export function ConsultationNotesForm() {
  return <section className="card p-4 md:p-5"><h2 className="font-semibold">Clinical Notes</h2><div className="mt-4 grid gap-4 md:grid-cols-2"><Textarea placeholder="Examination notes" /><Textarea placeholder="Advice" /><Textarea placeholder="Lifestyle advice" /><Textarea placeholder="Procedure suggestion" /></div></section>;
}
