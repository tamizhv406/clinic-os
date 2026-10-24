import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button, Card, Input, LoadingSkeleton, PageHeader, Select, StatusPill } from "../../components/ui";
import { services } from "../../services/serviceProvider";
import type { ClinicRecord } from "../../shared/types/domain";

type Subscription = { plan: string; billingCycle: string; renewalDate: string; seats: number };
const plans = ["trial", "starter", "growth", "enterprise"];
const defaultSubscription: Subscription = { plan: "trial", billingCycle: "monthly", renewalDate: "", seats: 5 };

function readSubscription(clinic: ClinicRecord): Subscription {
  const raw = clinic.settings.subscription as Partial<Subscription> | undefined;
  return { ...defaultSubscription, ...raw };
}

export default function SuperAdminSubscriptions() {
  const [clinics, setClinics] = useState<ClinicRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      setClinics(await services.clinics.getClinics());
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to load subscriptions.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const save = async (clinic: ClinicRecord, next: Subscription) => {
    setSavingId(clinic.id);
    try {
      await services.clinics.updateClinic(clinic.id, { settings: { ...clinic.settings, subscription: next } });
      setClinics((current) => current.map((item) => item.id === clinic.id ? { ...item, settings: { ...item.settings, subscription: next } } : item));
      toast.success(`Updated ${clinic.name}'s plan.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to update the subscription.");
    } finally {
      setSavingId(null);
    }
  };

  if (loading) return <main className="p-5 md:p-7"><LoadingSkeleton rows={6} /></main>;

  return <><PageHeader title="Subscriptions" description="Plan, billing cycle, and seat limits for each clinic." action={<Button variant="secondary" onClick={() => void load()}>Refresh</Button>} />
    <Card className="mt-5 overflow-hidden">
      <div className="table-wrap"><table className="data-table">
        <thead><tr><th>Clinic</th><th>Plan</th><th>Billing cycle</th><th>Renewal date</th><th>Seats</th><th>Status</th><th /></tr></thead>
        <tbody>{clinics.map((clinic) => {
          const subscription = readSubscription(clinic);
          const update = (patch: Partial<Subscription>) => setClinics((current) => current.map((item) => item.id === clinic.id ? { ...item, settings: { ...item.settings, subscription: { ...subscription, ...patch } } } : item));
          return <tr key={clinic.id}>
            <td className="font-semibold">{clinic.name}</td>
            <td><Select aria-label="Plan" value={subscription.plan} onChange={(event) => update({ plan: event.target.value })}>{plans.map((plan) => <option key={plan} value={plan}>{plan}</option>)}</Select></td>
            <td><Select aria-label="Billing cycle" value={subscription.billingCycle} onChange={(event) => update({ billingCycle: event.target.value })}><option value="monthly">Monthly</option><option value="yearly">Yearly</option></Select></td>
            <td><Input aria-label="Renewal date" type="date" value={subscription.renewalDate} onChange={(event) => update({ renewalDate: event.target.value })} /></td>
            <td><Input aria-label="Seats" type="number" min={1} className="w-20" value={subscription.seats} onChange={(event) => update({ seats: Number(event.target.value) || 1 })} /></td>
            <td><StatusPill status={clinic.status} /></td>
            <td><Button size="sm" loading={savingId === clinic.id} onClick={() => void save(clinic, readSubscription(clinic))}>Save</Button></td>
          </tr>;
        })}</tbody>
      </table></div>
    </Card>
  </>;
}
