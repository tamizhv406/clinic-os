import { StatusBadge } from "../../../components/common/StatusBadge";
import { useEffect, useState } from "react";
import { Plus, Send } from "lucide-react";
import { toast } from "sonner";
import { Button, Textarea } from "../../../components/ui";
import { services } from "../../../services/serviceProvider";
import { localDateISO } from "../../../utils/formatDate";
import type { LabTest, Medicine, PatientProfile, PrescriptionItem, PrescriptionTemplate, WhatsAppDeliveryStatus } from "../types";
import { LabTestSuggestionPanel } from "./LabTestSuggestionPanel";
import { MedicineReminderSetup } from "./MedicineReminderSetup";
import { MedicineRow } from "./MedicineRow";
import { PrescriptionPreview } from "./PrescriptionPreview";
import { PrescriptionTemplatePanel } from "./PrescriptionTemplatePanel";
import { PrescriptionWhatsAppModal } from "./PrescriptionWhatsAppModal";
import { ReminderConsentModal } from "./ReminderConsentModal";
import { ReminderSchedulePreview } from "./ReminderSchedulePreview";

const blank = (): PrescriptionItem => ({ id: crypto.randomUUID(), medicineName: "", dosage: "1 tablet", frequency: "1-0-1", timing: "After food", duration: "3 days", instructions: "", quantity: "" });
export function PrescriptionBuilder({ patient }: { patient: PatientProfile }) {
  const [items, setItems] = useState<PrescriptionItem[]>([blank()]);
  const [favorites, setFavorites] = useState<Medicine[]>([]);
  const [templates, setTemplates] = useState<PrescriptionTemplate[]>([]);
  const [labTests, setLabTests] = useState<LabTest[]>([]);
  const [selectedLabTests, setSelectedLabTests] = useState<string[]>([]);
  const [doctorName, setDoctorName] = useState("");
  const [diagnosis, setDiagnosis] = useState("");
  const [sendOpen, setSendOpen] = useState(false);
  const [consentOpen, setConsentOpen] = useState(false);
  const [showReminders, setShowReminders] = useState(false);
  const [deliveryStatus, setDeliveryStatus] = useState<WhatsAppDeliveryStatus>("queued");
  const [savedPrescriptionId, setSavedPrescriptionId] = useState("");
  const [loading, setLoading] = useState(false);
  const [sendToPharmacy, setSendToPharmacy] = useState(true);
  const [pharmacyStatus, setPharmacyStatus] = useState<string | null>(null);
  const [advice, setAdvice] = useState("");
  const [dietAdvice, setDietAdvice] = useState("");
  const [avoidItems, setAvoidItems] = useState("");
  const [restNote, setRestNote] = useState("");
  const update = (next: PrescriptionItem) => setItems((rows) => rows.map((row) => row.id === next.id ? next : row));
  const addItems = (newItems: PrescriptionItem[]) => setItems((rows) => [...rows.filter((row) => row.medicineName.trim()), ...newItems.map((i) => ({ ...i, id: crypto.randomUUID() }))]);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const context = await services.auth.getCurrentAuthContext();
        const profile = await services.doctor.getDoctorProfileByStaffId(context.staffProfileId);
        const [nextFavorites, nextTemplates, nextLabTests] = await Promise.all([
          services.catalog.getFavoriteMedicines(profile?.id),
          services.catalog.getPrescriptionTemplates(profile?.id),
          services.catalog.getLabTests(),
        ]);
        // The prescription letterhead shows the signing doctor and the diagnosis
        // recorded during the consultation this prescription belongs to.
        const [latestConsultation] = await services.doctor.getConsultationsByPatient(patient.id).catch(() => []);
        if (!mounted) return;
        setDoctorName(context.fullName);
        setDiagnosis(latestConsultation?.diagnosis ?? "");
        setFavorites(nextFavorites);
        setTemplates(nextTemplates);
        setLabTests(nextLabTests);
      } catch (error) {
        if (mounted) toast.error(error instanceof Error ? error.message : "Unable to load prescription templates and favourites.");
      }
    };
    void load();
    return () => { mounted = false; };
  }, [patient.id]);

  // Follow the pharmacy's progress (Sent -> Received -> Dispensed) while it is still moving.
  useEffect(() => {
    if (!savedPrescriptionId || !pharmacyStatus || !["sent_to_pharmacy", "received"].includes(pharmacyStatus)) return;
    const timer = window.setInterval(() => {
      services.doctor.getPrescriptionById(savedPrescriptionId)
        .then((result) => { if (result?.prescription.pharmacy_status) setPharmacyStatus(result.prescription.pharmacy_status); })
        .catch(() => undefined);
    }, 30_000);
    return () => window.clearInterval(timer);
  }, [savedPrescriptionId, pharmacyStatus]);

  /** Creates the prescription in one database call; when finalizing with "Send to pharmacy" ticked the pharmacy order is created in the same transaction. */
  const savePrescription = async (options: { finalize?: boolean; send?: boolean } = {}) => {
    if (savedPrescriptionId) {
      toast.info("This prescription is already saved.");
      return savedPrescriptionId;
    }
    if (!isUuid(patient.id)) {
      toast.error("Load a real patient record before saving a Supabase prescription.");
      return null;
    }
    const medicineRows = items.filter((item) => item.medicineName.trim());
    if (medicineRows.length === 0) {
      toast.error("Add at least one medicine before saving.");
      return null;
    }
    setLoading(true);
    try {
      const context = await services.auth.getCurrentAuthContext();
      const doctorProfile = await services.doctor.getDoctorProfileByStaffId(context.staffProfileId);
      if (!doctorProfile) throw new Error("No active doctor profile is linked to this staff user.");
      const [latestConsultation] = await services.doctor.getConsultationsByPatient(patient.id);
      const saved = await services.doctor.createPrescriptionWithItems({
        prescription: {
          clinic_id: context.clinic_id || doctorProfile.clinic_id,
          branch_id: context.branch_id || doctorProfile.branch_id,
          consultation_id: latestConsultation?.id || null,
          appointment_id: latestConsultation?.appointment_id || null,
          patient_id: patient.id,
          doctor_id: doctorProfile.id,
          diagnosis_summary: latestConsultation?.diagnosis || null,
          advice: formatAdvice(advice, dietAdvice, avoidItems, restNote, selectedLabTests),
          status: options.finalize ? "finalized" : "draft",
          finalized_at: options.finalize ? new Date().toISOString() : null,
          delivery_status: "queued",
          delivery_channel: options.send ? "pharmacy" : "none",
          send_to_pharmacy: Boolean(options.send),
          pharmacy_status: options.send ? "sent_to_pharmacy" : "not_sent",
          metadata: { source: "doctor_prescription_builder" },
        },
        items: medicineRows.map((item, index) => ({
          medicine_id: item.medicineId ?? null,
          medicine_name: item.medicineName,
          dosage: item.dosage,
          frequency: item.frequency,
          timing: item.timing,
          duration: item.duration,
          food_instruction: item.timing.toLowerCase().includes("before") ? "before_food" : "after_food",
          quantity: item.quantity || null,
          instructions: item.instructions || null,
          sort_order: index,
          reminder_enabled: showReminders,
          reminder_frequency: showReminders ? item.frequency : null,
          reminder_start_date: showReminders ? localDateISO() : null,
          metadata: { local_item_id: item.id },
        })),
        reminderConsentConfirmed: showReminders,
      });
      setSavedPrescriptionId(saved.prescription.id);
      setPharmacyStatus(saved.prescription.pharmacy_status ?? null);
      // Feed the doctor's favourites list so the next prescription surfaces what they actually prescribe.
      if (doctorProfile.id) {
        await services.catalog.recordMedicineUsage(doctorProfile.id, medicineRows.map((item) => item.medicineName)).catch(() => undefined);
        services.catalog.getFavoriteMedicines(doctorProfile.id).then(setFavorites).catch(() => undefined);
      }
      if (!options.finalize) toast.success("Prescription saved.");
      return saved.prescription.id;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to save prescription.");
      return null;
    } finally {
      setLoading(false);
    }
  };
  const ensureSaved = async () => savedPrescriptionId || await savePrescription();
  const sendPrescription = async () => {
    const prescriptionId = await ensureSaved();
    if (!prescriptionId) return;
    setLoading(true);
    try {
      await services.doctor.sendPrescriptionToPatientPlaceholder(prescriptionId);
      setDeliveryStatus("sent");
      setSendOpen(false);
      toast.success("WhatsApp placeholder marked as sent.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to update WhatsApp placeholder status.");
    } finally {
      setLoading(false);
    }
  };
  // Sends to pharmacy without finalizing (the prescription stays a draft).
  const routeToPharmacy = async () => {
    const prescriptionId = await ensureSaved();
    if (!prescriptionId) return;
    setLoading(true);
    try {
      const row = await services.doctor.routePrescriptionToPharmacy(prescriptionId);
      setPharmacyStatus(row.pharmacy_status ?? "sent_to_pharmacy");
      toast.success("Prescription sent to pharmacy.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to send the prescription to pharmacy.");
    } finally {
      setLoading(false);
    }
  };
  // Complete Consultation = save (if needed) + finalize + send to pharmacy when ticked.
  const completeConsultation = async () => {
    const doneMessage = sendToPharmacy ? "Consultation completed. Prescription sent to pharmacy." : "Consultation completed.";
    if (!savedPrescriptionId) {
      if (await savePrescription({ finalize: true, send: sendToPharmacy })) toast.success(doneMessage);
      return;
    }
    setLoading(true);
    try {
      await services.doctor.updatePrescription(savedPrescriptionId, { status: "finalized", finalized_at: new Date().toISOString() });
      if (sendToPharmacy) {
        const row = await services.doctor.routePrescriptionToPharmacy(savedPrescriptionId);
        setPharmacyStatus(row.pharmacy_status ?? "sent_to_pharmacy");
      }
      toast.success(doneMessage);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to complete the consultation.");
    } finally {
      setLoading(false);
    }
  };
  return <div className="space-y-6"><div className="card p-4 md:p-5"><div className="flex flex-wrap items-center justify-between gap-2"><h2 className="font-semibold">Medicine Builder</h2><div className="flex flex-wrap gap-2"><Button type="button" variant="secondary" icon={<Plus className="size-4" />} onClick={() => setItems([...items, blank()])}>Add Medicine</Button><Button type="button" variant="ghost" onClick={() => setItems([])}>Clear Prescription</Button></div></div><div className="mt-4 space-y-3">{items.map((item) => <MedicineRow key={item.id} item={item} onChange={update} onRemove={() => setItems(items.filter((row) => row.id !== item.id))} />)}</div></div><div className="grid gap-4 xl:grid-cols-[.7fr_1.3fr]"><div className="space-y-6"><div className="card p-4 md:p-5"><h2 className="font-semibold">Favorite Medicines</h2><div className="mt-3 flex flex-wrap gap-2">{favorites.length > 0 ? favorites.map((m) => <Button key={m.id} variant="secondary" className="min-h-8 px-3 py-1" onClick={() => addItems([{ ...blank(), medicineName: m.name, dosage: m.form || "1 tablet" }])}>{m.name}</Button>) : <p className="text-sm text-slate-500">Medicines you prescribe often will appear here.</p>}</div></div><PrescriptionTemplatePanel templates={templates} onUse={addItems} /><LabTestSuggestionPanel tests={labTests} selected={selectedLabTests} onToggle={(name) => setSelectedLabTests((current) => current.includes(name) ? current.filter((item) => item !== name) : [...current, name])} />{showReminders && <ReminderSchedulePreview items={items} />}</div><div className="space-y-6"><div className="card p-4 md:p-5"><h2 className="font-semibold">Advice</h2><div className="mt-3 grid gap-4 md:grid-cols-2"><Textarea placeholder="General advice" value={advice} onChange={(event) => setAdvice(event.target.value)} /><Textarea placeholder="Diet advice" value={dietAdvice} onChange={(event) => setDietAdvice(event.target.value)} /><Textarea placeholder="Avoid items" value={avoidItems} onChange={(event) => setAvoidItems(event.target.value)} /><Textarea placeholder="Rest/work note" value={restNote} onChange={(event) => setRestNote(event.target.value)} /></div></div>{showReminders && <div className="card p-4 md:p-5"><h2 className="font-semibold">WhatsApp Medicine Reminders</h2><p className="mt-1 text-sm text-slate-500">Optional. Do not enable without consent.</p><div className="mt-4"><MedicineReminderSetup items={items} /></div></div>}<PrescriptionPreview patient={patient} items={items} diagnosis={diagnosis} doctorName={doctorName} advice={formatAdvice(advice, dietAdvice, avoidItems, restNote, selectedLabTests)} /></div></div><div className="sticky bottom-3 z-10 flex flex-wrap gap-2 rounded-xl border bg-white/95 p-3 shadow-card backdrop-blur"><Button loading={loading} onClick={() => void savePrescription()}>Save Prescription</Button><Button loading={loading} icon={<Send className="size-4" />} onClick={() => setSendOpen(true)}>Send Prescription to WhatsApp</Button><Button loading={loading} variant="secondary" onClick={() => void routeToPharmacy()}>Send to Pharmacy now</Button><Button variant="secondary" onClick={() => { window.print(); toast.info("Print placeholder opened."); }}>Print</Button><Button variant="secondary" onClick={() => setConsentOpen(true)}>Enable Medicine Reminders</Button><label className="flex min-h-10 items-center gap-2 rounded-lg border px-3 text-sm font-medium"><input type="checkbox" className="size-4" checked={sendToPharmacy} onChange={(event) => setSendToPharmacy(event.target.checked)} />Send to pharmacy</label><Button loading={loading} onClick={() => void completeConsultation()}>Complete Consultation</Button>{deliveryStatus !== "queued" && <StatusBadge tone="success">WhatsApp status: {deliveryStatus}</StatusBadge>}{savedPrescriptionId && <StatusBadge>Saved</StatusBadge>}{pharmacyStatus && pharmacyStatusChip[pharmacyStatus] && <StatusBadge tone={pharmacyStatusChip[pharmacyStatus].tone} dot>{pharmacyStatusChip[pharmacyStatus].label}</StatusBadge>}</div><PrescriptionWhatsAppModal open={sendOpen} patient={patient} items={items} status={deliveryStatus} onClose={() => setSendOpen(false)} onSend={() => void sendPrescription()} /><ReminderConsentModal open={consentOpen} onClose={() => setConsentOpen(false)} onEnable={() => { setShowReminders(true); setConsentOpen(false); }} /></div>;
}

const pharmacyStatusChip: Record<string, { label: string; tone: "info" | "brand" | "success" | "danger" }> = {
  sent_to_pharmacy: { label: "Sent to pharmacy", tone: "info" },
  received: { label: "Received by pharmacy", tone: "brand" },
  dispensed: { label: "Dispensed", tone: "success" },
  cancelled: { label: "Pharmacy could not supply", tone: "danger" },
};

function formatAdvice(general: string, diet: string, avoid: string, rest: string, labTests: string[]) {
  return [
    general && `Advice: ${general}`,
    diet && `Diet: ${diet}`,
    avoid && `Avoid: ${avoid}`,
    rest && `Rest/work: ${rest}`,
    labTests.length > 0 && `Lab tests: ${labTests.join(", ")}`,
  ].filter(Boolean).join("\n");
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}
