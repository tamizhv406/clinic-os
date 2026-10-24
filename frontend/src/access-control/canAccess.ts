import type { ModuleKey, PermissionKey, UserRecord } from "../shared/types/domain";

export function canAccess(user: UserRecord | null | undefined, module: ModuleKey, permission: PermissionKey = "view", enabledClinicModules: ModuleKey[] = []) {
  if (!user) return false;
  const clinicAllows = user.role === "super_admin" || enabledClinicModules.includes(module);
  const moduleAllows = user.modules.includes(module);
  const permissions = user.permissions as string[];
  const permissionAllows = permissions.includes(permission) || permissions.includes(`${module}.${permission}`);
  return clinicAllows && moduleAllows && permissionAllows;
}
