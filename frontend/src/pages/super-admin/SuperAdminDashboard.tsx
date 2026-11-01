import { useEffect, useMemo, useState } from "react";
import { Building2, CircleOff, FlaskConical, Users } from "lucide-react";
import { moduleKeys } from "../../access-control/modules";
import { permissionKeys } from "../../access-control/permissions";
import { Button, Card, Input, PageHeader, Select, StatsCard, StatusPill } from "../../components/ui";
import { services } from "../../services/serviceProvider";
import type { BranchRecord, ClinicRecord, ModuleKey, UserRecord } from "../../shared/types/domain";
import type { BrandRecord, ClinicAccessRecord, CreateStaffLoginInput } from "../../services/interfaces";


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
  const [brands, setBrands] = useState<BrandRecord[]>([]);
  const [brandByClinic, setBrandByClinic] = useState<Map<string, string | null>>(new Map());
  const [access, setAccess] = useState<ClinicAccessRecord[]>([]);
  const [newClinicBrand, setNewClinicBrand] = useState("");
  const [loginRole, setLoginRole] = useState<CreateStaffLoginInput["role_key"]>("owner");
  const [loginClinicId, setLoginClinicId] = useState("");
  const [extraClinicIds, setExtraClinicIds] = useState<string[]>([]);
  const [shareStaffId, setShareStaffId] = useState("");
  const [shareClinicId, setShareClinicId] = useState("");

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
      const [nextBrands, nextBrandMap, nextAccess] = await Promise.all([services.brands.getBrands(), services.brands.getClinicBrandIds(), services.brands.getClinicAccess()]);
      setBrands(nextBrands);
      setBrandByClinic(nextBrandMap);
      setAccess(nextAccess);
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

  const brandName = (clinicId: string) => brands.find((brand) => brand.id === brandByClinic.get(clinicId))?.name ?? "-";

  const createClinic = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setSaving(true); setMessage("");
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    try {
      const created = await services.brands.createClinic({
        name: String(form.get("name") ?? "").trim(),
        slug: String(form.get("slug") ?? "").trim().toLowerCase(),
        clinicMode: String(form.get("clinic_mode") ?? "single_speciality") as "single_speciality" | "multi_speciality",
        specialty: String(form.get("specialty") ?? ""),
        phone: String(form.get("phone") ?? ""),
        email: String(form.get("email") ?? ""),
        address: String(form.get("address") ?? ""),
        organizationId: newClinicBrand || null,
        newOrganizationName: newClinicBrand ? undefined : String(form.get("new_brand") ?? "").trim(),
      });
      setMessage("Clinic created with a main branch and all modules enabled. Next: create its owner and admin below.");
      formElement.reset();
      setNewClinicBrand("");
      setLoginClinicId(created.clinicId);
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

  const loginTarget = loginClinicId || selectedClinic?.id || "";
  const siblingClinics = clinics.filter((clinic) => clinic.id !== loginTarget && brandByClinic.get(clinic.id) && brandByClinic.get(clinic.id) === brandByClinic.get(loginTarget));

  const createLogin = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setSaving(true); setMessage("");
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    try {
      const { staff: created, staffCode } = await services.users.createStaffLogin({
        full_name: String(form.get("full_name") ?? "").trim(),
        email: String(form.get("email") ?? "").trim(),
        password: String(form.get("password") ?? ""),
        phone: String(form.get("phone") ?? "").trim() || undefined,
        role_key: loginRole,
        clinic_id: loginTarget,
        extra_clinic_ids: extraClinicIds,
      });
      setMessage(`Created ${loginRole} login for ${created.fullName} (staff ID ${staffCode}). They can sign in with ${String(form.get("email"))}.`);
      formElement.reset();
      setExtraClinicIds([]);
      await loadAdminData();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to create the login.");
    } finally {
      setSaving(false);
    }
  };

  const shareTarget = staff.find((user) => user.id === shareStaffId);
  const shareableClinics = clinics.filter((clinic) => {
    const staffClinicIds = access.filter((row) => row.staffId === shareStaffId).map((row) => row.clinicId);
    const staffBrands = new Set(staffClinicIds.map((id) => brandByClinic.get(id)));
    return shareTarget && !staffClinicIds.includes(clinic.id) && staffBrands.has(brandByClinic.get(clinic.id));
  });

  const grantAccess = async () => {
    if (!shareStaffId || !shareClinicId) return;
    setSaving(true); setMessage("");
    try {
      await services.brands.grantClinicAccess(shareStaffId, shareClinicId);
      setMessage("Access granted. They can switch between these clinics from the top bar.");
      setShareClinicId("");
      await loadAdminData();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to grant access.");
    } finally {
      setSaving(false);
    }
  };

  const revokeAccess = async (staffId: string, clinicId: string) => {
    setSaving(true); setMessage("");
    try {
      await services.brands.revokeClinicAccess(staffId, clinicId);
      setMessage("Access removed.");
      await loadAdminData();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to remove access.");
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
      <Card className="overflow-hidden"><div className="p-5"><h2 className="font-semibold">Clinics</h2><p className="text-xs text-slate-500">Clinic records</p></div><div className="table-wrap"><table className="data-table"><thead><tr><th>Clinic</th><th>Brand</th><th>Slug</th><th className="numeric">Modules</th><th>Status</th><th>Action</th></tr></thead><tbody>{clinics.map((clinic) => <tr key={clinic.id} onClick={() => selectClinic(clinic)} className="cursor-pointer"><td className="font-semibold">{clinic.name}</td><td>{brandName(clinic.id)}</td><td>{clinic.slug}</td><td className="numeric">{clinic.enabledModules.length}</td><td><StatusPill status={clinic.status}/></td><td><Button size="sm" variant="secondary" disabled={saving} onClick={(event) => { event.stopPropagation(); void setClinicStatus(clinic.id, clinic.status === "active" ? "suspended" : "active"); }}>{clinic.status === "active" ? "Suspend" : "Activate"}</Button></td></tr>)}</tbody></table></div></Card>
      <Card className="p-4 md:p-5"><h2 className="font-semibold">Create clinic</h2><p className="mt-1 text-xs text-slate-500">A clinic is one location. Group several under a brand (for example a hospital chain) so their admins can be shared.</p>
        <form onSubmit={createClinic} className="mt-4 grid gap-4">
          <Select aria-label="Brand" value={newClinicBrand} onChange={(event) => setNewClinicBrand(event.target.value)}><option value="">New brand</option>{brands.map((brand) => <option key={brand.id} value={brand.id}>Add to brand: {brand.name}</option>)}</Select>
          {!newClinicBrand && <Input name="new_brand" placeholder="Brand name (leave empty to use the clinic name)"/>}
          <Input name="name" placeholder="Clinic name" required/><Input name="slug" placeholder="clinic-slug (lowercase, hyphens)" pattern="[a-z0-9]+(-[a-z0-9]+)*" title="Lowercase letters, numbers and single hyphens" required/>
          <Select name="clinic_mode" defaultValue="single_speciality"><option value="single_speciality">Single speciality</option><option value="multi_speciality">Multi speciality</option></Select>
          <Input name="specialty" placeholder="Specialty"/><Input name="phone" placeholder="Phone"/><Input name="email" placeholder="Email"/><Input name="address" placeholder="Address"/>
          <Button type="submit" loading={saving}>Create clinic</Button></form></Card>
    </div>
    <div className="mt-5 grid gap-4 xl:grid-cols-2">
      <Card className="p-4 md:p-5"><h2 className="font-semibold">Enabled modules</h2><div className="mt-4 grid gap-2 sm:grid-cols-2">{moduleKeys.map((module) => <label key={module} className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" checked={selectedModules.includes(module)} onChange={() => toggleModule(module)}/>{module}</label>)}</div><Button className="mt-4" variant="secondary" loading={saving} disabled={!selectedClinic} onClick={() => void saveSelectedClinicModules()}>Save to selected clinic</Button></Card>
      <Card className="p-4 md:p-5"><h2 className="font-semibold">Permission actions</h2><div className="mt-4 grid gap-2 sm:grid-cols-2">{permissionKeys.map((permission) => <label key={permission} className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" checked={selectedActions.includes(permission)} onChange={() => toggleAction(permission)}/>{permission}</label>)}</div><p className="mt-3 text-xs text-slate-500">{permissionOptions.length} permission keys will be assigned to new staff.</p></Card>
    </div>
    <div className="mt-5 grid gap-4 xl:grid-cols-2">
      <Card className="p-4 md:p-5"><h2 className="font-semibold">Branch management</h2><Select className="mt-4" value={selectedClinic?.id ?? ""} onChange={(event) => setSelectedClinicId(event.target.value)}>{clinics.map((clinic) => <option key={clinic.id} value={clinic.id}>{clinic.name}</option>)}</Select><form onSubmit={createBranch} className="mt-4 grid gap-4"><Input name="name" placeholder="Branch name" required/><Input name="phone" placeholder="Phone"/><Input name="address" placeholder="Address"/><label className="flex items-center gap-2 text-sm font-semibold"><input name="is_main" type="checkbox"/> Main branch</label><Button type="submit" loading={saving} disabled={!selectedClinic}>Create branch</Button></form><div className="mt-4 space-y-2">{selectedClinicBranches.map((branch) => <div key={branch.id} className="rounded-lg border p-3 text-sm"><b>{branch.name}</b><p className="text-slate-500">{branch.address || "No address"}</p></div>)}</div></Card>
      <Card className="p-4 md:p-5"><h2 className="font-semibold">Create a login for a clinic</h2><p className="mt-1 text-xs text-slate-500">Creates the sign-in and the staff profile in one step. Start with the clinic's owner and admin.</p>
        <form onSubmit={createLogin} className="mt-4 grid gap-4">
          <Select aria-label="Clinic" value={loginTarget} onChange={(event) => { setLoginClinicId(event.target.value); setExtraClinicIds([]); }}>{clinics.map((clinic) => <option key={clinic.id} value={clinic.id}>{clinic.name}</option>)}</Select>
          <Select aria-label="Role" value={loginRole} onChange={(event) => setLoginRole(event.target.value as CreateStaffLoginInput["role_key"])}>{(["owner", "admin", "doctor", "receptionist", "pharmacist"] as const).map((role) => <option key={role} value={role}>{role}</option>)}</Select>
          <Input name="full_name" placeholder="Full name" required/><Input name="email" type="email" placeholder="Email (used to sign in)" required/>
          <Input name="password" type="password" minLength={8} placeholder="Temporary password (min 8 characters)" autoComplete="new-password" required/><Input name="phone" placeholder="Phone"/>
          {siblingClinics.length > 0 && <fieldset className="rounded-xl border p-3"><legend className="px-1 text-xs font-semibold text-slate-500">Also let them work in these clinics of the same brand</legend>{siblingClinics.map((clinic) => <label key={clinic.id} className="flex min-h-9 items-center gap-2 text-sm"><input type="checkbox" checked={extraClinicIds.includes(clinic.id)} onChange={() => setExtraClinicIds((current) => current.includes(clinic.id) ? current.filter((id) => id !== clinic.id) : [...current, clinic.id])}/>{clinic.name}</label>)}</fieldset>}
          <Button type="submit" loading={saving} disabled={!loginTarget}>Create login</Button></form></Card>
    </div>
    <Card className="mt-5 p-4 md:p-5"><h2 className="font-semibold">Share a person between clinics</h2><p className="mt-1 text-xs text-slate-500">One admin can look after several clinics of the same brand. They pick the clinic from the top bar.</p>
      <div className="mt-4 grid gap-3 md:grid-cols-[1fr_1fr_auto]">
        <Select aria-label="Person" value={shareStaffId} onChange={(event) => { setShareStaffId(event.target.value); setShareClinicId(""); }}><option value="">Choose a person</option>{staff.filter((user) => user.role !== "super_admin").map((user) => <option key={user.id} value={user.id}>{user.fullName} ({user.role})</option>)}</Select>
        <Select aria-label="Clinic to add" value={shareClinicId} onChange={(event) => setShareClinicId(event.target.value)} disabled={!shareStaffId}><option value="">{shareStaffId && shareableClinics.length === 0 ? "No other clinics in their brand" : "Choose a clinic"}</option>{shareableClinics.map((clinic) => <option key={clinic.id} value={clinic.id}>{clinic.name}</option>)}</Select>
        <Button loading={saving} disabled={!shareStaffId || !shareClinicId} onClick={() => void grantAccess()}>Give access</Button></div>
      {shareStaffId && <ul className="mt-4 divide-y rounded-xl border">{access.filter((row) => row.staffId === shareStaffId).map((row) => <li key={row.clinicId} className="flex min-h-11 items-center justify-between gap-3 px-3 text-sm"><span>{clinics.find((clinic) => clinic.id === row.clinicId)?.name ?? row.clinicId}</span><Button size="sm" variant="secondary" disabled={saving} onClick={() => void revokeAccess(shareStaffId, row.clinicId)}>Remove</Button></li>)}</ul>}</Card>
    <Card className="mt-5 overflow-hidden"><div className="p-5"><h2 className="font-semibold">Staff users</h2><p className="text-xs text-slate-500">Staff profiles linked to login accounts</p></div><div className="table-wrap"><table className="data-table"><thead><tr><th>Name</th><th>Staff ID</th><th>Role</th><th>Clinic</th><th>Status</th><th>Action</th></tr></thead><tbody>{staff.map((user) => <tr key={user.id}><td className="font-semibold">{user.fullName}</td><td>{user.userId}</td><td>{user.role}</td><td>{clinics.find((clinic) => clinic.id === user.clinicId)?.name ?? "Platform"}{access.filter((row) => row.staffId === user.id).length > 1 && <span className="ml-1 text-xs text-slate-500">+{access.filter((row) => row.staffId === user.id).length - 1} more</span>}</td><td><StatusPill status={user.status}/></td><td><div className="flex flex-wrap gap-2"><Button size="sm" variant="secondary" disabled={saving} onClick={() => void saveStaffAccess(user.id)}>Sync access</Button><Button size="sm" variant="secondary" disabled={saving} onClick={() => void setStaffStatus(user.id, user.status === "active" ? "suspended" : "active")}>{user.status === "active" ? "Suspend" : "Activate"}</Button></div></td></tr>)}</tbody></table></div></Card>
  </>;
}
