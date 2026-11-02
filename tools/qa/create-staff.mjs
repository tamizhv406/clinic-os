// End-to-end checks of the deployed create-staff Edge Function.
import { asUser, api, SUPABASE_URL, ANON_KEY, TEST_PASSWORD } from "../admin/_env.mjs";
import { ok, summary } from "./check.mjs";

const fn = (user, body) => fetch(`${SUPABASE_URL}/functions/v1/create-staff`, {
  method: "POST",
  headers: { apikey: ANON_KEY, Authorization: `Bearer ${user.token}`, "Content-Type": "application/json" },
  body: JSON.stringify(body),
}).then(async (r) => ({ status: r.status, ok: r.ok, json: await r.json().catch(() => null) }));

const clinics = (await api("/rest/v1/clinics?select=id,slug,organization_id&slug=in.(test-metro-indiranagar,test-metro-whitefield,test-metro-jayanagar,test-solo-care)")).json;
const by = Object.fromEntries(clinics.map((c) => [c.slug, c]));
const W = by["test-metro-whitefield"], J = by["test-metro-jayanagar"], I = by["test-metro-indiranagar"], S = by["test-solo-care"];
const stamp = Date.now().toString(36);

const sa = await asUser("super_admin@vernex.test");
const pw = TEST_PASSWORD;

// super admin creates an owner and a shared admin for a clinic it is not "in"
let r = await fn(sa, { full_name: "FN Owner", email: `fn.owner.${stamp}@testmetro.test`, password: pw, role_key: "owner", clinic_id: W.id });
ok(r.status === 201 && r.json.staff.role_key === "owner" && r.json.staff.clinic_id === W.id, "super admin creates an owner in a chosen clinic", JSON.stringify(r.json));
const sharedEmail = `fn.admin.${stamp}@testmetro.test`;
r = await fn(sa, { full_name: "FN Shared Admin", email: sharedEmail, password: pw, role_key: "admin", clinic_id: I.id, extra_clinic_ids: [W.id, J.id] });
ok(r.status === 201, "super admin creates an admin with extra clinics", JSON.stringify(r.json));
const adminId = r.json?.staff?.id;
const acc = (await api(`/rest/v1/staff_clinic_access?select=clinic_id&staff_id=eq.${adminId}`)).json;
ok(acc.length === 3, "that admin has access to 3 clinics", String(acc.length));
ok(r.json?.staff?.branch_id, "new staff gets the clinic's main branch");

r = await fn(sa, { full_name: "X", email: `x.${stamp}@t.test`, password: pw, role_key: "admin", clinic_id: I.id, extra_clinic_ids: [S.id] });
ok(r.status === 400, "extra clinics from another brand are rejected", JSON.stringify(r.json));
r = await fn(sa, { full_name: "X", email: `x2.${stamp}@t.test`, password: pw, role_key: "doctor" });
ok(r.status === 400, "super admin must name a clinic", JSON.stringify(r.json));
r = await fn(sa, { full_name: "X", email: `x3.${stamp}@t.test`, password: pw, role_key: "super_admin", clinic_id: I.id });
ok(r.status === 400, "cannot create another super admin through the function");

// the shared admin onboards staff in a clinic they have access to
const admin = await asUser(sharedEmail, pw);
r = await fn(admin, { full_name: "FN Doctor", email: `fn.doc.${stamp}@testmetro.test`, password: pw, role_key: "doctor", clinic_id: J.id, specialization: "General Medicine", consultation_fee: 500 });
ok(r.status === 201 && r.json.staff.clinic_id === J.id, "admin creates a doctor in a sibling clinic", JSON.stringify(r.json));
const dp = (await api(`/rest/v1/doctor_profiles?select=clinic_id,consultation_fee&staff_id=eq.${r.json?.staff?.id}`)).json;
ok(dp.length === 1 && dp[0].clinic_id === J.id, "doctor profile created in that clinic", JSON.stringify(dp));
r = await fn(admin, { full_name: "FN Recep", email: `fn.rec.${stamp}@testmetro.test`, password: pw, role_key: "receptionist" });
ok(r.status === 201, "admin creates a receptionist in the active clinic by default", JSON.stringify(r.json));
r = await fn(admin, { full_name: "X", email: `x4.${stamp}@t.test`, password: pw, role_key: "doctor", clinic_id: S.id });
ok(r.status === 403, "admin cannot create staff in another brand's clinic", JSON.stringify(r.json));
r = await fn(admin, { full_name: "X", email: `x5.${stamp}@t.test`, password: pw, role_key: "admin", clinic_id: J.id });
ok(r.status === 400, "admin cannot create another admin", JSON.stringify(r.json));
r = await fn(admin, { full_name: "X", email: sharedEmail, password: pw, role_key: "doctor", clinic_id: J.id });
ok(r.status === 409, "duplicate email is rejected", JSON.stringify(r.json));

const owner = await asUser("owner.whitefield@testmetro.test");
r = await fn(owner, { full_name: "X", email: `x6.${stamp}@t.test`, password: pw, role_key: "doctor" });
ok(r.status === 403, "owner cannot onboard staff", JSON.stringify(r.json));
r = await fetch(`${SUPABASE_URL}/functions/v1/create-staff`, { method: "POST", headers: { apikey: ANON_KEY, "Content-Type": "application/json" }, body: "{}" });
ok(r.status === 401, "no token is rejected");
summary();
