import type { UserRecord } from "../../shared/types/domain";
import type { UserRole } from "../../types/user";

export type StaffAuthContext = {
  authUserId: string;
  staffProfileId: string;
  fullName: string;
  user_id: string;
  email: string | null;
  phone: string | null;
  role_key: UserRole;
  clinic_id: string | null;
  branch_id: string | null;
  enabledModules: string[];
  allowedPermissions: string[];
  status: string;
  clinic: unknown | null;
  branch: unknown | null;
  session: unknown;
};

export interface AuthService {
  signInWithPassword(userIdOrEmail: string, password: string): Promise<StaffAuthContext>;
  signOut(): Promise<void>;
  getSession(): Promise<unknown>;
  getCurrentStaffProfile(): Promise<unknown>;
  getCurrentAuthContext(): Promise<StaffAuthContext>;
  /** Drops the cached context and rebuilds it. Call after changing clinic or access data. */
  refreshAuthContext(): Promise<StaffAuthContext>;
  getCurrentUser(role?: UserRole): Promise<UserRecord>;
  loginAsRole(role: UserRole): Promise<UserRecord>;
  logout(): Promise<void>;
}
