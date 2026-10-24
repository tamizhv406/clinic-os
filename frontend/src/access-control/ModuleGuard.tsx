import { useEffect, useState, type ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { LoadingSkeleton } from "../components/ui";
import AccessDenied from "../pages/shared/AccessDenied";
import { services } from "../services/serviceProvider";
import { canAccess } from "./canAccess";
import type { ModuleKey, PermissionKey, UserRecord } from "../shared/types/domain";
import type { UserRole } from "../types/user";

// "unauthenticated" is the only state that leaves for /login. A signed-in user who
// lacks access stays put and sees AccessDenied, so the guard can never loop with
// the login page's own redirect for an existing session.
type GuardState =
  | { status: "checking" }
  | { status: "allowed" }
  | { status: "unauthenticated" }
  | { status: "denied"; role: UserRole | null; reason: string };

type ModuleGuardProps = {
  module: ModuleKey;
  permission?: PermissionKey;
  roles?: UserRole[];
  children: ReactNode;
};

export function ModuleGuard({ module, permission = "view", roles, children }: ModuleGuardProps) {
  const [state, setState] = useState<GuardState>({ status: "checking" });
  // Callers pass a new array literal on every render; the joined string keeps the
  // effect from re-running unless the allowed roles actually change.
  const roleKey = roles?.join(",") ?? "";

  useEffect(() => {
    let mounted = true;
    const allowedRoles = roleKey ? (roleKey.split(",") as UserRole[]) : [];
    setState({ status: "checking" });
    Promise.all([services.auth.getCurrentAuthContext(), services.auth.getCurrentUser()])
      .then((context) => {
        const [authContext, user] = context;
        const scopedUser: UserRecord = {
          ...user,
          modules: authContext.enabledModules as ModuleKey[],
          permissions: authContext.allowedPermissions as unknown as PermissionKey[],
        };
        const roleAllows = allowedRoles.length === 0 || allowedRoles.includes(authContext.role_key);
        const accessAllows = canAccess(scopedUser, module, permission, authContext.enabledModules as ModuleKey[]);
        if (!mounted) return;
        if (roleAllows && accessAllows) { setState({ status: "allowed" }); return; }
        const reason = !roleAllows
          ? "This page is not available for your role."
          : !authContext.enabledModules.includes(module)
            ? `The ${module} module is not enabled for your account.`
            : `Your account is missing the ${module}.${permission} permission.`;
        setState({ status: "denied", role: authContext.role_key, reason });
      })
      .catch((error) => {
        services.auth.getSession()
          .then((session) => {
            if (!mounted) return;
            setState(session
              ? { status: "denied", role: null, reason: error instanceof Error ? error.message : "Unable to check your access." }
              : { status: "unauthenticated" });
          })
          .catch(() => { if (mounted) setState({ status: "unauthenticated" }); });
      });
    return () => { mounted = false; };
  }, [module, permission, roleKey]);

  if (state.status === "checking") return <LoadingSkeleton rows={2} />;
  if (state.status === "allowed") return <>{children}</>;
  if (state.status === "unauthenticated") return <Navigate to="/login" replace />;
  return <AccessDenied module={module} permission={permission} role={state.role} reason={state.reason} />;
}
