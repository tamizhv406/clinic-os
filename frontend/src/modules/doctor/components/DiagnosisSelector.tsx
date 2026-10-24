import { Input, Select, Textarea } from "../../../components/ui";
export function DiagnosisSelector() {
  return <section className="card p-4 md:p-5"><h2 className="font-semibold">Diagnosis</h2><div className="mt-4 grid gap-4 md:grid-cols-[1fr_.45fr]"><Input placeholder="Search/select diagnosis" defaultValue="Viral fever" /><Select><option>provisional</option><option>final</option></Select><Textarea className="md:col-span-2" placeholder="Diagnosis notes" /></div></section>;
}
