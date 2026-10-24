import { useEffect, useState } from "react";
import { Navigate, Outlet } from "react-router-dom";
import { LoadingSkeleton } from "../ui";
import { services } from "../../services/serviceProvider";
import type { UserRole } from "../../types/user";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";
export function AppLayout() {
  const [role, setRole] = useState<UserRole | null>(null);
  const [checked, setChecked] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(() => {
    try { return window.localStorage.getItem("vernex_sidebar_collapsed") === "true"; }
    catch { return false; }
  });
  useEffect(() => {
    try { window.localStorage.setItem("vernex_sidebar_collapsed", String(collapsed)); }
    catch { /* Storage may be unavailable in private or restricted contexts. */ }
  }, [collapsed]);
  useEffect(() => {
    if (!mobileOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") setMobileOpen(false); };
    window.addEventListener("keydown", onKeyDown);
    return () => { document.body.style.overflow = previousOverflow; window.removeEventListener("keydown", onKeyDown); };
  }, [mobileOpen]);
  useEffect(() => {
    let mounted = true;
    const sync = () => services.auth.getCurrentAuthContext().then((context) => { if (mounted) { setRole(context.role_key); setChecked(true); } }).catch(() => { if (mounted) { setRole(null); setChecked(true); } });
    sync();
    window.addEventListener("vernex-role", sync);
    return () => { mounted = false; window.removeEventListener("vernex-role", sync); };
  }, []);
  if (!checked) return <main className="p-5 md:p-7"><LoadingSkeleton rows={4} /></main>;
  if (!role) return <Navigate to="/login" replace />;
  const displayRole = role;
  return <div className="min-h-screen"><Sidebar role={displayRole} mobileOpen={mobileOpen} collapsed={collapsed} close={() => setMobileOpen(false)} toggleCollapsed={() => setCollapsed((value) => !value)} /><div className={collapsed ? "lg:pl-[72px]" : "lg:pl-[248px]"}><Topbar role={displayRole} openMenu={() => setMobileOpen(true)} /><main className="mx-auto w-full max-w-[1440px] p-4 md:p-6"><Outlet /></main></div></div>;
}

