import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState, type ReactNode } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { Button, Card, Input, Select, Textarea } from "../../../components/ui";
import { services } from "../../../services/serviceProvider";
import type { PatientRecord } from "../../../shared/types/domain";

const schema = z.object({
  fullName: z.string().min(2, "Name is required"),
  phone: z.string().min(10, "Valid phone is required"),
  whatsappNumber: z.string().optional(),
  age: z.coerce.number().min(0).max(120),
  gender: z.enum(["female", "male", "other"]),
  source: z.enum(["walk_in", "phone", "qr", "whatsapp", "website", "reception"]),
  allergies: z.string().optional(),
  medicalHistory: z.string().optional(),
  currentMedications: z.string().optional(),
  whatsappConsent: z.boolean().optional(),
  reminderConsent: z.boolean().optional(),
});

type FormValues = z.infer<typeof schema>;

const defaultValues: FormValues = {
  fullName: "",
  phone: "",
  whatsappNumber: "",
  age: 0,
  gender: "female",
  source: "reception",
  allergies: "",
  medicalHistory: "",
  currentMedications: "",
  whatsappConsent: false,
  reminderConsent: false,
};

const splitText = (value?: string) => value?.split(/\r?\n|,/).map((item) => item.trim()).filter(Boolean) ?? [];
const joinText = (value: string[]) => value.join("\n");

export function PatientRegistrationForm() {
  const [patients, setPatients] = useState<PatientRecord[]>([]);
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<PatientRecord | null>(null);
  const [loading, setLoading] = useState(false);
  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues });

  const loadPatients = async (nextQuery = query) => {
    setLoading(true);
    try {
      const rows = nextQuery.trim() ? await services.patients.searchPatients(nextQuery.trim()) : await services.patients.getPatients({ status: "active" });
      setPatients(rows);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to load patients.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void loadPatients(""); }, []);

  const submit = async (values: FormValues) => {
    setLoading(true);
    try {
      if (editing) {
        await services.patients.updatePatient(editing.id, {
          full_name: values.fullName,
          phone: values.phone,
          whatsapp_number: values.whatsappNumber || null,
          age: values.age,
          gender: values.gender,
          source: values.source,
          allergies: values.allergies ?? "",
          medical_history: values.medicalHistory ?? "",
          current_medications: values.currentMedications ?? "",
          whatsapp_consent: Boolean(values.whatsappConsent),
          reminder_consent: Boolean(values.reminderConsent),
        });
        toast.success("Patient updated.");
      } else {
        await services.patients.createPatient({
          clinicId: "",
          branchId: "",
          fullName: values.fullName,
          phone: values.phone,
          whatsappNumber: values.whatsappNumber ?? "",
          age: values.age,
          gender: values.gender,
          source: values.source,
          allergies: splitText(values.allergies),
          medicalHistory: splitText(values.medicalHistory),
          currentMedications: splitText(values.currentMedications),
          whatsappConsent: Boolean(values.whatsappConsent),
          reminderConsent: Boolean(values.reminderConsent),
        });
        toast.success("Patient created.");
      }
      setEditing(null);
      reset(defaultValues);
      await loadPatients(query);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to save patient.");
    } finally {
      setLoading(false);
    }
  };

  const startEdit = (patient: PatientRecord) => {
    setEditing(patient);
    reset({
      fullName: patient.fullName,
      phone: patient.phone,
      whatsappNumber: patient.whatsappNumber,
      age: patient.age,
      gender: patient.gender,
      source: patient.source,
      allergies: joinText(patient.allergies),
      medicalHistory: joinText(patient.medicalHistory),
      currentMedications: joinText(patient.currentMedications),
      whatsappConsent: patient.whatsappConsent,
      reminderConsent: patient.reminderConsent,
    });
  };

  const clearForm = () => {
    setEditing(null);
    reset(defaultValues);
  };

  return <div className="space-y-6">
    <form onSubmit={handleSubmit(submit)} className="space-y-6">
      <Section title={editing ? "Edit Patient" : "Basic Details"}>
        <Input label="Full name" error={errors.fullName?.message} {...register("fullName")} placeholder="e.g. Kavya Reddy" />
        <Input label="Phone number" error={errors.phone?.message} {...register("phone")} placeholder="+91 98765 43210" />
        <Input label="WhatsApp number" {...register("whatsappNumber")} placeholder="+91 98765 43210" />
        <Input label="Age" error={errors.age?.message} {...register("age")} type="number" />
        <Select label="Gender" error={errors.gender?.message} {...register("gender")}><option value="female">Female</option><option value="male">Male</option><option value="other">Other</option></Select>
        <Select label="Source" {...register("source")}><option value="reception">Reception</option><option value="walk_in">Walk-in</option><option value="phone">Phone</option><option value="qr">QR</option><option value="whatsapp">WhatsApp</option><option value="website">Website</option></Select>
      </Section>
      <Section title="Medical Details">
        <Textarea label="Allergies" {...register("allergies")} />
        <Textarea label="Medical history" {...register("medicalHistory")} />
        <Textarea label="Current medications" {...register("currentMedications")} />
        <div className="space-y-3 rounded-lg border p-3 text-sm font-semibold">
          <label className="flex items-center gap-2"><input type="checkbox" {...register("whatsappConsent")} /> WhatsApp consent</label>
          <label className="flex items-center gap-2"><input type="checkbox" {...register("reminderConsent")} /> Reminder consent</label>
        </div>
      </Section>
      <div className="flex flex-wrap gap-4"><Button type="submit" loading={loading}>{editing ? "Update Patient" : "Save Patient"}</Button><Button type="button" variant="ghost" onClick={clearForm}>Reset</Button></div>
    </form>
    <Card className="p-4 md:p-5">
      <div className="grid gap-4 md:grid-cols-[1fr_auto]">
        <Input placeholder="Search by name, phone, WhatsApp, or patient ID" value={query} onChange={(event) => setQuery(event.target.value)} />
        <Button type="button" variant="secondary" loading={loading} onClick={() => void loadPatients(query)}>Search</Button>
      </div>
      <div className="mt-4 table-wrap">
        <table className="data-table">
          <thead><tr><th>Patient</th><th>Phone</th><th>WhatsApp</th><th>Age</th><th>Action</th></tr></thead>
          <tbody>{patients.map((patient) => <tr key={patient.id}><td className="font-semibold">{patient.fullName}<p className="text-xs text-slate-400">{patient.patientId}</p></td><td>{patient.phone}</td><td>{patient.whatsappNumber || "-"}</td><td>{patient.age}</td><td><Button size="sm" variant="secondary" onClick={() => startEdit(patient)}>Edit</Button></td></tr>)}</tbody>
        </table>
      </div>
    </Card>
  </div>;
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return <section className="card p-4 md:p-5"><h2 className="mb-4 font-semibold">{title}</h2><div className="grid gap-4 md:grid-cols-2">{children}</div></section>;
}
