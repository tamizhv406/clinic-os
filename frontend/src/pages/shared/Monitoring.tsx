import { StatusBadge } from "../../components/common/StatusBadge";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Activity, AlertTriangle, ShieldAlert, Stethoscope } from "lucide-react";
import { Button, Card, Input, PageHeader, Select, StatsCard } from "../../components/ui";
import { services } from "../../services/serviceProvider";
import { localDateISO } from "../../utils/formatDate";
import type { MonitoringLog, SystemHealthLog } from "../../services/interfaces";

const today = localDateISO();

function tone(value?: string | null): "danger" | "warning" | "success" {
  if (["failed", "error", "critical", "down", "open"].includes(value ?? "")) return "danger";
  if (["warning", "degraded", "recorded"].includes(value ?? "")) return "warning";
  return "success";
}

function LogTable({ title, rows }: { title: string; rows: MonitoringLog[] }) {
  return <Card className="overflow-hidden"><div className="p-5"><h2 className="font-semibold">{title}</h2></div><div className="table-wrap"><table className="data-table"><thead><tr><th>Time</th><th>Event</th><th>Entity</th><th>Status</th><th>Message</th></tr></thead><tbody>{rows.length === 0 ? <tr><td colSpan={5} className="text-slate-500">No rows found.</td></tr> : rows.map((row) => <tr key={row.id}><td>{new Date(row.createdAt).toLocaleString()}</td><td className="font-semibold">{row.eventType}</td><td>{row.entityType ?? "-"}</td><td><StatusBadge tone={tone(row.status ?? row.severity)}>{row.status ?? row.severity ?? "info"}</StatusBadge></td><td>{row.message ?? row.action ?? "-"}</td></tr>)}</tbody></table></div></Card>;
}

export default function Monitoring() {
  const [dateFrom, setDateFrom] = useState(today);
  const [dateTo, setDateTo] = useState(today);
  const [module, setModule] = useState("all");
  const [status, setStatus] = useState("all");
  const [audit, setAudit] = useState<MonitoringLog[]>([]);
  const [errors, setErrors] = useState<MonitoringLog[]>([]);
  const [security, setSecurity] = useState<MonitoringLog[]>([]);
  const [health, setHealth] = useState<SystemHealthLog[]>([]);
  const [loading, setLoading] = useState(false);

  const filters = useMemo(() => ({ dateFrom, dateTo, module, status, limit: 25 }), [dateFrom, dateTo, module, status]);
  const load = async () => {
    setLoading(true);
    try {
      const [auditRows, healthRows, errorRows, securityRows] = await Promise.all([
        services.monitoring.getAuditLogs(filters),
        services.monitoring.getSystemHealth(filters),
        services.monitoring.getErrorLogs(filters),
        services.monitoring.getSecurityEvents(filters),
      ]);
      setAudit(auditRows);
      setHealth(healthRows);
      setErrors(errorRows);
      setSecurity(securityRows);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to load monitoring data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  return <div className="space-y-6"><PageHeader title="Audit & Monitoring" description="Recent audit logs, errors, security events, and lightweight health checks." action={<Button loading={loading} onClick={() => void load()}>Refresh</Button>} /><Card className="p-4"><div className="grid gap-4 lg:grid-cols-4"><Input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} /><Input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} /><Select value={module} onChange={(event) => setModule(event.target.value)}><option value="all">All modules</option><option value="patients">Patients</option><option value="appointments">Appointments</option><option value="consultations">Consultations</option><option value="prescriptions">Prescriptions</option><option value="pharmacy_orders">Pharmacy</option><option value="invoices">Billing</option><option value="whatsapp_messages">WhatsApp</option><option value="auth">Auth</option></Select><Select value={status} onChange={(event) => setStatus(event.target.value)}><option value="all">All statuses</option><option value="success">Success</option><option value="failed">Failed</option><option value="open">Open</option><option value="recorded">Recorded</option><option value="ok">OK</option><option value="degraded">Degraded</option><option value="down">Down</option></Select></div></Card><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><StatsCard label="Audit logs" value={String(audit.length)} detail="Recent actions" icon={Activity} /><StatsCard label="Errors" value={String(errors.length)} detail="App error rows" icon={AlertTriangle} tone={errors.length ? "amber" : "teal"} /><StatsCard label="Security" value={String(security.length)} detail="Security events" icon={ShieldAlert} tone={security.length ? "amber" : "teal"} /><StatsCard label="Health" value={health[0]?.status ?? "unknown"} detail="Latest check" icon={Stethoscope} tone={health[0]?.status === "ok" ? "teal" : "amber"} /></div><div className="grid gap-4 xl:grid-cols-2"><LogTable title="Recent Audit Logs" rows={audit} /><LogTable title="System Health" rows={health} /><LogTable title="App Errors" rows={errors} /><LogTable title="Security Events" rows={security} /></div></div>;
}
