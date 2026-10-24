import { StatusBadge } from "../../../components/common/StatusBadge";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button, Card, Input, Select, Textarea } from "../../../components/ui";
import { services } from "../../../services/serviceProvider";
import type { PatientRecord } from "../../../shared/types/domain";
import type { ClinicServiceRow } from "../../../services/interfaces";
import type { BillItem, BillType, PaymentMode, PaymentStatus } from "../types";
import { rupee } from "../utils";
import { BillItemRow } from "./BillItemRow";
import { InvoicePreview } from "./InvoicePreview";

const blank = (): BillItem => ({ id: crypto.randomUUID(), name: "", category: "", quantity: 1, unitPrice: 0, discount: 0, tax: 0 });

export function BillBuilder() {
  const [items, setItems] = useState<BillItem[]>([blank()]);
  const [billType, setBillType] = useState<BillType>("consultation");
  const [paymentMode, setPaymentMode] = useState<PaymentMode>("upi");
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>("paid");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const [patientQuery, setPatientQuery] = useState("");
  const [patientResults, setPatientResults] = useState<PatientRecord[]>([]);
  const [patient, setPatient] = useState<PatientRecord | null>(null);
  const [doctors, setDoctors] = useState<Array<{ id: string; name: string }>>([]);
  const [doctorId, setDoctorId] = useState("");
  const [catalog, setCatalog] = useState<ClinicServiceRow[]>([]);
  const [savedInvoiceId, setSavedInvoiceId] = useState("");

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const [profiles, nextCatalog] = await Promise.all([services.doctor.getDoctorProfiles(), services.catalog.getClinicServices()]);
        const named = await Promise.all(profiles.map(async (profile) => {
          try {
            const staff = await services.users.getStaffUserById(profile.staff_id);
            return { id: profile.id, name: staff.fullName };
          } catch {
            return { id: profile.id, name: profile.specialization || profile.department || "Doctor" };
          }
        }));
        if (!mounted) return;
        setDoctors(named);
        setCatalog(nextCatalog);
      } catch {
        // Optional helpers; the bill can still be built by typing items manually.
      }
    };
    void load();
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    const term = patientQuery.trim();
    if (term.length < 2 || patient) { setPatientResults([]); return; }
    let mounted = true;
    const timer = setTimeout(() => {
      void services.patients.searchPatients(term).then((rows) => { if (mounted) setPatientResults(rows.slice(0, 6)); }).catch(() => undefined);
    }, 300);
    return () => { mounted = false; clearTimeout(timer); };
  }, [patient, patientQuery]);

  const subtotal = items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
  const discount = items.reduce((sum, item) => sum + item.discount, 0);
  const tax = items.reduce((sum, item) => sum + item.tax, 0);
  const total = subtotal - discount + tax;
  const paidAmount = paymentStatus === "paid" ? total : paymentStatus === "partial" ? Math.round(total / 2) : 0;

  const invoice = useMemo(() => ({
    id: savedInvoiceId || "Draft",
    patientName: patient?.fullName ?? "Select a patient",
    phone: patient?.phone ?? "",
    doctorName: doctors.find((doctor) => doctor.id === doctorId)?.name ?? "",
    billType, items, subtotal, discount, tax, total, paidAmount,
    balance: total - paidAmount,
    paymentStatus, paymentMode,
    date: new Date().toLocaleString(),
  }), [billType, discount, doctorId, doctors, items, paidAmount, patient, paymentMode, paymentStatus, savedInvoiceId, subtotal, tax, total]);

  const addCatalogItem = (serviceId: string) => {
    const service = catalog.find((item) => item.id === serviceId);
    if (!service) return;
    setItems((rows) => [...rows.filter((row) => row.name.trim()), { ...blank(), name: service.name, category: service.department ?? "service", unitPrice: service.price, tax: Math.round((service.price * service.tax_rate) / 100) }]);
  };

  const save = async () => {
    const billItems = items.filter((item) => item.name.trim());
    if (!patient) return toast.error("Select a patient for this bill.");
    if (billItems.length === 0) return toast.error("Add at least one bill item.");
    setSaving(true);
    try {
      const context = await services.auth.getCurrentAuthContext();
      const created = await services.billing.createInvoice({
        invoice: {
          clinic_id: context.clinic_id || patient.clinicId,
          branch_id: context.branch_id || patient.branchId || null,
          patient_id: patient.id,
          invoice_type: billType,
          paid_amount: paidAmount,
          payment_mode: paymentMode,
          notes,
          invoice_status: paymentStatus === "cancelled" ? "draft" : "issued",
          metadata: { source: "billing_builder", doctor_id: doctorId || null },
        },
        items: billItems.map((item) => ({
          item_type: billType,
          description: item.name,
          quantity: item.quantity,
          unit_price: item.unitPrice,
          discount_amount: item.discount,
          tax_amount: item.tax,
          tax_rate: 0,
        })),
      });
      setSavedInvoiceId(created.invoice_number);
      toast.success(`Invoice ${created.invoice_number} saved.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to save invoice.");
    } finally {
      setSaving(false);
    }
  };

  const sendReceipt = async () => {
    if (!savedInvoiceId) return toast.error("Save the bill before sending a receipt.");
    if (!patient?.phone) return toast.error("This patient has no phone number on record.");
    try {
      await services.whatsapp.sendInvoicePlaceholder({
        phone: patient.whatsappNumber || patient.phone,
        patientId: patient.id,
        body: `Hello ${patient.fullName}, your bill ${savedInvoiceId} for ${rupee(total)} has been generated. Paid: ${rupee(paidAmount)}.`,
        metadata: { type: "invoice_receipt", invoice_number: savedInvoiceId },
      });
      toast.success("Receipt queued for WhatsApp delivery.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to queue the receipt.");
    }
  };

  return <form onSubmit={(event) => { event.preventDefault(); void save(); }} className="grid gap-4 xl:grid-cols-[1fr_.9fr]">
    <Card className="p-4 md:p-5">
      <h2 className="font-semibold">Create Bill</h2>
      <div className="mt-4 grid gap-4 md:grid-cols-3">
        <div className="relative md:col-span-2">
          <Input
            value={patient ? `${patient.fullName} · ${patient.phone}` : patientQuery}
            onChange={(event) => { setPatient(null); setPatientQuery(event.target.value); }}
            placeholder="Search patient by name or phone"
          />
          {!patient && patientResults.length > 0 && <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-xl border bg-white shadow-card">
            {patientResults.map((row) => <button key={row.id} type="button" onClick={() => { setPatient(row); setPatientResults([]); }} className="block w-full px-4 py-2.5 text-left text-sm hover:bg-slate-50">
              <b>{row.fullName}</b><span className="ml-2 text-slate-500">{row.phone}</span>
            </button>)}
          </div>}
        </div>
        <Select value={doctorId} onChange={(event) => setDoctorId(event.target.value)} aria-label="Doctor">
          <option value="">Doctor (optional)</option>
          {doctors.map((doctor) => <option key={doctor.id} value={doctor.id}>{doctor.name}</option>)}
        </Select>
        <Select value={billType} onChange={(event) => setBillType(event.target.value as BillType)} aria-label="Bill type">
          <option value="consultation">Consultation</option>
          <option value="procedure">Procedure / Service</option>
          <option value="pharmacy">Pharmacy</option>
          <option value="package">Package</option>
          <option value="other">Other</option>
        </Select>
        <Select value={paymentMode} onChange={(event) => setPaymentMode(event.target.value as PaymentMode)} aria-label="Payment mode">
          <option value="cash">Cash</option><option value="upi">UPI</option><option value="card">Card</option><option value="online_link">Online Link</option>
        </Select>
        <Select value={paymentStatus} onChange={(event) => setPaymentStatus(event.target.value as PaymentStatus)} aria-label="Payment status">
          <option value="paid">Paid</option><option value="pending">Pending</option><option value="partial">Partial</option><option value="cancelled">Draft / cancelled</option>
        </Select>
      </div>

      {catalog.length > 0 && <Select className="mt-3" value="" onChange={(event) => addCatalogItem(event.target.value)} aria-label="Add from service catalogue">
        <option value="">Add a service from the clinic catalogue...</option>
        {catalog.map((service) => <option key={service.id} value={service.id}>{service.name} - {rupee(service.price)}</option>)}
      </Select>}

      <div className="mt-4 space-y-3">{items.map((item) => <BillItemRow key={item.id} item={item} onChange={(next) => setItems(items.map((row) => row.id === next.id ? next : row))} onRemove={() => setItems(items.filter((row) => row.id !== item.id))} />)}</div>
      <Button type="button" variant="secondary" className="mt-3" onClick={() => setItems([...items, blank()])}>Add item</Button>
      <Textarea className="mt-4" placeholder="Notes" value={notes} onChange={(event) => setNotes(event.target.value)} />

      <div className="mt-4 rounded-xl bg-slate-50 p-4 text-right">
        <p>Subtotal {rupee(subtotal)} - Discount {rupee(discount)} - Tax {rupee(tax)}</p>
        <p className="text-xl font-semibold">Total {rupee(total)}</p>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button loading={saving} type="submit">Save Bill</Button>
        <Button type="button" variant="secondary" disabled={!savedInvoiceId} onClick={() => void sendReceipt()}>Send receipt to WhatsApp</Button>
        <Button type="button" variant="ghost" onClick={() => window.print()}>Print</Button>
        {savedInvoiceId && <StatusBadge tone="success">Saved as {savedInvoiceId}</StatusBadge>}
      </div>
    </Card>
    <InvoicePreview invoice={invoice} />
  </form>;
}
