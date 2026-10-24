import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Stethoscope, UserCheck, UserCog, UserPlus, Users } from "lucide-react";
import { Button, Card, EmptyState, Input, LoadingSkeleton, Modal, PageHeader, Select, StatsCard, StatusPill } from "../../components/ui";
import { services } from "../../services/serviceProvider";
import type { CreateStaffLoginInput } from "../../services/interfaces";
import type { BranchRecord, UserRecord } from "../../shared/types/domain";
import type { UserRole } from "../../types/user";

const roleFilters: UserRole[] = ["owner", "admin", "receptionist", "doctor", "pharmacist"];
const onboardableRoles: CreateStaffLoginInput["role_key"][] = ["doctor", "receptionist", "pharmacist"];
const label = (value: string) => value.replaceAll("_", " ").replace(/\b\w/, (character) => character.toUpperCase());
const emptyForm: CreateStaffLoginInput = { full_name: "", email: "", password: "", phone: "", role_key: "receptionist", branch_id: "", department: "", specialization: "", qualification: "", consultation_fee: undefined, slot_duration_minutes: 15 };

export default function OwnerStaff() {
  const [staff, setStaff] = useState<UserRecord[]>([]);
  const [branches, setBranches] = useState<BranchRecord[]>([]);
  const [clinicName, setClinicName] = useState("");
  const [search, setSearch] = useState("");
  const [role, setRole] = useState("all");
  const [status, setStatus] = useState("all");
  const [loading, setLoading] = useState(true);
  const [canOnboardStaff, setCanOnboardStaff] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState<CreateStaffLoginInput>(emptyForm);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const context = await services.auth.getCurrentAuthContext();
      if (!context.clinic_id) throw new Error("Your account is not linked to a clinic.");
      const [staffRows, branchRows] = await Promise.all([
        services.users.getStaffUsers(context.clinic_id),
        services.clinics.getBranches(context.clinic_id),
      ]);
      setStaff(staffRows);
      setBranches(branchRows);
      setClinicName((context.clinic as { name?: string } | null)?.name ?? "your clinic");
      setCanOnboardStaff(context.role_key === "admin" || context.role_key === "super_admin");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to load the staff directory.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const openAdd = () => { setForm(emptyForm); setAddOpen(true); };

  const addStaff = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    try {
      const { staff: created, staffCode } = await services.users.createStaffLogin({
        ...form,
        branch_id: form.branch_id || null,
        consultation_fee: form.role_key === "doctor" && form.consultation_fee ? Number(form.consultation_fee) : undefined,
        slot_duration_minutes: form.role_key === "doctor" ? Number(form.slot_duration_minutes) || 15 : undefined,
      });
      setStaff((current) => [created, ...current]);
      setAddOpen(false);
      toast.success(`${created.fullName} added as ${label(created.role)} (${staffCode}).`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to add the staff member.");
    } finally {
      setSaving(false);
    }
  };

  const branchNames = useMemo(() => new Map(branches.map((branch) => [branch.id, branch.name])), [branches]);

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    return staff.filter((member) => {
      if (role !== "all" && member.role !== role) return false;
      if (status !== "all" && member.status !== status) return false;
      if (!term) return true;
      return [member.fullName, member.userId, member.email, member.phone].some((field) => field?.toLowerCase().includes(term));
    });
  }, [role, search, staff, status]);

  const stats = useMemo(() => [
    ["Total staff", String(staff.length), "Profiles in this clinic", Users, "teal"],
    ["Active", String(staff.filter((member) => member.status === "active").length), "Can sign in today", UserCheck, "blue"],
    ["Doctors", String(staff.filter((member) => member.role === "doctor").length), "Consulting staff", Stethoscope, "violet"],
    ["Front office", String(staff.filter((member) => member.role === "receptionist" || member.role === "pharmacist").length), "Reception & pharmacy", UserCog, "amber"],
  ] as const, [staff]);

  if (loading) return <main className="p-5 md:p-7"><LoadingSkeleton rows={6} /></main>;

  return <><PageHeader title="Staff" description={`Everyone with a profile at ${clinicName}.`} action={<div className="flex gap-2">{canOnboardStaff && <Button onClick={openAdd}><UserPlus className="size-4" /> Add staff</Button>}<Button variant="secondary" onClick={() => void load()}>Refresh</Button></div>} />
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{stats.map(([statLabel, value, detail, icon, tone]) => <StatsCard key={statLabel} label={statLabel} value={value} detail={detail} icon={icon} tone={tone} />)}</div>
    <Card className="mt-5 p-4"><div className="grid gap-4 lg:grid-cols-[2fr_1fr_1fr]">
      <Input aria-label="Search staff" placeholder="Search by name, staff ID, email, or phone..." value={search} onChange={(event) => setSearch(event.target.value)} />
      <Select aria-label="Filter by role" value={role} onChange={(event) => setRole(event.target.value)}><option value="all">All roles</option>{roleFilters.map((option) => <option key={option} value={option}>{label(option)}</option>)}</Select>
      <Select aria-label="Filter by status" value={status} onChange={(event) => setStatus(event.target.value)}><option value="all">All statuses</option><option value="active">Active</option><option value="suspended">Suspended</option><option value="inactive">Inactive</option></Select>
    </div></Card>
    <Card className="mt-5 overflow-hidden">
      <div className="flex items-center justify-between p-5"><div><h2 className="font-semibold">Staff directory</h2><p className="text-xs text-slate-500">{visible.length} of {staff.length} profiles</p></div></div>
      {visible.length > 0 ? <div className="table-wrap"><table className="data-table">
        <thead><tr><th>Name</th><th>Staff ID</th><th>Role</th><th>Branch</th><th>Contact</th><th>Modules</th><th>Status</th></tr></thead>
        <tbody>{visible.map((member) => <tr key={member.id}>
          <td className="font-semibold">{member.fullName}</td>
          <td className="text-slate-500">{member.userId || "-"}</td>
          <td>{label(member.role)}</td>
          <td className="text-slate-500">{member.branchIds.map((id) => branchNames.get(id) ?? "Unknown").join(", ") || "All branches"}</td>
          <td><div className="text-sm">{member.email || "-"}</div><div className="text-xs text-slate-500">{member.phone || "-"}</div></td>
          <td>{member.modules.length}</td>
          <td><StatusPill status={member.status} /></td>
        </tr>)}</tbody>
      </table></div> : <div className="p-5"><EmptyState title="No staff match these filters" description="Clear the search or filters to see every profile in this clinic." /></div>}
    </Card>
    {!canOnboardStaff && <p className="mt-4 text-xs text-slate-500">Onboarding new staff logins is handled by your clinic admin.</p>}
    <Modal open={addOpen} title="Add staff" description="Creates a login for a doctor, receptionist, or pharmacist in this clinic." onClose={() => setAddOpen(false)} footer={<><Button variant="secondary" onClick={() => setAddOpen(false)}>Cancel</Button><Button type="submit" form="add-staff-form" loading={saving}>Create login</Button></>}>
      <form id="add-staff-form" onSubmit={addStaff} className="grid gap-4">
        <Select aria-label="Role" value={form.role_key} onChange={(event) => setForm((current) => ({ ...current, role_key: event.target.value as CreateStaffLoginInput["role_key"] }))}>
          {onboardableRoles.map((option) => <option key={option} value={option}>{label(option)}</option>)}
        </Select>
        <Input aria-label="Full name" placeholder="Full name" required value={form.full_name} onChange={(event) => setForm((current) => ({ ...current, full_name: event.target.value }))} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Input aria-label="Email" type="email" placeholder="Email" required value={form.email} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} />
          <Input aria-label="Phone" placeholder="Phone" value={form.phone} onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))} />
        </div>
        <Input aria-label="Temporary password" type="password" placeholder="Temporary password (min. 8 characters)" required minLength={8} value={form.password} onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))} />
        <Select aria-label="Branch" value={form.branch_id ?? ""} onChange={(event) => setForm((current) => ({ ...current, branch_id: event.target.value }))}>
          <option value="">All branches</option>
          {branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
        </Select>
        {form.role_key === "doctor" && <>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input aria-label="Department" placeholder="Department" value={form.department} onChange={(event) => setForm((current) => ({ ...current, department: event.target.value }))} />
            <Input aria-label="Specialization" placeholder="Specialization" value={form.specialization} onChange={(event) => setForm((current) => ({ ...current, specialization: event.target.value }))} />
          </div>
          <Input aria-label="Qualification" placeholder="Qualification" value={form.qualification} onChange={(event) => setForm((current) => ({ ...current, qualification: event.target.value }))} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Input aria-label="Consultation fee" type="number" min={0} placeholder="Consultation fee" value={form.consultation_fee ?? ""} onChange={(event) => setForm((current) => ({ ...current, consultation_fee: event.target.value ? Number(event.target.value) : undefined }))} />
            <Input aria-label="Slot duration in minutes" type="number" min={1} placeholder="Slot duration (min)" value={form.slot_duration_minutes ?? 15} onChange={(event) => setForm((current) => ({ ...current, slot_duration_minutes: Number(event.target.value) || 15 }))} />
          </div>
        </>}
      </form>
    </Modal>
  </>;
}
