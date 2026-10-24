import type { UserRecord } from "../shared/types/domain";
import type { StaffAuthContext } from "../services/interfaces";

type ModuleSource = UserRecord | StaffAuthContext | null | undefined;

export function useModules(user?: ModuleSource) {
  const modules = "enabledModules" in (user ?? {}) ? (user as StaffAuthContext).enabledModules : (user as UserRecord | null | undefined)?.modules ?? [];
  return { modules, hasModule: (module: string) => modules.includes(module) };
}
