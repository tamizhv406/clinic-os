import { supabase } from "../../lib/supabaseClient";
import type { ReportRecord } from "../../shared/types/domain";
import type { Tables } from "../../shared/types/database.types";
import type { DoctorPerformanceReport, RevenueReport } from "../../modules/billing/types";
import type { ReportFilters, ReportingService, ReportSnapshotInput } from "../interfaces";
import { supabaseAuthService } from "./supabaseAuth.service";

type AnyRow = Record<string, unknown>;

// selectRows() takes the table name at runtime, which the generated client cannot
// type, so it uses this view limited to the filters it applies.
type ReportQuery = PromiseLike<{ data: unknown[] | null; error: unknown }> & {
  eq(column: string, value: string): ReportQuery;
  gte(column: string, value: string): ReportQuery;
  lte(column: string, value: string): ReportQuery;
};

const emptyRevenueTrend = (from?: string, to?: string) => {
  const label = from && to ? `${from} - ${to}` : "Current";
  return [{ date: label, revenue: 0 }];
};

async function contextFilters(filters?: ReportFilters): Promise<Required<Pick<ReportFilters, "dateFrom" | "dateTo">> & ReportFilters> {
  const context = await supabaseAuthService.getCurrentAuthContext();
  return {
    clinicId: filters?.clinicId ?? context.clinic_id ?? undefined,
    branchId: filters?.branchId ?? context.branch_id ?? undefined,
    dateFrom: filters?.dateFrom ?? new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10),
    dateTo: filters?.dateTo ?? new Date().toISOString().slice(0, 10),
    doctorId: filters?.doctorId,
    status: filters?.status,
  };
}

async function selectRows<T extends AnyRow>(table: string, filters: ReportFilters, dateColumn = "created_at"): Promise<T[]> {
  const branchTables = new Set(["appointments", "patients", "consultations", "prescriptions", "pharmacy_orders", "low_stock_alerts", "medicine_stock_batches", "invoices", "manual_payment_records", "doctor_profiles", "report_snapshots"]);
  const doctorTables = new Set(["appointments", "consultations", "prescriptions", "pharmacy_orders"]);
  const typedSupabase = supabase as unknown as { from: (name: string) => { select: (columns: string) => ReportQuery } };
  let query = typedSupabase.from(table).select("*");
  if (filters.clinicId) query = query.eq("clinic_id", filters.clinicId);
  if (filters.branchId && branchTables.has(table)) query = query.eq("branch_id", filters.branchId);
  if (filters.doctorId && doctorTables.has(table)) query = query.eq("doctor_id", filters.doctorId);
  if (filters.status) query = query.eq("status", filters.status);
  if (filters.dateFrom) query = query.gte(dateColumn, dateColumn === "appointment_date" ? filters.dateFrom : `${filters.dateFrom}T00:00:00`);
  if (filters.dateTo) query = query.lte(dateColumn, dateColumn === "appointment_date" ? filters.dateTo : `${filters.dateTo}T23:59:59`);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as unknown as T[];
}

const sum = <T,>(rows: T[], pick: (row: T) => number | null | undefined) => rows.reduce((total, row) => total + (pick(row) ?? 0), 0);

function byDate(rows: Tables<"manual_payment_records">[]) {
  const grouped = new Map<string, number>();
  for (const row of rows) {
    const date = row.received_at?.slice(0, 10) ?? row.created_at?.slice(0, 10) ?? "";
    grouped.set(date, (grouped.get(date) ?? 0) + row.amount);
  }
  return Array.from(grouped.entries()).sort(([a], [b]) => a.localeCompare(b)).map(([date, revenue]) => ({ date, revenue }));
}

function sourceCount(rows: Tables<"patients">[]) {
  const grouped = new Map<string, number>();
  for (const row of rows) grouped.set(row.source ?? "reception", (grouped.get(row.source ?? "reception") ?? 0) + 1);
  return Array.from(grouped.entries()).map(([source, count]) => ({ source, count }));
}

export const supabaseReportingService: ReportingService = {
  async getReports(clinicId) {
    const snapshots = await this.getReportSnapshots({ clinicId });
    return snapshots.map((snapshot): ReportRecord => ({
      id: snapshot.id,
      clinicId: snapshot.clinic_id,
      metric: snapshot.report_type,
      value: 0,
      period: `${snapshot.period_start ?? ""} - ${snapshot.period_end ?? ""}`.trim(),
    }));
  },

  async getDashboardSummary(filters) {
    const scoped = await contextFilters(filters);
    const today = new Date().toISOString().slice(0, 10);
    const [patients, appointmentsToday, consultations, prescriptions, pharmacyOrders, lowStock, invoices, payments] = await Promise.all([
      selectRows<Tables<"patients">>("patients", { ...scoped, dateFrom: undefined, dateTo: undefined }),
      selectRows<Tables<"appointments">>("appointments", { ...scoped, dateFrom: today, dateTo: today }, "appointment_date"),
      selectRows<Tables<"consultations">>("consultations", scoped),
      selectRows<Tables<"prescriptions">>("prescriptions", scoped),
      selectRows<Tables<"pharmacy_orders">>("pharmacy_orders", scoped),
      selectRows<Tables<"low_stock_alerts">>("low_stock_alerts", { ...scoped, status: "active", dateFrom: undefined, dateTo: undefined }),
      selectRows<Tables<"invoices">>("invoices", scoped),
      selectRows<Tables<"manual_payment_records">>("manual_payment_records", scoped, "received_at"),
    ]);
    return {
      totalPatients: patients.length,
      todayAppointments: appointmentsToday.length,
      completedConsultations: consultations.filter((item) => item.status === "completed").length,
      pendingPrescriptions: prescriptions.filter((item) => item.status === "draft" || item.delivery_status === "queued").length,
      pharmacyOrders: pharmacyOrders.length,
      lowStockMedicines: lowStock.length,
      totalInvoices: invoices.length,
      paidAmount: sum(invoices, (item) => item.paid_amount),
      pendingAmount: sum(invoices, (item) => item.balance_amount),
      revenueByDateRange: sum(payments, (item) => item.amount),
    };
  },

  async getAppointmentReport(filters) {
    const rows = await selectRows<Tables<"appointments">>("appointments", await contextFilters(filters), "appointment_date");
    return {
      total: rows.length,
      completed: rows.filter((item) => item.status === "completed").length,
      cancelled: rows.filter((item) => item.status === "cancelled").length,
      noShow: rows.filter((item) => item.status === "no_show").length,
      whatsapp: rows.filter((item) => item.source === "whatsapp").length,
      qr: rows.filter((item) => item.source === "qr").length,
      walkIns: rows.filter((item) => item.source === "walk_in").length,
      phone: rows.filter((item) => item.source === "phone").length,
    };
  },

  async getPatientReport(filters) {
    const scoped = await contextFilters(filters);
    const [newPatients, allPatients, appointments, consultations] = await Promise.all([
      selectRows<Tables<"patients">>("patients", scoped),
      selectRows<Tables<"patients">>("patients", { ...scoped, dateFrom: undefined, dateTo: undefined }),
      selectRows<Tables<"appointments">>("appointments", scoped, "appointment_date"),
      selectRows<Tables<"consultations">>("consultations", scoped),
    ]);

    // A patient counts as "repeat" once they have more than one completed visit.
    const visitsPerPatient = new Map<string, number>();
    for (const appointment of appointments) {
      if (appointment.status !== "completed") continue;
      visitsPerPatient.set(appointment.patient_id, (visitsPerPatient.get(appointment.patient_id) ?? 0) + 1);
    }

    return {
      newPatients: newPatients.length,
      repeatPatients: Array.from(visitsPerPatient.values()).filter((count) => count > 1).length,
      vipPatients: allPatients.filter((item) => JSON.stringify(item.metadata ?? {}).toLowerCase().includes("vip")).length,
      followUpPatients: new Set(consultations.filter((item) => item.follow_up_date).map((item) => item.patient_id)).size,
      sourceSplit: sourceCount(newPatients),
    };
  },

  async getConsultationReport(filters) {
    const rows = await selectRows<Tables<"consultations">>("consultations", await contextFilters(filters));
    return { total: rows.length, completed: rows.filter((item) => item.status === "completed").length, draft: rows.filter((item) => item.status === "draft").length, cancelled: rows.filter((item) => item.status === "cancelled").length };
  },

  async getPrescriptionReport(filters) {
    const rows = await selectRows<Tables<"prescriptions">>("prescriptions", await contextFilters(filters));
    return {
      total: rows.length,
      draft: rows.filter((item) => item.status === "draft").length,
      finalized: rows.filter((item) => item.status === "finalized").length,
      sentToPharmacy: rows.filter((item) => item.send_to_pharmacy).length,
      whatsappSent: rows.filter((item) => item.delivery_channel === "whatsapp" && item.delivery_status === "sent").length,
    };
  },

  async getPharmacyReport(filters) {
    const scoped = await contextFilters(filters);
    const [orders, invoiceItems, lowStock] = await Promise.all([
      selectRows<Tables<"pharmacy_orders">>("pharmacy_orders", scoped),
      selectRows<Tables<"invoice_items">>("invoice_items", { ...scoped, dateFrom: undefined, dateTo: undefined }),
      selectRows<Tables<"low_stock_alerts">>("low_stock_alerts", { ...scoped, status: "active", dateFrom: undefined, dateTo: undefined }),
    ]);
    const pharmacyItems = invoiceItems.filter((item) => item.item_type === "pharmacy");
    const top = new Map<string, { amount: number; count: number }>();
    for (const item of pharmacyItems) {
      const current = top.get(item.description) ?? { amount: 0, count: 0 };
      top.set(item.description, { amount: current.amount + (item.line_total ?? 0), count: current.count + 1 });
    }
    return {
      revenue: sum(pharmacyItems, (item) => item.line_total),
      billsGenerated: orders.length,
      topMedicines: Array.from(top.entries()).map(([medicine, value]) => ({ medicine, amount: value.amount })),
      lowStockImpact: lowStock.length,
      expiryLoss: 0,
    };
  },

  async getBillingReport(filters) {
    return this.getRevenueSummary(filters);
  },

  async getRevenueSummary(filters) {
    const scoped = await contextFilters(filters);
    const [payments, invoices, items] = await Promise.all([
      selectRows<Tables<"manual_payment_records">>("manual_payment_records", scoped, "received_at"),
      selectRows<Tables<"invoices">>("invoices", scoped),
      selectRows<Tables<"invoice_items">>("invoice_items", { ...scoped, dateFrom: undefined, dateTo: undefined }),
    ]);
    const totalRevenue = sum(payments, (item) => item.amount);
    const byMode = new Map<string, number>();
    for (const payment of payments) byMode.set(payment.payment_mode, (byMode.get(payment.payment_mode) ?? 0) + payment.amount);
    const top = new Map<string, { revenue: number; count: number }>();
    for (const item of items) {
      const current = top.get(item.description) ?? { revenue: 0, count: 0 };
      top.set(item.description, { revenue: current.revenue + (item.line_total ?? 0), count: current.count + 1 });
    }
    return {
      totalRevenue,
      consultationRevenue: sum(invoices.filter((item) => item.invoice_type === "consultation"), (item) => item.paid_amount),
      pharmacyRevenue: sum(invoices.filter((item) => item.invoice_type === "pharmacy"), (item) => item.paid_amount),
      procedureRevenue: sum(invoices.filter((item) => item.invoice_type === "procedure"), (item) => item.paid_amount),
      pendingAmount: sum(invoices.filter((item) => item.invoice_status !== "cancelled"), (item) => item.balance_amount),
      refundAmount: 0,
      trend: byDate(payments).length > 0 ? byDate(payments) : emptyRevenueTrend(scoped.dateFrom, scoped.dateTo),
      paymentModes: Array.from(byMode.entries()).map(([mode, amount]) => ({ mode: mode as RevenueReport["paymentModes"][number]["mode"], amount })),
      topServices: Array.from(top.entries()).map(([service, value]) => ({ service, revenue: value.revenue, count: value.count })).sort((a, b) => b.revenue - a.revenue).slice(0, 8),
    };
  },

  async getLowStockReport(filters) {
    const scoped = await contextFilters(filters);
    const [alerts, batches] = await Promise.all([
      selectRows<Tables<"low_stock_alerts">>("low_stock_alerts", { ...scoped, status: "active", dateFrom: undefined, dateTo: undefined }),
      selectRows<Tables<"medicine_stock_batches">>("medicine_stock_batches", { ...scoped, dateFrom: undefined, dateTo: undefined }),
    ]);
    return { activeAlerts: alerts.length, outOfStock: batches.filter((item) => (item.quantity_available ?? 0) <= 0).length, lowStock: alerts.length };
  },

  async getDoctorPerformanceReport(filters) {
    const scoped = await contextFilters(filters);
    const [doctors, consultations, prescriptions, invoices, appointments] = await Promise.all([
      selectRows<Tables<"doctor_profiles">>("doctor_profiles", { ...scoped, dateFrom: undefined, dateTo: undefined }),
      selectRows<Tables<"consultations">>("consultations", scoped),
      selectRows<Tables<"prescriptions">>("prescriptions", scoped),
      selectRows<Tables<"invoices">>("invoices", scoped),
      selectRows<Tables<"appointments">>("appointments", scoped, "appointment_date"),
    ]);

    const staffIds = Array.from(new Set(doctors.map((doctor) => doctor.staff_id)));
    const { data: staff } = staffIds.length ? await supabase.from("staff_profiles").select("id,full_name").in("id", staffIds) : { data: [] };
    const staffNames = new Map((staff ?? []).map((item) => [item.id, item.full_name]));

    // Attribute each invoice to a doctor through its consultation or appointment.
    const consultationDoctor = new Map(consultations.map((item) => [item.id, item.doctor_id]));
    const appointmentDoctor = new Map(appointments.map((item) => [item.id, item.doctor_id]));
    const revenueByDoctor = new Map<string, number>();
    for (const invoice of invoices) {
      if (invoice.invoice_status === "cancelled") continue;
      const doctorId =
        (invoice.consultation_id ? consultationDoctor.get(invoice.consultation_id) : null) ??
        (invoice.appointment_id ? appointmentDoctor.get(invoice.appointment_id) : null);
      if (!doctorId) continue;
      revenueByDoctor.set(doctorId, (revenueByDoctor.get(doctorId) ?? 0) + (invoice.paid_amount ?? 0));
    }

    // Average consultation time = time from appointment start to completion.
    const durationByDoctor = new Map<string, { total: number; count: number }>();
    for (const consultation of consultations) {
      if (!consultation.completed_at || !consultation.created_at) continue;
      const minutes = (new Date(consultation.completed_at).getTime() - new Date(consultation.created_at).getTime()) / 60000;
      if (!Number.isFinite(minutes) || minutes < 0) continue;
      const current = durationByDoctor.get(consultation.doctor_id) ?? { total: 0, count: 0 };
      durationByDoctor.set(consultation.doctor_id, { total: current.total + minutes, count: current.count + 1 });
    }

    return doctors.map((doctor): DoctorPerformanceReport => {
      const duration = durationByDoctor.get(doctor.id);
      return {
        doctorName: staffNames.get(doctor.staff_id) ?? doctor.specialization ?? doctor.department ?? "Doctor",
        consultations: consultations.filter((item) => item.doctor_id === doctor.id).length,
        revenue: revenueByDoctor.get(doctor.id) ?? 0,
        averageTime: duration && duration.count > 0 ? `${Math.round(duration.total / duration.count)} min` : "0 min",
        followUps: consultations.filter((item) => item.doctor_id === doctor.id && item.follow_up_date).length,
        prescriptions: prescriptions.filter((item) => item.doctor_id === doctor.id).length,
      };
    });
  },

  async getFollowUpReport(filters) {
    const scoped = await contextFilters(filters);
    const [consultations, appointments, reminders] = await Promise.all([
      selectRows<Tables<"consultations">>("consultations", { ...scoped, dateFrom: undefined, dateTo: undefined }),
      selectRows<Tables<"appointments">>("appointments", { ...scoped, dateFrom: undefined, dateTo: undefined }, "appointment_date"),
      selectRows<Tables<"medicine_reminders">>("medicine_reminders", { ...scoped, dateFrom: undefined, dateTo: undefined }),
    ]);
    const today = new Date().toISOString().slice(0, 10);
    const withFollowUp = consultations.filter((item) => item.follow_up_date);
    // A follow-up counts as done once the patient completed a later appointment.
    const isCompleted = (row: Tables<"consultations">) =>
      appointments.some((appointment) => appointment.patient_id === row.patient_id && appointment.status === "completed" && appointment.appointment_date >= (row.follow_up_date ?? ""));

    return {
      dueToday: withFollowUp.filter((row) => row.follow_up_date === today && !isCompleted(row)).length,
      upcoming: withFollowUp.filter((row) => (row.follow_up_date ?? "") > today && !isCompleted(row)).length,
      overdue: withFollowUp.filter((row) => (row.follow_up_date ?? "") < today && !isCompleted(row)).length,
      completed: withFollowUp.filter(isCompleted).length,
      whatsappReminders: reminders.filter((reminder) => reminder.delivery_status !== "failed" && reminder.status === "active").length,
    };
  },

  async generateReportSnapshot(input: ReportSnapshotInput) {
    const context = await supabaseAuthService.getCurrentAuthContext();
    const payload = { ...input, clinic_id: input.clinic_id || context.clinic_id || "", branch_id: input.branch_id ?? context.branch_id, generated_by: input.generated_by ?? context.staffProfileId };
    const { data, error } = await supabase.from("report_snapshots").insert(payload).select("*").single();
    if (error) throw error;
    return data;
  },

  async getReportSnapshots(filters) {
    const scoped = await contextFilters(filters);
    let query = supabase.from("report_snapshots").select("*").order("generated_at", { ascending: false });
    if (scoped.clinicId) query = query.eq("clinic_id", scoped.clinicId);
    if (scoped.branchId) query = query.eq("branch_id", scoped.branchId);
    if (filters?.reportType) query = query.eq("report_type", filters.reportType);
    if (scoped.dateFrom) query = query.gte("period_start", scoped.dateFrom);
    if (scoped.dateTo) query = query.lte("period_end", scoped.dateTo);
    const { data, error } = await query;
    if (error) throw error;
    return data ?? [];
  },
};
