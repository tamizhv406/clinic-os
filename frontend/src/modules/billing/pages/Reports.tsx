import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button, Card, PageHeader } from "../../../components/ui";
import { services } from "../../../services/serviceProvider";
import { AppointmentStatusChart } from "../components/AppointmentStatusChart";
import { DoctorRevenueChart } from "../components/DoctorRevenueChart";
import { ExportActions, type ExportRow } from "../components/ExportActions";
import { ReportFilters, type ReportFilterValue } from "../components/ReportFilters";
import { RevenueChart } from "../components/RevenueChart";
import { TopServicesTable } from "../components/TopServicesTable";
import type { AppointmentReport, DoctorPerformanceReport, FollowUpReport, PatientReport, PharmacySalesReport, RevenueReport } from "../types";
import { rupee } from "../utils";

const tabs = ["Revenue", "Appointments", "Doctor Performance", "Pharmacy Sales", "Patients", "Follow-ups", "Pending Payments"] as const;

const emptyRevenue: RevenueReport = { totalRevenue: 0, consultationRevenue: 0, pharmacyRevenue: 0, procedureRevenue: 0, pendingAmount: 0, refundAmount: 0, trend: [], paymentModes: [], topServices: [] };
const emptyAppointments: AppointmentReport = { total: 0, completed: 0, cancelled: 0, noShow: 0, whatsapp: 0, qr: 0, walkIns: 0, phone: 0 };
const emptyPharmacy: PharmacySalesReport = { revenue: 0, billsGenerated: 0, topMedicines: [], lowStockImpact: 0, expiryLoss: 0 };
const emptyPatients: PatientReport = { newPatients: 0, repeatPatients: 0, vipPatients: 0, followUpPatients: 0, sourceSplit: [] };
const emptyFollowUps: FollowUpReport = { dueToday: 0, upcoming: 0, overdue: 0, completed: 0, whatsappReminders: 0 };

export default function Reports() {
  const [tab, setTab] = useState<(typeof tabs)[number]>("Revenue");
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState<ReportFilterValue>({});
  const [revenue, setRevenue] = useState<RevenueReport>(emptyRevenue);
  const [appt, setAppt] = useState<AppointmentReport>(emptyAppointments);
  const [doctors, setDoctors] = useState<DoctorPerformanceReport[]>([]);
  const [pharmacy, setPharmacy] = useState<PharmacySalesReport>(emptyPharmacy);
  const [patients, setPatients] = useState<PatientReport>(emptyPatients);
  const [followUps, setFollowUps] = useState<FollowUpReport>(emptyFollowUps);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      setLoading(true);
      try {
        const [nextRevenue, nextAppointments, nextDoctors, nextPharmacy, nextPatients, nextFollowUps] = await Promise.all([
          services.reports.getRevenueSummary(range),
          services.reports.getAppointmentReport(range),
          services.reports.getDoctorPerformanceReport(range),
          services.reports.getPharmacyReport(range),
          services.reports.getPatientReport(range),
          services.reports.getFollowUpReport(range),
        ]);
        if (!mounted) return;
        setRevenue(nextRevenue);
        setAppt(nextAppointments);
        setDoctors(nextDoctors);
        setPharmacy(nextPharmacy);
        setPatients(nextPatients);
        setFollowUps(nextFollowUps);
      } catch (error) {
        if (mounted) toast.error(error instanceof Error ? error.message : "Unable to load reports.");
      } finally {
        if (mounted) setLoading(false);
      }
    };
    void load();
    return () => { mounted = false; };
  }, [range]);

  const exportRows = useMemo((): ExportRow[] => {
    switch (tab) {
      case "Revenue":
        return revenue.trend.map((point) => ({ Date: point.date, Revenue: point.revenue }));
      case "Appointments":
        return [{ Total: appt.total, Completed: appt.completed, Cancelled: appt.cancelled, "No show": appt.noShow, WhatsApp: appt.whatsapp, QR: appt.qr, "Walk ins": appt.walkIns, Phone: appt.phone }];
      case "Doctor Performance":
        return doctors.map((doctor) => ({ Doctor: doctor.doctorName, Consultations: doctor.consultations, Revenue: doctor.revenue, "Average time": doctor.averageTime, "Follow ups": doctor.followUps, Prescriptions: doctor.prescriptions }));
      case "Pharmacy Sales":
        return pharmacy.topMedicines.map((medicine) => ({ Medicine: medicine.medicine, Amount: medicine.amount }));
      case "Patients":
        return [{ New: patients.newPatients, Repeat: patients.repeatPatients, VIP: patients.vipPatients, "Follow up": patients.followUpPatients }];
      case "Follow-ups":
        return [{ "Due today": followUps.dueToday, Upcoming: followUps.upcoming, Overdue: followUps.overdue, Completed: followUps.completed, "WhatsApp reminders": followUps.whatsappReminders }];
      default:
        return [{ "Pending amount": revenue.pendingAmount }];
    }
  }, [appt, doctors, followUps, patients, pharmacy, revenue, tab]);

  const followUpLabels: Record<keyof FollowUpReport, string> = { dueToday: "Due today", upcoming: "Upcoming", overdue: "Overdue", completed: "Completed", whatsappReminders: "WhatsApp reminders" };

  return <div className="space-y-6"><PageHeader title="Reports" description={loading ? "Loading clinic reports..." : "Clinic-specific reports for owner decisions."} action={<ExportActions rows={exportRows} filename={`vernex-${tab.toLowerCase().replace(/\s+/g, "-")}`} />} /><ReportFilters onChange={setRange} /><div className="flex flex-wrap gap-2">{tabs.map((t) => <Button key={t} variant={tab === t ? "primary" : "secondary"} onClick={() => setTab(t)}>{t}</Button>)}</div>{tab === "Revenue" && <div className="grid gap-4 xl:grid-cols-[1.2fr_.8fr]"><Card className="p-4 md:p-5"><h2 className="font-semibold">Revenue Report - {rupee(revenue.totalRevenue)}</h2><RevenueChart data={revenue.trend} /></Card><Card className="p-4 md:p-5"><h2 className="font-semibold">Top earning services</h2><TopServicesTable rows={revenue.topServices} /></Card></div>}{tab === "Appointments" && <Card className="p-4 md:p-5"><h2 className="font-semibold">Appointment Report</h2><AppointmentStatusChart data={[{ name: "Completed", value: appt.completed }, { name: "Cancelled", value: appt.cancelled }, { name: "No-show", value: appt.noShow }, { name: "Other", value: appt.total - appt.completed - appt.cancelled - appt.noShow }]} /><p className="text-sm text-slate-500">WhatsApp {appt.whatsapp} - QR {appt.qr} - Walk-ins {appt.walkIns} - Phone {appt.phone}</p></Card>}{tab === "Doctor Performance" && <Card className="p-4 md:p-5"><h2 className="font-semibold">Doctor Performance</h2><DoctorRevenueChart data={doctors} /><TopServicesTable rows={doctors.map((d) => ({ service: `${d.doctorName} - ${d.averageTime} avg - ${d.prescriptions} prescriptions`, revenue: d.revenue, count: d.consultations }))} /></Card>}{tab === "Pharmacy Sales" && <Card className="p-4 md:p-5"><h2 className="font-semibold">Pharmacy Sales - {rupee(pharmacy.revenue)}</h2><TopServicesTable rows={pharmacy.topMedicines.map((m) => ({ service: m.medicine, revenue: m.amount, count: pharmacy.billsGenerated }))} /><p className="mt-3 text-sm text-slate-500">Low-stock alerts: {pharmacy.lowStockImpact} - Expiry loss placeholder: {rupee(pharmacy.expiryLoss)}</p></Card>}{tab === "Patients" && <Card className="p-4 md:p-5"><h2 className="font-semibold">Patient Report</h2><div className="grid gap-4 md:grid-cols-4">{Object.entries({ "New patients": patients.newPatients, "Repeat patients": patients.repeatPatients, "VIP patients": patients.vipPatients, "Follow-up patients": patients.followUpPatients }).map(([k, v]) => <div key={k} className="rounded-xl bg-slate-50 p-4"><b>{v}</b><p className="text-sm text-slate-500">{k}</p></div>)}</div></Card>}{tab === "Follow-ups" && <Card className="p-4 md:p-5"><h2 className="font-semibold">Follow-up Report</h2><div className="grid gap-4 md:grid-cols-5">{(Object.keys(followUpLabels) as Array<keyof FollowUpReport>).map((key) => <div key={key} className="rounded-xl bg-slate-50 p-4"><b>{followUps[key]}</b><p className="text-sm text-slate-500">{followUpLabels[key]}</p></div>)}</div></Card>}{tab === "Pending Payments" && <Card className="p-4 md:p-5"><h2 className="font-semibold">Pending amount</h2><p className="text-3xl font-semibold text-warning-700">{rupee(revenue.pendingAmount)}</p></Card>}</div>;
}
