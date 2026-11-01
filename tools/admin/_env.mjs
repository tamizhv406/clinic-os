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
