import { Activity, Building2, CalendarClock, CalendarDays, ChartNoAxesCombined, ClipboardList, Headphones, LayoutDashboard, Package, PackagePlus, Pill, ReceiptIndianRupee, Settings, TriangleAlert, UserPlus, Users } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { canAccess } from "../../access-control/canAccess";
import type { ModuleKey, PermissionKey, UserRecord } from "../../shared/types/domain";
import type { UserRole } from "../../types/user";
/** A live count shown beside a nav item; the Sidebar resolves each key to its source. */
export type NavBadge = "pharmacyPending";
export type NavItem = { label: string; path: string; icon: LucideIcon; module: ModuleKey; permission?: PermissionKey; badge?: NavBadge };
export const homeForRole: Record<UserRole, string> = { owner: "/owner/dashboard", admin: "/owner/dashboard", receptionist: "/reception/dashboard", doctor: "/doctor/queue", pharmacist: "/pharmacy/dashboard", super_admin: "/super-admin/dashboard" };
const ownerNav: NavItem[] = [
  { label: "Dashboard", path: "/owner/dashboard", icon: LayoutDashboard, module: "dashboard" }, { label: "Appointments", path: "/reception/appointments", icon: CalendarDays, module: "appointments" },
  { label: "Patients", path: "/reception/new-patient", icon: Users, module: "patients" },
  { label: "Pharmacy", path: "/pharmacy/dashboard", icon: Pill, module: "pharmacy" },
  { label: "Reports", path: "/billing/reports", icon: ChartNoAxesCombined, module: "reports" },
  { label: "Monitoring", path: "/monitoring", icon: Activity, module: "reports" },
  { label: "Staff", path: "/owner/staff", icon: UserPlus, module: "staff", permission: "manage" },
  { label: "Settings", path: "/owner/settings", icon: Settings, module: "settings", permission: "configure" }
];
export const navForRole: Record<UserRole, NavItem[]> = {
  owner: ownerNav,
  admin: ownerNav,
  receptionist: [
    { label: "Reception Dashboard", path: "/reception/dashboard", icon: LayoutDashboard, module: "dashboard" }, { label: "Appointments", path: "/reception/appointments", icon: CalendarDays, module: "appointments" },
    { label: "Queue", path: "/reception/queue", icon: ClipboardList, module: "appointments" }, { label: "New Patient", path: "/reception/new-patient", icon: UserPlus, module: "patients", permission: "create" }
  ],
  doctor: [
    { label: "Queue", path: "/doctor/queue", icon: ClipboardList, module: "appointments" }, { label: "Availability", path: "/doctor/availability", icon: CalendarDays, module: "availability", permission: "configure" },
    { label: "Follow-ups", path: "/doctor/follow-ups", icon: Users, module: "follow_ups" }
  ],
  pharmacist: [
    { label: "Dashboard", path: "/pharmacy/dashboard", icon: LayoutDashboard, module: "pharmacy" },
    { label: "Prescription Queue", path: "/pharmacy/prescriptions", icon: ClipboardList, module: "prescriptions", badge: "pharmacyPending" },
    { label: "Counter Billing", path: "/pharmacy/billing", icon: ReceiptIndianRupee, module: "billing", permission: "bill" },
    { label: "Medicine Stock", path: "/pharmacy/stock", icon: Package, module: "pharmacy" },
    { label: "Add Stock", path: "/pharmacy/add-stock", icon: PackagePlus, module: "pharmacy", permission: "manage" },
    { label: "Low Stock", path: "/pharmacy/low-stock", icon: TriangleAlert, module: "pharmacy" },
    { label: "Expiry Alerts", path: "/pharmacy/expiry-alerts", icon: CalendarClock, module: "pharmacy" }
  ],
  super_admin: [
    { label: "All Clinics", path: "/super-admin/dashboard", icon: Building2, module: "dashboard" }, { label: "Subscriptions", path: "/super-admin/subscriptions", icon: ReceiptIndianRupee, module: "subscription" },
    { label: "Usage", path: "/super-admin/usage", icon: ChartNoAxesCombined, module: "reports" }, { label: "Monitoring", path: "/monitoring", icon: Activity, module: "reports" }, { label: "Support", path: "/super-admin/support", icon: Headphones, module: "support" },
    { label: "System Settings", path: "/super-admin/settings", icon: Settings, module: "settings", permission: "configure" }
  ]
};
export function getNavigationForUser(user: UserRecord, enabledClinicModules: ModuleKey[] = [], userModules: ModuleKey[] = user.modules, permissions: PermissionKey[] = user.permissions) {
  const scopedUser = { ...user, modules: userModules, permissions };
  return navForRole[user.role].filter((item) => canAccess(scopedUser, item.module, item.permission ?? "view", enabledClinicModules));
}
