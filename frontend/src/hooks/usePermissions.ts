import type { PermissionKey, UserRecord } from "../shared/types/domain";
import type { StaffAuthContext } from "../services/interfaces";

type PermissionSource = UserRecord | StaffAuthContext | null | undefined;

export function usePermissions(user?: PermissionSource) {
  const permissions = "allowedPermissions" in (user ?? {}) ? (user as StaffAuthContext).allowedPermissions : (user as UserRecord | null | undefined)?.permissions ?? [];
  return {
    permissions,
    can: (permission: PermissionKey | string) => permissions.includes(permission) || permissions.some((key) => key.endsWith(`.${permission}`)),
  };
}
