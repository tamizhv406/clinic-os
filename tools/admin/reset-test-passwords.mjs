// DEV ONLY: sets the shared TEST_PASSWORD on every auth user whose email ends in .test
import { readFileSync } from "node:fs";
import { api, ANON_KEY } from "./_env.mjs";
const pw = readFileSync(new URL("../../scrips/.secret.env", import.meta.url), "utf8").match(/^TEST_PASSWORD=(.*)$/m)[1].trim();
const { json } = await api("/auth/v1/admin/users?per_page=200");
for (const u of json.users.filter((x) => x.email?.endsWith(".test"))) {
  const r = await api(`/auth/v1/admin/users/${u.id}`, { method: "PUT", body: { password: pw, email_confirm: true } });
  const login = await api("/auth/v1/token?grant_type=password", { method: "POST", key: ANON_KEY, body: { email: u.email, password: pw } });
  console.log(u.email.padEnd(40), "reset", r.status, "login", login.status);
}
