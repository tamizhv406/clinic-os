import { useEffect, useState } from "react";
import { Navigate, Outlet } from "react-router-dom";
import { LoadingSkeleton } from "../components/ui";
import { services } from "../services/serviceProvider";

type AuthState = "checking" | "allowed" | "denied";

export default function ProtectedRoute() {
  const [state, setState] = useState<AuthState>("checking");

  useEffect(() => {
    let mounted = true;
    services.auth.getCurrentAuthContext()
      .then((context) => {
        const allowed = context.status === "active" && Boolean(context.role_key);
        if (mounted) setState(allowed ? "allowed" : "denied");
      })
      .catch(() => {
        localStorage.removeItem("vernex_auth");
        localStorage.removeItem("vernex_role");
        if (mounted) setState("denied");
      });
    return () => { mounted = false; };
  }, []);

  if (state === "checking") return <main className="p-5 md:p-7"><LoadingSkeleton rows={4} /></main>;
  return state === "allowed" ? <Outlet /> : <Navigate to="/login" replace />;
}
