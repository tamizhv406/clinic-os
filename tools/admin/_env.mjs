// Shared helper for local admin scripts. Reads secrets from scrips/.secret.env (git-ignored).
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

const parse = (path) => Object.fromEntries(
  readFileSync(path, "utf8").split(/\r?\n/)
    .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")]; }),
);

const frontendEnv = parse(resolve(root, "frontend/.env"));
const secrets = parse(resolve(root, "scrips/.secret.env"));

export const SUPABASE_URL = frontendEnv.VITE_SUPABASE_URL;
export const ANON_KEY = frontendEnv.VITE_SUPABASE_ANON_KEY;
const SERVICE_KEY = secrets.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_KEY) throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");

export async function api(path, { method = "GET", body, key = SERVICE_KEY, headers = {} } = {}) {
  const res = await fetch(`${SUPABASE_URL}${path}`, {
    method,
    headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json", ...headers },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json; try { json = text ? JSON.parse(text) : null; } catch { json = text; }
  return { status: res.status, ok: res.ok, json };
}

export const TEST_PASSWORD = secrets.TEST_PASSWORD;

// Sign in as a real user and return a client bound to their JWT (so RLS applies).
export async function asUser(email, password = TEST_PASSWORD) {
  const login = await api("/auth/v1/token?grant_type=password", { method: "POST", key: ANON_KEY, body: { email, password } });
  if (!login.ok) throw new Error(`login ${email} failed: ${login.status} ${JSON.stringify(login.json).slice(0, 120)}`);
  const token = login.json.access_token;
  const call = (path, opts = {}) => api(path, { ...opts, key: ANON_KEY, headers: { Authorization: `Bearer ${token}`, ...(opts.headers || {}) } });
  return {
    id: login.json.user.id, email, token,
    get: (path) => call(path),
    rpc: (name, args = {}) => call(`/rest/v1/rpc/${name}`, { method: "POST", body: args }),
    post: (path, body) => call(path, { method: "POST", body, headers: { Prefer: "return=representation" } }),
    patch: (path, body) => call(path, { method: "PATCH", body, headers: { Prefer: "return=representation" } }),
  };
}

// Service-key stand-in for the create-staff Edge Function, used to build fixtures.
// Creates the auth user (or resets an existing one) plus the staff_profiles row.
export async function createStaff({ email, fullName, role, clinicId, branchId = null, code }) {
  let u = await api("/auth/v1/admin/users", { method: "POST", body: { email, password: TEST_PASSWORD, email_confirm: true } });
  let id = u.json?.id;
  if (!u.ok) {
    const all = await api("/auth/v1/admin/users?per_page=200");
    const found = all.json.users.find((x) => x.email === email);
    if (!found) throw new Error(`create user ${email}: ${JSON.stringify(u.json)}`);
    await api(`/auth/v1/admin/users/${found.id}`, { method: "PUT", body: { password: TEST_PASSWORD } });
    id = found.id;
  }
  const row = { id, clinic_id: clinicId, branch_id: branchId, role_key: role, full_name: fullName, user_id: code, email, status: "active", metadata: {} };
  const ins = await api("/rest/v1/staff_profiles?on_conflict=id", { method: "POST", body: row, headers: { Prefer: "resolution=merge-duplicates,return=representation" } });
  if (!ins.ok) throw new Error(`profile ${email}: ${JSON.stringify(ins.json)}`);
  return id;
}
