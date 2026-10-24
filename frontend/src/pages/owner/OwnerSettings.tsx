import { StatusBadge } from "../../components/common/StatusBadge";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button, Card, EmptyState, Input, LoadingSkeleton, PageHeader, Select, StatusPill } from "../../components/ui";
import { services } from "../../services/serviceProvider";
import { formatCurrency } from "../../utils/formatCurrency";
import type { BranchRecord, ModuleKey } from "../../shared/types/domain";
import type { ClinicServiceRow } from "../../services/interfaces";
import type { Tables } from "../../shared/types/database.types";

type ClinicRow = Tables<"clinics">;
type ProfileForm = { name: string; phone: string; whatsapp_number: string; email: string; specialty: string; address: string; clinic_mode: string };

const emptyProfile: ProfileForm = { name: "", phone: "", whatsapp_number: "", email: "", specialty: "", address: "", clinic_mode: "single_speciality" };
const label = (value: string) => value.replaceAll("_", " ").replace(/\b\w/, (character) => character.toUpperCase());

export default function OwnerSettings() {
  const [clinicId, setClinicId] = useState("");
  const [profile, setProfile] = useState<ProfileForm>(emptyProfile);
  const [branches, setBranches] = useState<BranchRecord[]>([]);
  const [modules, setModules] = useState<ModuleKey[]>([]);
  const [clinicServices, setClinicServices] = useState<ClinicServiceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingService, setSavingService] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const context = await services.auth.getCurrentAuthContext();
      if (!context.clinic_id) throw new Error("Your account is not linked to a clinic.");
      const clinic = context.clinic as ClinicRow | null;
      const [branchRows, serviceRows] = await Promise.all([
        services.clinics.getBranches(context.clinic_id),
        services.catalog.getClinicServices(context.clinic_id),
      ]);
      setClinicId(context.clinic_id);
      setProfile({
        name: clinic?.name ?? "",
        phone: clinic?.phone ?? "",
        whatsapp_number: clinic?.whatsapp_number ?? "",
        email: clinic?.email ?? "",
        specialty: clinic?.specialty ?? "",
        address: clinic?.address ?? "",
        clinic_mode: clinic?.clinic_mode ?? "single_speciality",
      });
      setBranches(branchRows);
      setModules(context.enabledModules as ModuleKey[]);
      setClinicServices(serviceRows);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to load clinic settings.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const saveProfile = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSavingProfile(true);
    try {
      // enabledModules is deliberately omitted: writing clinic_modules is super-admin only.
      await services.clinics.updateClinic(clinicId, {
        name: profile.name,
        phone: profile.phone || null,
        whatsapp_number: profile.whatsapp_number || null,
        email: profile.email || null,
        specialty: profile.specialty || null,
        address: profile.address || null,
        clinic_mode: profile.clinic_mode,
      });
      // The cached auth context holds the clinic row the header renders from.
      await services.auth.refreshAuthContext();
      toast.success("Clinic profile updated.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to save the clinic profile.");
    } finally {
      setSavingProfile(false);
    }
  };

  const addService = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(form);
    setSavingService(true);
    try {
      const created = await services.catalog.createClinicService({
        clinic_id: clinicId,
        name: String(values.get("name") ?? ""),
        department: String(values.get("department") ?? "") || null,
        duration_minutes: Number(values.get("duration_minutes") ?? 15),
        price: Number(values.get("price") ?? 0),
        is_bookable: values.get("is_bookable") === "on",
      });
      setClinicServices((current) => [...current, created].sort((a, b) => a.name.localeCompare(b.name)));
      form.reset();
      toast.success(`Added ${created.name}.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to add the service.");
    } finally {
      setSavingService(false);
    }
  };

  const archiveService = async (service: ClinicServiceRow) => {
    setSavingService(true);
    try {
      await services.catalog.updateClinicService(service.id, { status: "inactive" });
      setClinicServices((current) => current.filter((item) => item.id !== service.id));
      toast.success(`Removed ${service.name}.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to remove the service.");
    } finally {
      setSavingService(false);
    }
  };

  const field = (key: keyof ProfileForm) => ({
    value: profile[key],
    onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setProfile((current) => ({ ...current, [key]: event.target.value })),
  });

  const bookableCount = useMemo(() => clinicServices.filter((service) => service.is_bookable).length, [clinicServices]);

  if (loading) return <main className="p-5 md:p-7"><LoadingSkeleton rows={6} /></main>;

  return <><PageHeader title="Settings" description="Clinic profile, bookable services, branches, and the modules on your plan." action={<Button variant="secondary" onClick={() => void load()}>Refresh</Button>} />
    <div className="grid gap-4 xl:grid-cols-[1.1fr_.9fr]">
      <Card className="p-4 md:p-5"><h2 className="font-semibold">Clinic profile</h2><p className="text-xs text-slate-500">Shown on invoices, prescriptions, and the public booking page.</p>
        <form onSubmit={saveProfile} className="mt-4 grid gap-4">
          <Input aria-label="Clinic name" placeholder="Clinic name" required {...field("name")} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Input aria-label="Phone" placeholder="Phone" {...field("phone")} />
            <Input aria-label="WhatsApp number" placeholder="WhatsApp number" {...field("whatsapp_number")} />
          </div>
          <Input aria-label="Email" type="email" placeholder="Email" {...field("email")} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Input aria-label="Specialty" placeholder="Specialty" {...field("specialty")} />
            <Select aria-label="Clinic mode" {...field("clinic_mode")}><option value="single_speciality">Single speciality</option><option value="multi_speciality">Multi speciality</option></Select>
          </div>
          <Input aria-label="Address" placeholder="Address" {...field("address")} />
          <Button type="submit" loading={savingProfile}>Save profile</Button>
        </form>
      </Card>
      <div className="grid gap-4">
        <Card className="p-4 md:p-5"><h2 className="font-semibold">Modules on your plan</h2><p className="text-xs text-slate-500">Enabled by the platform admin. Contact support to change your plan.</p>
          <div className="mt-4 flex flex-wrap gap-2">{modules.length > 0 ? modules.map((module) => <StatusBadge key={module}>{label(module)}</StatusBadge>) : <p className="text-sm text-slate-500">No modules enabled.</p>}</div>
        </Card>
        <Card className="overflow-hidden"><div className="p-5"><h2 className="font-semibold">Branches</h2><p className="text-xs text-slate-500">Branch records are managed by the platform admin.</p></div>
          {branches.length > 0 ? <div className="table-wrap"><table className="data-table"><thead><tr><th>Branch</th><th>Address</th><th>Phone</th></tr></thead><tbody>{branches.map((branch) => <tr key={branch.id}><td className="font-semibold">{branch.name}{branch.isPrimary && <span className="ml-2 text-xs font-semibold text-brand-700">Main</span>}</td><td className="text-slate-500">{branch.address || "-"}</td><td>{branch.phone || "-"}</td></tr>)}</tbody></table></div> : <div className="p-5"><EmptyState title="No branches yet" description="Ask the platform admin to add your branches." /></div>}
        </Card>
      </div>
    </div>
    <Card className="mt-5 overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-4 p-5"><div><h2 className="font-semibold">Services & pricing</h2><p className="text-xs text-slate-500">{clinicServices.length} active · {bookableCount} bookable online</p></div></div>
      <form onSubmit={addService} className="grid gap-4 border-t px-5 py-4 lg:grid-cols-[2fr_1fr_1fr_1fr_auto_auto]">
        <Input name="name" aria-label="Service name" placeholder="Service name" required />
        <Input name="department" aria-label="Department" placeholder="Department" />
        <Input name="duration_minutes" aria-label="Duration in minutes" type="number" min={1} defaultValue={15} required />
        <Input name="price" aria-label="Price" type="number" min={0} step="0.01" defaultValue={0} required />
        <label className="flex items-center gap-2 text-sm font-semibold"><input name="is_bookable" type="checkbox" defaultChecked /> Bookable</label>
        <Button type="submit" loading={savingService}>Add</Button>
      </form>
      {clinicServices.length > 0 ? <div className="table-wrap"><table className="data-table">
        <thead><tr><th>Service</th><th>Department</th><th className="numeric">Duration</th><th className="numeric">Price</th><th>Online booking</th><th>Status</th><th /></tr></thead>
        <tbody>{clinicServices.map((service) => <tr key={service.id}>
          <td className="font-semibold">{service.name}</td>
          <td className="text-slate-500">{service.department || "-"}</td>
          <td className="numeric">{service.duration_minutes} min</td>
          <td className="numeric font-semibold">{formatCurrency(service.price)}</td>
          <td>{service.is_bookable ? "Yes" : "No"}</td>
          <td><StatusPill status={service.status} /></td>
          <td><Button size="sm" variant="secondary" disabled={savingService} onClick={() => void archiveService(service)}>Remove</Button></td>
        </tr>)}</tbody>
      </table></div> : <div className="p-5"><EmptyState title="No services yet" description="Add the consultations and procedures your clinic offers, with their prices." /></div>}
    </Card>
  </>;
}
