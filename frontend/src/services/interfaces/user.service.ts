import type { PermissionKey, UserRecord } from "../../shared/types/domain";
import type { ModuleKey } from "../../shared/types/domain";
import type { TablesInsert, TablesUpdate } from "../../shared/types/database.types";

export type CreateStaffLoginInput = {
  full_name: string;
  email: string;
  password: string;
  phone?: string;
  role_key: "doctor" | "receptionist" | "pharmacist";
  branch_id?: string | null;
  user_id?: string;
  department?: string;
  specialization?: string;
  qualification?: string;
  consultation_fee?: number;
  slot_duration_minutes?: number;
};

export interface UserService {
  getUsers(clinicId?: string): Promise<UserRecord[]>;
  getUserById(id: string): Promise<UserRecord>;
  getStaffUsers(clinicId?: string): Promise<UserRecord[]>;
  getStaffUserById(id: string): Promise<UserRecord>;
  /** Batch name lookup for list screens -- one query instead of one per id. */
  getStaffNames(ids: string[]): Promise<Map<string, string>>;
  createStaffProfile(input: TablesInsert<"staff_profiles">): Promise<UserRecord>;
  /** Onboards a staff login via the create-staff Edge Function (admin/super_admin only). */
  createStaffLogin(input: CreateStaffLoginInput): Promise<{ staff: UserRecord; staffCode: string }>;
  updateStaffProfile(id: string, input: TablesUpdate<"staff_profiles">): Promise<UserRecord>;
  updateStaffStatus(id: string, status: string): Promise<UserRecord>;
  assignStaffModules(staffId: string, modules: ModuleKey[]): Promise<ModuleKey[]>;
  assignStaffPermissions(staffId: string, permissions: string[]): Promise<string[]>;
  getStaffModules(staffId: string): Promise<ModuleKey[]>;
  getStaffPermissions(staffId: string): Promise<string[]>;
  updateUserPermissions(id: string, permissions: PermissionKey[]): Promise<UserRecord>;
}
