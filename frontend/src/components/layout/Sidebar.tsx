import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { useEffect, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import type { ModuleKey, UserRecord } from "../../shared/types/domain";
import { usePharmacyQueueLive } from "../../hooks/usePharmacyQueueLive";
import { services } from "../../services/serviceProvider";
import type { UserRole } from "../../types/user";
import { BrandLogo } from "../common/BrandLogo";
import { getNavigationForUser, type NavBadge } from "./navigation";

const roleLabel: Record<UserRole, string> = { owner: "Owner Workspace", admin: "Admin Workspace", receptionist: "Reception Desk", doctor: "Doctor Workspace", pharmacist: "Pharmacy", super_admin: "Platform Admin" };

export function Sidebar({ role, mobileOpen, collapsed, close, toggleCollapsed }: { role: UserRole; mobileOpen: boolean; collapsed: boolean; close: () => void; toggleCollapsed: () => void }) {
  const location = useLocation();
  const [accessContext, setAccessContext] = useState<{ user: UserRecord; enabledClinicModules: ModuleKey[] } | null>(null);
  useEffect(() => {
    let mounted = true;
    Promise.all([services.auth.getCurrentUser(), services.auth.getCurrentAuthContext()])
      .then(([user, context]) => { if (mounted) setAccessContext({ user, enabledClinicModules: context.enabledModules as ModuleKey[] }); })
      .catch(() => { if (mounted) setAccessContext(null); });
    return () => { mounted = false; };
  }, [role]);
  const showLabels = !collapsed || mobileOpen;
  useEffect(() => { close(); }, [location.pathname]);
  const navigation = accessContext ? getNavigationForUser(accessContext.user, accessContext.enabledClinicModules, accessContext.user.modules, accessContext.user.permissions) : [];
  // The sidebar is mounted on every page, so it is the one place that announces new prescriptions.
  const { pendingCount } = usePharmacyQueueLive({ enabled: navigation.some((item) => item.badge === "pharmacyPending"), notifyNewOrders: true });
  const badgeCount = (badge?: NavBadge) => (badge === "pharmacyPending" ? pendingCount ?? 0 : 0);
  return <><button aria-label="Close navigation overlay" onClick={close} className={`fixed inset-0 z-30 bg-slate-950/35 lg:hidden ${mobileOpen ? "block" : "hidden"}`} /><aside className={`fixed inset-y-0 left-0 z-40 flex flex-col border-r bg-white transition-all duration-200 lg:translate-x-0 ${collapsed ? "lg:w-[72px]" : "lg:w-[248px]"} ${mobileOpen ? "w-[286px] translate-x-0" : "w-[286px] -translate-x-full"}`}>
    <div className="flex h-16 shrink-0 items-center gap-3 border-b px-4"><BrandLogo className="size-9" />{showLabels && <div className="min-w-0"><div className="font-['Manrope'] font-semibold text-slate-900">Vernex</div><div className="text-xs font-semibold text-brand-700">Clinic OS</div></div>}<button className="ml-auto rounded-lg p-2 text-slate-500 hover:bg-slate-100 lg:hidden" onClick={close} aria-label="Close menu"><X className="size-5" /></button></div>
    <div className="px-4 pt-5">{showLabels && <p className="px-3 text-[11px] font-semibold uppercase tracking-[.16em] text-slate-400">{roleLabel[role]}</p>}</div>
    <nav className="mt-3 flex-1 space-y-1 overflow-y-auto px-3 pb-4">{navigation.map(({ label, path, icon: Icon, badge }) => { const count = badgeCount(badge); return <NavLink key={path} to={path} onClick={close} title={collapsed && !mobileOpen ? (count ? `${label} (${count})` : label) : undefined} className={({ isActive }) => `relative flex min-h-11 items-center gap-4 rounded-lg px-3 text-sm font-medium transition ${collapsed ? "lg:justify-center" : ""} ${isActive ? "bg-brand-50 text-brand-700 before:absolute before:inset-y-2 before:left-0 before:w-0.5 before:bg-brand-700" : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"}`}><span className="relative shrink-0"><Icon className="size-[18px]" />{count > 0 && !showLabels && <span className="absolute -right-1 -top-1 size-2 rounded-full bg-brand-600" aria-hidden="true" />}</span>{showLabels && <span className="truncate">{label}</span>}{count > 0 && showLabels && <span className="ml-auto rounded-full bg-brand-600 px-2 py-0.5 text-[11px] font-semibold tabular-nums text-white" aria-label={`${count} pending`}>{count > 99 ? "99+" : count}</span>}</NavLink>; })}</nav>
    <div className="border-t p-3"><button type="button" onClick={toggleCollapsed} aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"} className={`hidden min-h-10 w-full items-center gap-3 rounded-lg px-3 text-sm font-medium text-slate-500 hover:bg-slate-50 hover:text-slate-900 lg:flex ${collapsed ? "justify-center" : ""}`} title={collapsed ? "Expand sidebar" : undefined}>{collapsed ? <ChevronRight className="size-4" /> : <><ChevronLeft className="size-4" /><span>Collapse sidebar</span></>}</button></div>
  </aside></>;
}


