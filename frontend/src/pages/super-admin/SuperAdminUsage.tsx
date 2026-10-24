import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Building2, CalendarDays, Layers, Users } from "lucide-react";
import { Card, LoadingSkeleton, PageHeader, StatsCard, StatusPill } from "../../components/ui";
import { services } from "../../services/serviceProvider";
import type { ClinicRecord } from "../../shared/types/domain";

type ClinicUsage = { clinic: ClinicRecord; staffCount: number; patientCount: number; appointmentCount: number };

export default function SuperAdminUsage() {
  const [rows, setRows] = useState<ClinicUsage[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const clinics = await services.clinics.getClinics();
        const usage = await Promise.all(clinics.map(async (clinic): Promise<ClinicUsage> => {
          const [staff, patients, appointments] = await Promise.all([
            services.users.getStaffUsers(clinic.id),
            services.patients.getPatients({ clinicId: clinic.id }),
            services.appointments.getAppointments({ clinicId: clinic.id }),
          ]);
          return { clinic, staffCount: staff.length, patientCount: patients.length, appointmentCount: appointments.length };
        }));
        if (mounted) setRows(usage);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Unable to load platform usage.");
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  if (loading) return <main className="p-5 md:p-7"><LoadingSkeleton rows={6} /></main>;

  const totals = rows.reduce((acc, row) => ({ staff: acc.staff + row.staffCount, patients: acc.patients + row.patientCount, appointments: acc.appointments + row.appointmentCount }), { staff: 0, patients: 0, appointments: 0 });

  return <><PageHeader title="Usage" description="Live activity across every clinic on the platform." />
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <StatsCard label="Clinics" value={String(rows.length)} detail="On the platform" icon={Building2} />
      <StatsCard label="Staff profiles" value={String(totals.staff)} detail="Across all clinics" icon={Users} tone="blue" />
      <StatsCard label="Patients" value={String(totals.patients)} detail="Registered records" icon={Layers} tone="violet" />
      <StatsCard label="Appointments" value={String(totals.appointments)} detail="All time" icon={CalendarDays} tone="amber" />
    </div>
    <Card className="mt-5 overflow-hidden">
      <div className="p-5"><h2 className="font-semibold">Usage by clinic</h2><p className="text-xs text-slate-500">Staff, patients, and appointments per clinic</p></div>
      <div className="table-wrap"><table className="data-table">
        <thead><tr><th>Clinic</th><th>Status</th><th className="numeric">Modules</th><th className="numeric">Staff</th><th className="numeric">Patients</th><th className="numeric">Appointments</th></tr></thead>
        <tbody>{rows.map(({ clinic, staffCount, patientCount, appointmentCount }) => <tr key={clinic.id}>
          <td className="font-semibold">{clinic.name}</td>
          <td><StatusPill status={clinic.status} /></td>
          <td className="numeric">{clinic.enabledModules.length}</td>
          <td className="numeric">{staffCount}</td>
          <td className="numeric">{patientCount}</td>
          <td className="numeric">{appointmentCount}</td>
        </tr>)}</tbody>
      </table></div>
    </Card>
  </>;
}
