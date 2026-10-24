import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { CalendarCheck, CircleDollarSign, Clock3, Pill, UserPlus, Users, WalletCards, Waypoints } from "lucide-react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { toast } from "sonner";
import { StatsCard } from "../../components/common/StatsCard";
import { PageHeader } from "../../components/common/PageHeader";
import { Card } from "../../components/common/Card";
import { StatusPill } from "../../components/common/StatusPill";
import { EmptyState } from "../../components/common/EmptyState";
import { LoadingSkeleton } from "../../components/common/LoadingSkeleton";
import { services } from "../../services/serviceProvider";
import { formatCurrency } from "../../utils/formatCurrency";
import type { AppointmentReport, DoctorPerformanceReport, FollowUpReport, PatientReport, RevenueReport } from "../../modules/billing/types";
import type { DashboardSummary } from "../../services/interfaces";
import type { Medicine } from "../../modules/pharmacy/types";
import { toMedicineRows } from "../../modules/pharmacy/supabaseMappers";
import { chartTheme, chartStatusColors } from "../../utils/chartTheme";

type AppointmentRow = { id: string; patientName: string; doctorName: string; time: string; status: string };
type PaymentRow = { id: string; patientName: string; mode: string; amount: number };

export default function OwnerDashboard() {
  const [loading, setLoading] = useState(true);
  const [clinicName, setClinicName] = useState("");
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [revenue, setRevenue] = useState<RevenueReport | null>(null);
  const [appointmentReport, setAppointmentReport] = useState<AppointmentReport | null>(null);
  const [patientReport, setPatientReport] = useState<PatientReport | null>(null);
  const [followUpReport, setFollowUpReport] = useState<FollowUpReport | null>(null);
  const [doctorRevenue, setDoctorRevenue] = useState<DoctorPerformanceReport[]>([]);
  const [appointments, setAppointments] = useState<AppointmentRow[]>([]);
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [lowStock, setLowStock] = useState<Medicine[]>([]);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      setLoading(true);
      try {
        const context = await services.auth.getCurrentAuthContext();
        const [
          nextSummary,
          nextRevenue,
          nextAppointmentReport,
          nextPatientReport,
          nextFollowUps,
          nextDoctorRevenue,
          todayAppointments,
          medicines,
          batches,
        ] = await Promise.all([
          services.reports.getDashboardSummary(),
          services.reports.getRevenueSummary(),
          services.reports.getAppointmentReport(),
          services.reports.getPatientReport(),
          services.reports.getFollowUpReport(),
          services.reports.getDoctorPerformanceReport(),
          services.appointments.getTodayAppointments(),
          services.pharmacy.getMedicines({ status: "active" }),
          services.pharmacy.getStockBatches(),
        ]);

        const [doctorRows, paymentRows] = await Promise.all([
          services.doctor.getDoctorProfiles(),
          services.billing.getManualPayments(),
        ]);

        // One lookup per entity type rather than one per row -- this loop used to be
        // the bulk of the dashboard's request count.
        const [patientNames, staffNames] = await Promise.all([
          services.patients.getPatientNames([
            ...todayAppointments.map((appointment) => appointment.patientId),
            ...paymentRows.slice(0, 6).map((payment) => payment.patient_id),
          ]),
          services.users.getStaffNames(doctorRows.map((doctor) => doctor.staff_id)),
        ]);

        const doctorNames = new Map(
          doctorRows.map((doctor): [string, string] => [
            doctor.id,
            staffNames.get(doctor.staff_id) ?? (doctor.specialization || doctor.department || "Doctor"),
          ]),
        );

        if (!mounted) return;
        setClinicName((context.clinic as { name?: string } | null)?.name ?? "your clinic");
        setSummary(nextSummary);
        setRevenue(nextRevenue);
        setAppointmentReport(nextAppointmentReport);
        setPatientReport(nextPatientReport);
        setFollowUpReport(nextFollowUps);
        setDoctorRevenue(nextDoctorRevenue.filter((doctor) => doctor.revenue > 0 || doctor.consultations > 0).slice(0, 6));
        setAppointments(
          todayAppointments.slice(0, 6).map((appointment) => ({
            id: appointment.id,
            patientName: patientNames.get(appointment.patientId) ?? "Patient",
            doctorName: doctorNames.get(appointment.doctorId) ?? "Unassigned",
            time: appointment.time || "-",
            status: appointment.status,
          })),
        );
        setPayments(
          paymentRows.slice(0, 6).map((payment) => ({
            id: payment.id.slice(0, 8).toUpperCase(),
            patientName: patientNames.get(payment.patient_id) ?? "Patient",
            mode: payment.payment_mode,
            amount: payment.amount,
          })),
        );
        setLowStock(toMedicineRows(medicines as never, batches).filter((medicine) => medicine.stockStatus === "low_stock" || medicine.stockStatus === "out_of_stock").slice(0, 5));
      } catch (error) {
        if (mounted) toast.error(error instanceof Error ? error.message : "Unable to load the owner dashboard.");
      } finally {
        if (mounted) setLoading(false);
      }
    };
    void load();
    return () => { mounted = false; };
  }, []);

  const appointmentMix = useMemo(() => {
    if (!appointmentReport) return [];
    const other = appointmentReport.total - appointmentReport.completed - appointmentReport.cancelled - appointmentReport.noShow;
    return [
      { name: "Completed", value: appointmentReport.completed },
      { name: "Booked", value: Math.max(other, 0) },
      { name: "Cancelled", value: appointmentReport.cancelled },
      { name: "No show", value: appointmentReport.noShow },
    ].filter((slice) => slice.value > 0);
  }, [appointmentReport]);

  const stats = useMemo(() => {
    const waiting = appointments.filter((appointment) => ["waiting", "arrived"].includes(appointment.status)).length;
    return [
      ["Revenue this month", formatCurrency(summary?.revenueByDateRange ?? 0), `${summary?.totalInvoices ?? 0} invoices this period`, CircleDollarSign, "teal"],
      ["Appointments today", String(summary?.todayAppointments ?? 0), `${appointmentReport?.completed ?? 0} completed this month`, CalendarCheck, "blue"],
      ["Waiting Patients", String(waiting), "In today's queue", Clock3, "amber"],
      ["New Patients", String(patientReport?.newPatients ?? 0), `${patientReport?.sourceSplit.length ?? 0} sources`, UserPlus, "violet"],
      ["Repeat Patients", String(patientReport?.repeatPatients ?? 0), `${summary?.totalPatients ?? 0} total patients`, Users, "teal"],
      ["Pharmacy Sales", formatCurrency(revenue?.pharmacyRevenue ?? 0), `${summary?.pharmacyOrders ?? 0} orders`, Pill, "blue"],
      ["Pending Payments", formatCurrency(summary?.pendingAmount ?? 0), "Awaiting collection", WalletCards, "amber"],
      ["Follow-ups Due", String((followUpReport?.dueToday ?? 0) + (followUpReport?.overdue ?? 0)), `${followUpReport?.overdue ?? 0} overdue`, Waypoints, "violet"],
    ] as const;
  }, [appointmentReport, appointments, followUpReport, patientReport, revenue, summary]);

  if (loading) return <main className="p-5 md:p-7"><LoadingSkeleton rows={6} /></main>;

  const today = new Date().toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });

  return <><PageHeader title="Clinic overview" description={`Hereâ€™s how ${clinicName} is doing today.`} action={<span className="rounded-xl border bg-white px-4 py-2 text-sm font-semibold text-slate-700">{today}</span>} />
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{stats.map(([label, value, detail, icon, tone]) => <StatsCard key={label} label={label} value={value} detail={detail} icon={icon} tone={tone} />)}</div>
    <div className="mt-6 grid gap-4 xl:grid-cols-[1.55fr_1fr]">
      <Card className="p-4 md:p-5"><div className="mb-5 flex items-center justify-between"><div><h2 className="font-semibold">Revenue trend</h2><p className="text-xs text-slate-500">Collections recorded this period</p></div><span className="text-sm font-semibold text-success-700">{formatCurrency(revenue?.totalRevenue ?? 0)}</span></div>
        {revenue && revenue.trend.length > 0 ? <div className="h-72"><ResponsiveContainer width="100%" height="100%"><AreaChart data={revenue.trend}><defs><linearGradient id="rev" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={chartTheme.teal} stopOpacity={.25}/><stop offset="95%" stopColor={chartTheme.teal} stopOpacity={0}/></linearGradient></defs><CartesianGrid strokeDasharray="3 3" vertical={false} stroke={chartTheme.grid} /><XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fontSize:12}} /><YAxis axisLine={false} tickLine={false} tick={{fontSize:11}} tickFormatter={(v) => `${Number(v)/1000}k`} /><Tooltip formatter={(v) => formatCurrency(Number(v))} /><Area type="monotone" dataKey="revenue" stroke={chartTheme.teal} strokeWidth={2.5} fill="url(#rev)" /></AreaChart></ResponsiveContainer></div> : <EmptyState title="No collections yet" description="Recorded payments will appear here." />}
      </Card>
      <Card className="p-4 md:p-5"><h2 className="font-semibold">Appointment status</h2><p className="text-xs text-slate-500">Appointment mix for this period</p>
        {appointmentMix.length > 0 ? <><div className="h-52"><ResponsiveContainer><PieChart><Pie data={appointmentMix} dataKey="value" innerRadius={55} outerRadius={80} paddingAngle={3}>{appointmentMix.map((slice) => <Cell key={slice.name} fill={chartStatusColors[slice.name] ?? chartTheme.neutral} />)}</Pie><Tooltip /></PieChart></ResponsiveContainer></div><div className="grid grid-cols-2 gap-4">{appointmentMix.map((slice) => <div className="flex items-center justify-between text-xs" key={slice.name}><span className="flex items-center gap-2 text-slate-500"><i className="size-2 rounded-full" style={{background: chartStatusColors[slice.name] ?? chartTheme.neutral}} />{slice.name}</span><b>{slice.value}</b></div>)}</div></> : <EmptyState title="No appointments yet" description="Booked appointments will appear here." />}
      </Card>
    </div>
    <div className="mt-5 grid gap-4 xl:grid-cols-2">
      <Card className="overflow-hidden"><div className="flex items-center justify-between p-5"><div><h2 className="font-semibold">Todayâ€™s appointments</h2><p className="text-xs text-slate-500">Next patients across all doctors</p></div><Link className="text-sm font-semibold text-brand-700" to="/reception/appointments">View all</Link></div>
        {appointments.length > 0 ? <div className="table-wrap"><table className="data-table"><thead><tr><th>Patient</th><th>Doctor</th><th>Time</th><th>Status</th></tr></thead><tbody>{appointments.map((appointment) => <tr key={appointment.id}><td className="font-semibold">{appointment.patientName}</td><td className="text-slate-500">{appointment.doctorName}</td><td>{appointment.time}</td><td><StatusPill status={appointment.status} /></td></tr>)}</tbody></table></div> : <div className="p-5"><EmptyState title="No appointments today" description="New bookings will show up here." /></div>}
      </Card>
      <Card className="p-4 md:p-5"><h2 className="font-semibold">Doctor-wise revenue</h2><p className="text-xs text-slate-500">Collections attributed to each doctor</p>
        {doctorRevenue.length > 0 ? <div className="mt-4 h-64"><ResponsiveContainer><BarChart data={doctorRevenue} layout="vertical" margin={{left:10}}><CartesianGrid horizontal={false} stroke={chartTheme.grid} /><XAxis type="number" hide /><YAxis dataKey="doctorName" type="category" width={90} axisLine={false} tickLine={false} tick={{fontSize:11}} /><Tooltip formatter={(v) => formatCurrency(Number(v))}/><Bar dataKey="revenue" fill={chartTheme.teal} radius={[0,8,8,0]} barSize={22}/></BarChart></ResponsiveContainer></div> : <EmptyState title="No doctor revenue yet" description="Paid invoices linked to consultations will appear here." />}
      </Card>
      <Card className="overflow-hidden"><div className="p-5"><h2 className="font-semibold">Recent payments</h2><p className="text-xs text-slate-500">Latest clinic collections</p></div>
        {payments.length > 0 ? <div className="table-wrap"><table className="data-table"><thead><tr><th>Reference</th><th>Patient</th><th>Mode</th><th className="numeric">Amount</th></tr></thead><tbody>{payments.map((payment) => <tr key={payment.id}><td className="text-slate-500">{payment.id}</td><td className="font-semibold">{payment.patientName}</td><td className="uppercase">{payment.mode}</td><td className="numeric font-semibold">{formatCurrency(payment.amount)}</td></tr>)}</tbody></table></div> : <div className="p-5"><EmptyState title="No payments recorded" description="Collected payments will appear here." /></div>}
      </Card>
      <Card className="overflow-hidden"><div className="p-5"><h2 className="font-semibold">Low stock medicines</h2><p className="text-xs text-slate-500">Items at or below reorder level</p></div>
        {lowStock.length > 0 ? lowStock.map((medicine) => <div key={medicine.id} className="flex items-center justify-between border-t px-5 py-4"><div><p className="text-sm font-semibold">{medicine.name}</p><p className="text-xs text-slate-500">{medicine.category}{medicine.expiryDate ? ` Â· Exp. ${medicine.expiryDate}` : ""}</p></div><div className="text-right"><p className="text-sm font-semibold text-danger-700">{medicine.currentStock} left</p><p className="text-xs text-slate-400">Min {medicine.reorderLevel}</p></div></div>) : <div className="p-5"><EmptyState title="Stock levels are healthy" description="Medicines below their reorder level will appear here." /></div>}
      </Card>
    </div>
  </>;
}


