// Creates the first platform admin on a fresh database (auth login + staff profile).
//
//   node tools/admin/create-super-admin.mjs <email> <password> "<Full Name>"
//
// Needs scrips/.secret.env with SUPABASE_SERVICE_ROLE_KEY and frontend/.env with the
// project URL. Safe to re-run: an existing login is reused and its password is reset.
// Every other account (owners, admins, doctors...) is then created from the app itself,
// signed in as this super admin.
import { api } from "./_env.mjs";

const [email, password, fullName = "Platform Admin"] = process.argv.slice(2);
if (!email || !password) {
  console.error('Usage: node tools/admin/create-super-admin.mjs <email> <password> "<Full Name>"');
  process.exit(1);
}
if (password.length < 8) {
  console.error("Password must be at least 8 characters.");
  process.exit(1);
}

let user = await api("/auth/v1/admin/users", { method: "POST", body: { email, password, email_confirm: true } });
let id = user.json?.id;
if (!user.ok) {
  const all = await api("/auth/v1/admin/users?per_page=1000");
  const existing = all.json?.users?.find((candidate) => candidate.email === email);
  if (!existing) {
    console.error("Could not create the login:", JSON.stringify(user.json));
    process.exit(1);
  }
  id = existing.id;
  await api(`/auth/v1/admin/users/${id}`, { method: "PUT", body: { password, email_confirm: true } });
  console.log("Login already existed; password reset.");
}

const profile = await api("/rest/v1/staff_profiles?on_conflict=id", {
  method: "POST",
  body: { id, clinic_id: null, branch_id: null, role_key: "super_admin", full_name: fullName, user_id: "PLATFORM-001", email, status: "active", metadata: {} },
  headers: { Prefer: "resolution=merge-duplicates,return=representation" },
});
if (!profile.ok) {
  console.error("Could not create the staff profile:", JSON.stringify(profile.json));
  process.exit(1);
}
console.log(`Super admin ready: ${email}. Sign in at /login, then create clinics from "All Clinics".`);
