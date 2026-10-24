import type { UserRole } from "../../types/user";
const labels: Record<UserRole, string> = { owner: "Owner", admin: "Admin", receptionist: "Receptionist", doctor: "Doctor", pharmacist: "Pharmacist", super_admin: "Super Admin" };
export function RoleSwitcher({ role }: { role: UserRole }) {
  return <div role="status" aria-label={`Current role: ${labels[role]}`} className="inline-flex h-10 items-center gap-2 rounded-lg border bg-white px-3 text-xs font-semibold text-slate-700">
    <span aria-hidden="true" className="size-2 rounded-full bg-brand-500" />
    <span>{labels[role]}</span>
  </div>;
}
