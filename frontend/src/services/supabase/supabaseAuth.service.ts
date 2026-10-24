import type { User } from "@supabase/supabase-js";
import { supabase } from "../../lib/supabaseClient";
import type { EntityStatus, ModuleKey, PermissionKey, UserRecord } from "../../shared/types/domain";
import type { Tables } from "../../shared/types/database.types";
import type { UserRole } from "../../types/user";
import type { AuthService, StaffAuthContext } from "../interfaces";

type StaffProfileRow = Tables<"staff_profiles">;

const roleKeys: UserRole[] = ["owner", "admin", "receptionist", "doctor", "pharmacist", "super_admin"];

function asRole(role: string): UserRole {
  if (roleKeys.includes(role as UserRole)) return role as UserRole;
  throw new Error(`Unsupported staff role: ${role}`);
}

function cacheAuthContext(context: StaffAuthContext) {
  localStorage.setItem("vernex_role", context.role_key);
  localStorage.setItem("vernex_auth", "true");
  window.dispatchEvent(new Event("vernex-role"));
}

function clearAuthCache() {
  localStorage.removeItem("vernex_auth");
  localStorage.removeItem("vernex_role");
  window.dispatchEvent(new Event("vernex-role"));
}

// security_events is not in the generated Database types, so both log tables are
// written through this insert-only view of the client.
const logTables = supabase as unknown as { from: (table: string) => { insert: (row: Record<string, unknown>) => PromiseLike<{ error: unknown }> } };

async function insertAuthLog(table: "audit_logs" | "security_events", input: { userId?: string | null; clinicId?: string | null; branchId?: string | null; actorRole?: string | null; eventType: string; action: string; status: string; severity?: string; message?: string; metadata?: Record<string, unknown> }) {
  await Promise.resolve(logTables.from(table).insert({
    clinic_id: input.clinicId ?? null,
    branch_id: input.branchId ?? null,
    actor_id: input.userId ?? null,
    user_id: input.userId ?? null,
    actor_role: input.actorRole ?? null,
    event_type: input.eventType,
    entity_type: "auth",
    action: input.action,
    status: input.status,
    severity: input.severity ?? "info",
    message: input.message ?? null,
    user_agent: typeof navigator !== "undefined" ? navigator.userAgent : null,
    metadata: input.metadata ?? {},
  })).then(({ error }) => { if (error) throw error; }).catch(() => undefined);
}

async function resolveEmail(userIdOrEmail: string) {
  const login = userIdOrEmail.trim();
  if (login.includes("@")) return login;

  const { data, error } = await supabase.rpc("resolve_staff_login_email", { staff_user_id: login });
  if (error) throw error;
  if (!data) throw new Error("No active staff member with this staff ID.");
  return data;
}

const friendlyAuthErrors: Record<string, string> = {
  "invalid login credentials": "Email/staff ID or password is incorrect.",
  "email not confirmed": "This account has not been confirmed yet.",
};

function friendlyAuthError(message: string) {
  return friendlyAuthErrors[message.trim().toLowerCase()] ?? message;
}

// Clinics in trial are operational everywhere else in the app (booking directory,
// public RPCs), so only suspended or expired clinics are locked out.
const operationalClinicStatuses = ["trial", "active"];

function permissionActions(permissionKeys: string[]): PermissionKey[] {
  return Array.from(new Set(permissionKeys.map((key) => key.split(".").pop()).filter(Boolean))) as PermissionKey[];
}

function toUserRecord(profile: StaffProfileRow, modules: ModuleKey[], permissions: string[]): UserRecord {
  return {
    id: profile.id,
    userId: profile.user_id,
    fullName: profile.full_name,
    email: profile.email ?? "",
    phone: profile.phone ?? "",
    role: asRole(profile.role_key),
    clinicId: profile.clinic_id ?? undefined,
    branchIds: profile.branch_id ? [profile.branch_id] : [],
    modules,
    permissions: permissionActions(permissions),
    status: profile.status as EntityStatus,
  };
}

async function requireSession() {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  if (!data.session) throw new Error("No active Supabase session.");
  return data.session;
}

async function loadCurrentStaffProfile() {
  const session = await requireSession();
  const { data, error } = await supabase.from("staff_profiles").select("*").eq("id", session.user.id).maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("Your account is signed in but not linked to a clinic staff profile. Ask your clinic admin to add you.");
  if (data.status !== "active") throw new Error("Your staff account is inactive.");
  return data;
}

// Building an auth context costs eight round trips, and nearly every service method
// asks for one -- a single dashboard render used to rebuild it a dozen times over.
// Callers share one in-flight request, and the resolved value is reused briefly so
// that a burst of parallel loads pays for it once. The window is short so a module
// or permission change by an admin still lands without a re-login.
const AUTH_CONTEXT_TTL_MS = 60_000;
let cachedContext: { userId: string; expiresAt: number; promise: Promise<StaffAuthContext> } | null = null;

function invalidateAuthContext() {
  cachedContext = null;
}

supabase.auth.onAuthStateChange(() => invalidateAuthContext());

async function buildAuthContext(): Promise<StaffAuthContext> {
  const session = await requireSession();
  const profile = await loadCurrentStaffProfile();
  const role_key = asRole(profile.role_key);

  const [{ data: clinic }, { data: branch }, { data: clinicModules }, { data: staffModules }, { data: roleModules }, { data: staffPermissions }, { data: rolePermissions }] = await Promise.all([
    profile.clinic_id ? supabase.from("clinics").select("*").eq("id", profile.clinic_id).maybeSingle() : Promise.resolve({ data: null }),
    profile.branch_id ? supabase.from("branches").select("*").eq("id", profile.branch_id).maybeSingle() : Promise.resolve({ data: null }),
    profile.clinic_id ? supabase.from("clinic_modules").select("module_key, enabled").eq("clinic_id", profile.clinic_id).eq("enabled", true) : Promise.resolve({ data: [] }),
    supabase.from("staff_modules").select("module_key, enabled").eq("staff_id", profile.id),
    supabase.from("role_modules").select("module_key, enabled").eq("role_key", role_key).eq("enabled", true),
    supabase.from("staff_permissions").select("permission_key, allowed").eq("staff_id", profile.id),
    supabase.from("role_permissions").select("permission_key, allowed").eq("role_key", role_key).eq("allowed", true),
  ]);

  // The clinic row is already fetched here, so the clinic check lives beside it
  // rather than costing loadCurrentStaffProfile() another round trip.
  if (role_key !== "super_admin" && (!clinic || !operationalClinicStatuses.includes(clinic.status))) {
    throw new Error("Your clinic is not active.");
  }

  const clinicModuleSet = new Set((clinicModules ?? []).map((item) => item.module_key));
  const ownModuleRows = staffModules ?? [];
  const baseModules = ownModuleRows.length > 0 ? ownModuleRows.filter((item) => item.enabled).map((item) => item.module_key) : (roleModules ?? []).map((item) => item.module_key);
  const enabledModules = (role_key === "super_admin" ? baseModules : baseModules.filter((key) => clinicModuleSet.has(key))) as ModuleKey[];

  const ownPermissionRows = staffPermissions ?? [];
  const allowedPermissions = ownPermissionRows.length > 0 ? ownPermissionRows.filter((item) => item.allowed).map((item) => item.permission_key) : (rolePermissions ?? []).map((item) => item.permission_key);

  const context: StaffAuthContext = {
    authUserId: session.user.id,
    staffProfileId: profile.id,
    fullName: profile.full_name,
    user_id: profile.user_id,
    email: profile.email,
    phone: profile.phone,
    role_key,
    clinic_id: profile.clinic_id,
    branch_id: profile.branch_id,
    enabledModules,
    allowedPermissions,
    status: profile.status,
    clinic: clinic ?? null,
    branch: branch ?? null,
    session,
  };

  cacheAuthContext(context);
  return context;
}

export const supabaseAuthService: AuthService = {
  async signInWithPassword(userIdOrEmail, password) {
    const email = await resolveEmail(userIdOrEmail);
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      await insertAuthLog("security_events", { eventType: "login_failed", action: "login", status: "recorded", severity: "warning", message: error.message, metadata: { login: userIdOrEmail } });
      throw new Error(friendlyAuthError(error.message));
    }
    if (!data.session) throw new Error("Supabase did not return a session.");
    invalidateAuthContext();
    let context: StaffAuthContext;
    try {
      context = await this.getCurrentAuthContext();
    } catch (contextError) {
      // Never leave the user half signed in: Supabase accepted the password, but
      // there is no usable staff context behind it.
      await insertAuthLog("security_events", { userId: data.session.user.id, eventType: "login_failed", action: "login", status: "recorded", severity: "warning", message: contextError instanceof Error ? contextError.message : "Unable to load staff context.", metadata: { login: userIdOrEmail } });
      await supabase.auth.signOut().catch(() => undefined);
      invalidateAuthContext();
      clearAuthCache();
      throw contextError;
    }
    await insertAuthLog("audit_logs", { userId: context.staffProfileId, clinicId: context.clinic_id, branchId: context.branch_id, actorRole: context.role_key, eventType: "login", action: "login", status: "success", message: "User signed in." });
    cacheAuthContext(context);
    return context;
  },

  async signOut() {
    const context = await this.getCurrentAuthContext().catch(() => null);
    if (context) await insertAuthLog("audit_logs", { userId: context.staffProfileId, clinicId: context.clinic_id, branchId: context.branch_id, actorRole: context.role_key, eventType: "logout", action: "logout", status: "success", message: "User signed out." });
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    invalidateAuthContext();
    clearAuthCache();
  },

  async getSession() {
    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;
    return data.session;
  },

  async getCurrentStaffProfile() {
    return loadCurrentStaffProfile();
  },

  async getCurrentAuthContext() {
    const session = await requireSession();
    const now = Date.now();
    if (cachedContext && cachedContext.userId === session.user.id && cachedContext.expiresAt > now) {
      return cachedContext.promise;
    }
    const promise = buildAuthContext().catch((error) => {
      // Never cache a failure -- the next caller should retry.
      if (cachedContext?.promise === promise) invalidateAuthContext();
      throw error;
    });
    cachedContext = { userId: session.user.id, expiresAt: now + AUTH_CONTEXT_TTL_MS, promise };
    return promise;
  },

  async refreshAuthContext() {
    invalidateAuthContext();
    return this.getCurrentAuthContext();
  },

  async getCurrentUser() {
    const context = await this.getCurrentAuthContext();
    return toUserRecord(await loadCurrentStaffProfile(), context.enabledModules as ModuleKey[], context.allowedPermissions);
  },

  async loginAsRole() {
    throw new Error("Demo role login is disabled. Staff must sign in with Supabase Auth.");
  },

  async logout() {
    await this.signOut();
  },
};

export type { User };
