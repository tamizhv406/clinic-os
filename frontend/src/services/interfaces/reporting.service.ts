import type { ReportRecord } from "../../shared/types/domain";
import type { Tables, TablesInsert } from "../../shared/types/database.types";
import type { AppointmentReport, DoctorPerformanceReport, FollowUpReport, PatientReport, PharmacySalesReport, RevenueReport } from "../../modules/billing/types";

export type ReportFilters = {
  clinicId?: string;
  branchId?: string;
  dateFrom?: string;
  dateTo?: string;
  doctorId?: string;
  status?: string;
};

export type DashboardSummary = {
  totalPatients: number;
  todayAppointments: number;
  completedConsultations: number;
  pendingPrescriptions: number;
  pharmacyOrders: number;
  lowStockMedicines: number;
  totalInvoices: number;
  paidAmount: number;
  pendingAmount: number;
  revenueByDateRange: number;
};

export type ConsultationReport = {
  total: number;
  completed: number;
  draft: number;
  cancelled: number;
};

export type PrescriptionReport = {
  total: number;
  draft: number;
  finalized: number;
  sentToPharmacy: number;
  whatsappSent: number;
};

export type LowStockReport = {
  activeAlerts: number;
  outOfStock: number;
  lowStock: number;
};

export type ReportSnapshotInput = Omit<TablesInsert<"report_snapshots">, "generated_by"> & { generated_by?: string };

export interface ReportingService {
  getReports(clinicId?: string): Promise<ReportRecord[]>;
  getDashboardSummary(filters?: ReportFilters): Promise<DashboardSummary>;
  getAppointmentReport(filters?: ReportFilters): Promise<AppointmentReport>;
  getPatientReport(filters?: ReportFilters): Promise<PatientReport>;
  getConsultationReport(filters?: ReportFilters): Promise<ConsultationReport>;
  getPrescriptionReport(filters?: ReportFilters): Promise<PrescriptionReport>;
  getPharmacyReport(filters?: ReportFilters): Promise<PharmacySalesReport>;
  getBillingReport(filters?: ReportFilters): Promise<RevenueReport>;
  getRevenueSummary(filters?: ReportFilters): Promise<RevenueReport>;
  getLowStockReport(filters?: ReportFilters): Promise<LowStockReport>;
  getDoctorPerformanceReport(filters?: ReportFilters): Promise<DoctorPerformanceReport[]>;
  getFollowUpReport(filters?: ReportFilters): Promise<FollowUpReport>;
  generateReportSnapshot(input: ReportSnapshotInput): Promise<Tables<"report_snapshots">>;
  getReportSnapshots(filters?: ReportFilters & { reportType?: string }): Promise<Tables<"report_snapshots">[]>;
}
