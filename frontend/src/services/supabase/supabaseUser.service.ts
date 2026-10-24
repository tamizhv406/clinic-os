import { supabase } from "../../lib/supabaseClient";
import type { EntityStatus, ModuleKey, PermissionKey, UserRecord } from "../../shared/types/domain";
import type { Tables } from "../../shared/types/database.types";
import type { UserRole } from "../../types/user";
import type { CreateStaffLoginInput, UserService } from "../interfaces";

type StaffRow = Tables<"staff_profiles">;

function asRole(role: string): UserRole {
  return role as UserRole;
}

function permissionActions(permissionKeys: string[]): PermissionKey[] {
  return Array.from(new Set(permissionKeys.map((key) => key.split(".").pop()).filter(Boolean))) as PermissionKey[];
}

async function getStaffModules(staffId: string) {
  const { data, error } = await supabase.from("staff_modules").select("module_key").eq("staff_id", staffId).eq("enabled", true);
  if (error) throw error;
  return (data ?? []).map((item) => item.module_key as ModuleKey);
}

async function getStaffPermissions(staffId: string) {
  const { data, error } = await supabase.from("staff_permissions").select("permission_key").eq("staff_id", staffId).eq("allowed", true);
  if (error) throw error;
  return (data ?? []).map((item) => item.permission_key);
}

async function getRoleModules(roleKey: string) {
  const { data, error } = await supabase.from("role_modules").select("module_key").eq("role_key", roleKey).eq("enabled", true);
  if (error) throw error;
  return (data ?? []).map((item) => item.module_key as ModuleKey);
}

async function getRolePermissions(roleKey: string) {
  const { data, error } = await supabase.from("role_permissions").select("permission_key").eq("role_key", roleKey).eq("allowed", true);
  if (error) throw error;
  return (data ?? []).map((item) => item.permission_key);
}

async function mapStaff(row: StaffRow): Promise<UserRecord> {
  const staffModules = await getStaffModules(row.id);
  const staffPermissions = await getStaffPermissions(row.id);
  const modules = staffModules.length > 0 ? staffModules : await getRoleModules(row.role_key);
  const permissionKeys = staffPermissions.length > 0 ? staffPermissions : await getRolePermissions(row.role_key);

  return {
    id: row.id,
    userId: row.user_id,
    fullName: row.full_name,
    email: row.email ?? "",
    phone: row.phone ?? "",
    role: asRole(row.role_key),
    clinicId: row.clinic_id ?? undefined,
    branchIds: row.branch_id ? [row.branch_id] : [],
    modules,
    permissions: permissionActions(permissionKeys),
    status: row.status as EntityStatus,
  };
}

// Bulk equivalent of mapStaff: four queries for the whole list instead of up to four
// per row. Same fallback rule -- a staff member's own rows win, otherwise the role
// defaults apply.
async function mapStaffRows(rows: StaffRow[]): Promise<UserRecord[]> {
  if (rows.length === 0) return [];
  const staffIds = rows.map((row) => row.id);
  const roleKeys = Array.from(new Set(rows.map((row) => row.role_key)));

  const [staffModules, staffPermissions, roleModules, rolePermissions] = await Promise.all([
    supabase.from("staff_modules").select("staff_id, module_key").in("staff_id", staffIds).eq("enabled", true),
    supabase.from("staff_permissions").select("staff_id, permission_key").in("staff_id", staffIds).eq("allowed", true),
    supabase.from("role_modules").select("role_key, module_key").in("role_key", roleKeys).eq("enabled", true),
    supabase.from("role_permissions").select("role_key, permission_key").in("role_key", roleKeys).eq("allowed", true),
  ]);
  for (const result of [staffModules, staffPermissions, roleModules, rolePermissions]) {
    if (result.error) throw result.error;
  }

  const groupBy = <T, K extends string>(items: T[] | null, key: (item: T) => string, value: (item: T) => K) => {
    const grouped = new Map<string, K[]>();
    for (const item of items ?? []) grouped.set(key(item), [...(grouped.get(key(item)) ?? []), value(item)]);
    return grouped;
  };

  const modulesByStaff = groupBy(staffModules.data, (item) => item.staff_id, (item) => item.module_key as ModuleKey);
  const permissionsByStaff = groupBy(staffPermissions.data, (item) => item.staff_id, (item) => item.permission_key);
  const modulesByRole = groupBy(roleModules.data, (item) => item.role_key, (item) => item.module_key as ModuleKey);
  const permissionsByRole = groupBy(rolePermissions.data, (item) => item.role_key, (item) => item.permission_key);

  return rows.map((row) => {
    const ownModules = modulesByStaff.get(row.id) ?? [];
    const ownPermissions = permissionsByStaff.get(row.id) ?? [];
    return {
      id: row.id,
      userId: row.user_id,
      fullName: row.full_name,
      email: row.email ?? "",
      phone: row.phone ?? "",
      role: asRole(row.role_key),
      clinicId: row.clinic_id ?? undefined,
      branchIds: row.branch_id ? [row.branch_id] : [],
      modules: ownModules.length > 0 ? ownModules : modulesByRole.get(row.role_key) ?? [],
      permissions: permissionActions(ownPermissions.length > 0 ? ownPermissions : permissionsByRole.get(row.role_key) ?? []),
      status: row.status as EntityStatus,
    };
  });
}

export const supabaseUserService: UserService = {
  async getUsers(clinicId) {
    return this.getStaffUsers(clinicId);
  },

  async getUserById(id) {
    return this.getStaffUserById(id);
  },

  async getStaffUsers(clinicId) {
    let query = supabase.from("staff_profiles").select("*").order("created_at", { ascending: false });
    if (clinicId) query = query.eq("clinic_id", clinicId);
    const { data, error } = await query;
    if (error) throw error;
    return mapStaffRows(data ?? []);
  },

  async getStaffUserById(id) {
    const { data, error } = await supabase.from("staff_profiles").select("*").eq("id", id).single();
    if (error) throw error;
    return mapStaff(data);
  },

  async getStaffNames(ids) {
    const unique = Array.from(new Set(ids.filter(Boolean)));
    if (unique.length === 0) return new Map<string, string>();
    const { data, error } = await supabase.from("staff_profiles").select("id, full_name").in("id", unique);
    if (error) throw error;
    return new Map((data ?? []).map((row) => [row.id, row.full_name]));
  },

  async createStaffProfile(input) {
    const { data, error } = await supabase.from("staff_profiles").insert(input).select("*").single();
    if (error) throw error;
    return mapStaff(data);
  },

  async createStaffLogin(input: CreateStaffLoginInput) {
    const { data, error } = await supabase.functions.invoke("create-staff", { body: input });
    if (error) {
      const response = (error as { context?: Response }).context;
      const body = response ? await response.clone().json().catch(() => null) : null;
      throw new Error(body?.error ?? error.message);
    }
    if (!data?.staff) throw new Error("The staff member was not created.");
    return { staff: await mapStaff(data.staff as StaffRow), staffCode: data.staff_code as string };
  },

  async updateStaffProfile(id, input) {
    const { data, error } = await supabase.from("staff_profiles").update(input).eq("id", id).select("*").single();
    if (error) throw error;
    return mapStaff(data);
  },

  async updateStaffStatus(id, status) {
    const { data, error } = await supabase.from("staff_profiles").update({ status }).eq("id", id).select("*").single();
    if (error) throw error;
    return mapStaff(data);
  },

  async assignStaffModules(staffId, modules) {
    const { error: deleteError } = await supabase.from("staff_modules").delete().eq("staff_id", staffId);
    if (deleteError) throw deleteError;
    if (modules.length > 0) {
      const { error } = await supabase.from("staff_modules").insert(modules.map((module_key) => ({ staff_id: staffId, module_key, enabled: true })));
      if (error) throw error;
    }
    return modules;
  },

  async assignStaffPermissions(staffId, permissions) {
    const { error: deleteError } = await supabase.from("staff_permissions").delete().eq("staff_id", staffId);
    if (deleteError) throw deleteError;
    if (permissions.length > 0) {
      const { error } = await supabase.from("staff_permissions").insert(permissions.map((permission_key) => ({ staff_id: staffId, permission_key, allowed: true })));
      if (error) throw error;
    }
    return permissions;
  },

  getStaffModules,
  getStaffPermissions,

  async updateUserPermissions(id, permissions) {
    const existingModules = await getStaffModules(id);
    const permissionKeys = existingModules.flatMap((module) => permissions.map((permission) => `${module}.${permission}`));
    await this.assignStaffPermissions(id, permissionKeys);
    return this.getStaffUserById(id);
  },
};
