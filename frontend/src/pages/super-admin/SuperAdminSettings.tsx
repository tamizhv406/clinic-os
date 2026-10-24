import { StatusBadge } from "../../components/common/StatusBadge";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { moduleKeys } from "../../access-control/modules";
import { permissionKeys } from "../../access-control/permissions";
import { Card, LoadingSkeleton, PageHeader } from "../../components/ui";
import { services } from "../../services/serviceProvider";
import type { ClinicRecord } from "../../shared/types/domain";

export default function SuperAdminSettings() {
  const [clinics, setClinics] = useState<ClinicRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    services.clinics.getClinics()
      .then((rows) => { if (mounted) setClinics(rows); })
      .catch((error) => toast.error(error instanceof Error ? error.message : "Unable to load platform settings."))
      .finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, []);

  if (loading) return <main className="p-5 md:p-7"><LoadingSkeleton rows={6} /></main>;

  const moduleAdoption = moduleKeys.map((module) => ({ module, clinics: clinics.filter((clinic) => clinic.enabledModules.includes(module)).length }));

  return <><PageHeader title="System settings" description="The module and permission catalog every clinic's access is built from." />
    <div className="grid gap-4 xl:grid-cols-2">
      <Card className="overflow-hidden"><div className="p-5"><h2 className="font-semibold">Modules</h2><p className="text-xs text-slate-500">{moduleKeys.length} modules · adoption across {clinics.length} clinics</p></div>
        <div className="table-wrap"><table className="data-table"><thead><tr><th>Module</th><th className="numeric">Clinics using it</th></tr></thead>
          <tbody>{moduleAdoption.map(({ module, clinics: count }) => <tr key={module}><td className="font-semibold capitalize">{module.replaceAll("_", " ")}</td><td className="numeric">{count} / {clinics.length}</td></tr>)}</tbody>
        </table></div>
      </Card>
      <Card className="p-4 md:p-5"><h2 className="font-semibold">Permission actions</h2><p className="text-xs text-slate-500">Combined with a module to form a permission key, e.g. <code>staff.manage</code>.</p>
        <div className="mt-4 flex flex-wrap gap-2">{permissionKeys.map((permission) => <StatusBadge key={permission}>{permission}</StatusBadge>)}</div>
      </Card>
    </div>
    <Card className="mt-5 p-4 md:p-5"><h2 className="font-semibold">Per-clinic module access</h2><p className="text-xs text-slate-500">Adjust a specific clinic's enabled modules from the Platform overview dashboard.</p></Card>
  </>;
}
