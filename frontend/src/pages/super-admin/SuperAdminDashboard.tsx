import { useEffect, useMemo, useState } from "react";
import { Building2, CircleOff, FlaskConical, Users } from "lucide-react";
import { moduleKeys } from "../../access-control/modules";
import { permissionKeys } from "../../access-control/permissions";
import { Button, Card, Input, PageHeader, Select, StatsCard, StatusPill } from "../../components/ui";
import { services } from "../../services/serviceProvider";
import type { BranchRecord, ClinicRecord, ModuleKey, UserRecord } from "../../shared/types/domain";
import type { UserRole } from "../../types/user";

const roles: UserRole[] = ["owner", "admin", "receptionist", "doctor", "pharmacist", "super_admin"];

export default function SuperAdminDashboard() {
  const [clinics, setClinics] = useState<ClinicRecord[]>([]);
  const [branches, setBranches] = useState<BranchRecord[]>([]);
  const [staff, setStaff] = useState<UserRecord[]>([]);
  const [selectedClinicId, setSelectedClinicId] = useState("");
  const [selectedModules, setSelectedModules] = useState<ModuleKey[]>(["dashboard", "staff", "settings"]);
  const [selectedActions, setSelectedActions] = useState<string[]>(["view"]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const selectedClinic = clinics.find((clinic) => clinic.id === selectedClinicId) ?? clinics[0];
  const selectedClinicBranches = branches.filter((branch) => branch.clinicId === selectedClinic?.id);
  const activeCount = clinics.filter((clinic) => clinic.status === "active").length;
  const trialCount = clinics.filter((clinic) => clinic.status === "trial").length;
  const suspendedCount = clinics.filter((clinic) => clinic.status === "suspended" || clinic.status === "expired").length;
  const permissionOptions = useMemo(() => selectedModules.flatMap((module) => selectedActions.map((action) => `${module}.${action}`)), [selectedModules, selectedActions]);

  const loadAdminData = async () => {
    setLoading(true);
    try {
      const nextClinics = await services.clinics.getClinics();
      const nextBranches = (await Promise.all(nextClinics.map((clinic) => services.clinics.getBranches(clinic.id)))).flat();
      const nextStaff = await services.users.getStaffUsers();
      setClinics(nextClinics);
      setBranches(nextBranches);
      setStaff(nextStaff);
      setSelectedClinicId((current) => current || nextClinics[0]?.id || "");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to load admin data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void loadAdminData(); }, []);

  const toggleModule = (module: ModuleKey) => setSelectedModules((current) => current.includes(module) ? current.filter((item) => item !== module) : [...current, module]);
  const toggleAction = (action: string) => setSelectedActions((current) => current.includes(action) ? current.filter((item) => item !== action) : [...current, action]);
  const selectClinic = (clinic: ClinicRecord) => {
    setSelectedClinicId(clinic.id);
    setSelectedModules(clinic.enabledModules);
  };

  const createClinic = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setSaving(true); setMessage("");
    const form = new FormData(event.currentTarget);
    try {
      const clinic = await services.clinics.createClinic({
        name: String(form.get("name") ?? ""),
        slug: String(form.get("slug") ?? ""),
        clinic_mode: String(form.get("clinic_mode") ?? "single_speciality") as never,
        specialty: String(form.get("specialty") ?? ""),
        phone: String(form.get("phone") ?? ""),
        email: String(form.get("email") ?? ""),
        address: String(form.get("address") ?? ""),
        status: "trial",
        enabledModules: selectedModules,
      });
      setMessage(`Created clinic ${clinic.name}.`);
      event.currentTarget.reset();
      await loadAdminData();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to create clinic.");
    } finally {
      setSaving(false);
    }
  };

  const createBranch = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault(); if (!selectedClinic) return; setSaving(true); setMessage("");
    const form = new FormData(event.currentTarget);
    try {
      await services.clinics.createBranch({
        clinic_id: selectedClinic.id,
        name: String(form.get("name") ?? ""),
        address: String(form.get("address") ?? ""),
        phone: String(form.get("phone") ?? ""),
        is_main: form.get("is_main") === "on",
        status: "active",
      });
      setMessage("Branch created.");
      event.currentTarget.reset();
      await loadAdminData();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to create branch.");
    } finally {
      setSaving(false);
    }
  };

  const createStaff = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setSaving(true); setMessage("");
    const form = new FormData(event.currentTarget);
    const role = String(form.get("role_key") ?? "owner") as UserRole;
    try {
      const profile = await services.users.createStaffProfile({
        id: String(form.get("auth_user_id") ?? ""),
        clinic_id: role === "super_admin" ? null : String(form.get("clinic_id") ?? selectedClinic?.id ?? ""),
        branch_id: role === "super_admin" ? null : String(form.get("branch_id") ?? "") || null,
        role_key: role,
        full_name: String(form.get("full_name") ?? ""),
        user_id: String(form.get("user_id") ?? ""),
        email: String(form.get("email") ?? ""),
        phone: String(form.get("phone") ?? ""),
        status: "active",
      });
      await services.users.assignStaffModules(profile.id, selectedModules);
      await services.users.assignStaffPermissions(profile.id, permissionOptions);
      setMessage(`Created staff profile ${profile.fullName}.`);
      event.currentTarget.reset();
      await loadAdminData();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to create staff profile.");
    } finally {
      setSaving(false);
    }
  };

  const setClinicStatus = async (clinicId: string, status: string) => {
    setSaving(true); setMessage("");
    try {
      await services.clinics.updateClinicStatus(clinicId, status);
      await loadAdminData();
      setMessage("Clinic status updated.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to update clinic.");
    } finally {
      setSaving(false);
    }
  };

  const saveSelectedClinicModules = async () => {
    if (!selectedClinic) return;
    setSaving(true); setMessage("");
    try {
      await services.clinics.updateClinic(selectedClinic.id, {
        name: selectedClinic.name,
        slug: selectedClinic.slug,
        status: selectedClinic.status,
        enabledModules: selectedModules,
      });
      await loadAdminData();
      setMessage("Clinic modules updated.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to update clinic modules.");
    } finally {
      setSaving(false);
    }
  };

  const saveStaffAccess = async (staffId: string) => {
    setSaving(true); setMessage("");
    try {
      await services.users.assignStaffModules(staffId, selectedModules);
      await services.users.assignStaffPermissions(staffId, permissionOptions);
      await loadAdminData();
      setMessage("Staff access updated.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to update staff access.");
    } finally {
      setSaving(false);
    }
  };

  const setStaffStatus = async (staffId: string, status: string) => {
    setSaving(true); setMessage("");
    try {
      await services.users.updateStaffStatus(staffId, status);
      await loadAdminData();
      setMessage("Staff status updated.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to update staff.");
    } finally {
      setSaving(false);
    }
  };

  return <><PageHeader title="Platform overview" description="Manage clinics, branches, staff profiles, and access."/>
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5"><StatsCard label="Total clinics" value={loading ? "..." : String(clinics.length)} detail="Clinic records" icon={Building2}/><StatsCard label="Active clinics" value={String(activeCount)} detail="RLS scoped" icon={Building2} tone="blue"/><StatsCard label="Trial clinics" value={String(trialCount)} detail="Onboarding" icon={FlaskConical} tone="amber"/><StatsCard label="Suspended/expired" value={String(suspendedCount)} detail="Needs admin action" icon={CircleOff} tone="violet"/><StatsCard label="Staff profiles" value={String(staff.length)} detail="Auth-linked records" icon={Users}/></div>
    {message && <div className="mt-4 rounded-xl bg-brand-50 p-3 text-sm font-semibold text-brand-700">{message}</div>}
    <div className="mt-5 grid gap-4 xl:grid-cols-[1.1fr_.9fr]">
      <Card className="overflow-hidden"><div className="p-5"><h2 className="font-semibold">Clinics</h2><p className="text-xs text-slate-500">Clinic records</p></div><div className="table-wrap"><table className="data-table"><thead><tr><th>Clinic</th><th>Slug</th><th className="numeric">Modules</th><th>Status</th><th>Action</th></tr></thead><tbody>{clinics.map((clinic) => <tr key={clinic.id} onClick={() => selectClinic(clinic)} className="cursor-pointer"><td className="font-semibold">{clinic.name}</td><td>{clinic.slug}</td><td className="numeric">{clinic.enabledModules.length}</td><td><StatusPill status={clinic.status}/></td><td><Button size="sm" variant="secondary" disabled={saving} onClick={(event) => { event.stopPropagation(); void setClinicStatus(clinic.id, clinic.status === "active" ? "suspended" : "active"); }}>{clinic.status === "active" ? "Suspend" : "Activate"}</Button></td></tr>)}</tbody></table></div></Card>
      <Card className="p-4 md:p-5"><h2 className="font-semibold">Create clinic</h2><form onSubmit={createClinic} className="mt-4 grid gap-4"><Input name="name" placeholder="Clinic name" required/><Input name="slug" placeholder="clinic-slug" required/><Select name="clinic_mode" defaultValue="single_speciality"><option value="single_speciality">Single speciality</option><option value="multi_speciality">Multi speciality</option></Select><Input name="specialty" placeholder="Specialty"/><Input name="phone" placeholder="Phone"/><Input name="email" placeholder="Email"/><Input name="address" placeholder="Address"/><Button type="submit" loading={saving}>Create clinic</Button></form></Card>
    </div>
    <div className="mt-5 grid gap-4 xl:grid-cols-2">
      <Card className="p-4 md:p-5"><h2 className="font-semibold">Enabled modules</h2><div className="mt-4 grid gap-2 sm:grid-cols-2">{moduleKeys.map((module) => <label key={module} className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" checked={selectedModules.includes(module)} onChange={() => toggleModule(module)}/>{module}</label>)}</div><Button className="mt-4" variant="secondary" loading={saving} disabled={!selectedClinic} onClick={() => void saveSelectedClinicModules()}>Save to selected clinic</Button></Card>
      <Card className="p-4 md:p-5"><h2 className="font-semibold">Permission actions</h2><div className="mt-4 grid gap-2 sm:grid-cols-2">{permissionKeys.map((permission) => <label key={permission} className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" checked={selectedActions.includes(permission)} onChange={() => toggleAction(permission)}/>{permission}</label>)}</div><p className="mt-3 text-xs text-slate-500">{permissionOptions.length} permission keys will be assigned to new staff.</p></Card>
    </div>
    <div className="mt-5 grid gap-4 xl:grid-cols-2">
      <Card className="p-4 md:p-5"><h2 className="font-semibold">Branch management</h2><Select className="mt-4" value={selectedClinic?.id ?? ""} onChange={(event) => setSelectedClinicId(event.target.value)}>{clinics.map((clinic) => <option key={clinic.id} value={clinic.id}>{clinic.name}</option>)}</Select><form onSubmit={createBranch} className="mt-4 grid gap-4"><Input name="name" placeholder="Branch name" required/><Input name="phone" placeholder="Phone"/><Input name="address" placeholder="Address"/><label className="flex items-center gap-2 text-sm font-semibold"><input name="is_main" type="checkbox"/> Main branch</label><Button type="submit" loading={saving} disabled={!selectedClinic}>Create branch</Button></form><div className="mt-4 space-y-2">{selectedClinicBranches.map((branch) => <div key={branch.id} className="rounded-lg border p-3 text-sm"><b>{branch.name}</b><p className="text-slate-500">{branch.address || "No address"}</p></div>)}</div></Card>
      <Card className="p-4 md:p-5"><h2 className="font-semibold">Create staff profile</h2><p className="mt-1 text-xs text-slate-500">Create a login account first, then enter its user ID.</p><form onSubmit={createStaff} className="mt-4 grid gap-4"><Input name="auth_user_id" placeholder="Auth user UUID" required/><Input name="full_name" placeholder="Full name" required/><Input name="user_id" placeholder="Staff ID" required/><Input name="email" placeholder="Email" required/><Input name="phone" placeholder="Phone"/><Select name="role_key" defaultValue="owner">{roles.map((role) => <option key={role} value={role}>{role}</option>)}</Select><Select name="clinic_id" defaultValue={selectedClinic?.id ?? ""}>{clinics.map((clinic) => <option key={clinic.id} value={clinic.id}>{clinic.name}</option>)}</Select><Select name="branch_id" defaultValue={selectedClinicBranches[0]?.id ?? ""}><option value="">No branch</option>{selectedClinicBranches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}</Select><Button type="submit" loading={saving}>Create staff profile</Button></form></Card>
    </div>
    <Card className="mt-5 overflow-hidden"><div className="p-5"><h2 className="font-semibold">Staff users</h2><p className="text-xs text-slate-500">Staff profiles linked to login accounts</p></div><div className="table-wrap"><table className="data-table"><thead><tr><th>Name</th><th>Staff ID</th><th>Role</th><th>Clinic</th><th>Status</th><th>Action</th></tr></thead><tbody>{staff.map((user) => <tr key={user.id}><td className="font-semibold">{user.fullName}</td><td>{user.userId}</td><td>{user.role}</td><td>{clinics.find((clinic) => clinic.id === user.clinicId)?.name ?? "Platform"}</td><td><StatusPill status={user.status}/></td><td><div className="flex flex-wrap gap-2"><Button size="sm" variant="secondary" disabled={saving} onClick={() => void saveStaffAccess(user.id)}>Sync access</Button><Button size="sm" variant="secondary" disabled={saving} onClick={() => void setStaffStatus(user.id, user.status === "active" ? "suspended" : "active")}>{user.status === "active" ? "Suspend" : "Activate"}</Button></div></td></tr>)}</tbody></table></div></Card>
  </>;
}
