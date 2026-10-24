import { useEffect, useState, type ReactNode } from "react";
import { LoadingSkeleton } from "../components/ui";
import { services } from "../services/serviceProvider";
import type { PermissionKey } from "../shared/types/domain";

type GuardState = "checking" | "allowed" | "denied";

export function PermissionGuard({ permission, children, fallback = null }: { permission: PermissionKey; children: ReactNode; fallback?: ReactNode }) {
  const [state, setState] = useState<GuardState>("checking");

  useEffect(() => {
    let mounted = true;
    services.auth.getCurrentAuthContext()
      .then((context) => {
        const allowed = context.allowedPermissions.includes(permission) || context.allowedPermissions.some((key) => key.endsWith(`.${permission}`));
        if (mounted) setState(allowed ? "allowed" : "denied");
      })
      .catch(() => {
        if (mounted) setState("denied");
      });
    return () => { mounted = false; };
  }, [permission]);

  if (state === "checking") return <LoadingSkeleton rows={1} />;
  return state === "allowed" ? <>{children}</> : <>{fallback}</>;
}
