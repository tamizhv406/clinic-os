import { services } from "../../services/serviceProvider";
import type { BillingShortcut, PaymentMode, PaymentStatus } from "./types";

/**
 * Reception's "pending billing" list: invoices that still carry a balance,
 * enriched with the patient and the doctor who saw them.
 */
export async function loadPendingBills(): Promise<BillingShortcut[]> {
  const summaries = await services.billing.getInvoices({ paymentStatus: "unpaid" });
  const partial = await services.billing.getInvoices({ paymentStatus: "partial" });
  const details = await Promise.all([...summaries, ...partial].map((invoice) => services.billing.getInvoiceById(invoice.id)));
  const open = details.filter((detail) => detail && detail.invoice_status !== "cancelled" && (detail.balance_amount ?? 0) > 0);
  if (open.length === 0) return [];

  const doctorNames = await loadDoctorNames(open.map((detail) => detail!.consultation_id).filter(Boolean) as string[]);

  return open.map((detail): BillingShortcut => ({
    id: detail!.id,
    patientName: detail!.patient?.full_name ?? "Patient",
    service: detail!.items[0]?.description ?? detail!.invoice_type ?? "Consultation",
    amount: detail!.total_amount ?? 0,
    discount: detail!.discount_amount ?? 0,
    paymentMode: "cash" as PaymentMode,
    paymentStatus: (detail!.payment_status === "partial" ? "partial" : "pending") as PaymentStatus,
    doctorName: (detail!.consultation_id ? doctorNames.get(detail!.consultation_id) : undefined) ?? "",
    completedAt: detail!.created_at?.slice(0, 16).replace("T", " ") ?? "",
  }));
}

async function loadDoctorNames(consultationIds: string[]): Promise<Map<string, string>> {
  if (consultationIds.length === 0) return new Map();
  try {
    const consultations = await Promise.all(consultationIds.map((id) => services.doctor.getConsultationById(id).catch(() => null)));
    const profiles = await services.doctor.getDoctorProfiles();
    const staffNames = new Map(
      await Promise.all(
        profiles.map(async (profile): Promise<[string, string]> => {
          try {
            const staff = await services.users.getStaffUserById(profile.staff_id);
            return [profile.id, staff.fullName];
          } catch {
            return [profile.id, profile.specialization || profile.department || "Doctor"];
          }
        }),
      ),
    );
    return new Map(consultations.filter(Boolean).map((consultation) => [consultation!.id, staffNames.get(consultation!.doctor_id) ?? "Doctor"]));
  } catch {
    return new Map();
  }
}
