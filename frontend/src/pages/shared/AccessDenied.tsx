import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { LayoutDashboard, LogOut } from "lucide-react";
import { toast } from "sonner";
import { Button, EmptyState, PageHeader } from "../../components/ui";
import { homeForRole } from "../../components/layout/navigation";
import { services } from "../../services/serviceProvider";
import type { ModuleKey, PermissionKey } from "../../shared/types/domain";
import type { UserRole } from "../../types/user";

type AccessDeniedProps = {
  module: ModuleKey;
  permission: PermissionKey;
  role?: UserRole | null;
  reason?: string;
};

export default function AccessDenied({ module, permission, role, reason }: AccessDeniedProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const [signingOut, setSigningOut] = useState(false);
  const home = role ? homeForRole[role] : null;

  const signOut = async () => {
    setSigningOut(true);
    try {
      await services.auth.signOut();
      navigate("/login", { replace: true });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to sign out.");
    } finally {
      setSigningOut(false);
    }
  };

  return <>
    <PageHeader title="Access denied" description="You are signed in, but your account can't open this page." />
    <EmptyState
      title="You don't have access to this page"
      description={`${reason ?? "Your account is missing the access this page needs."} Required: ${module} module · ${module}.${permission} permission. Ask your clinic admin if you need it.`}
      action={<div className="flex flex-wrap justify-center gap-2">
        {home && home !== location.pathname && <Button type="button" icon={<LayoutDashboard className="size-4" />} onClick={() => navigate(home, { replace: true })}>Go to my dashboard</Button>}
        <Button type="button" variant="secondary" icon={<LogOut className="size-4" />} onClick={signOut} loading={signingOut}>Sign out</Button>
      </div>}
    />
  </>;
}
