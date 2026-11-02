// Multi-clinic / brand model checks, run against the dev database.
import { asUser, api, createStaff } from "../admin/_env.mjs";
import { ok, summary } from "./check.mjs";

const sa = await asUser("super_admin@vernex.test");

// ---- 1. super admin creates a brand with three clinics, and a single-clinic brand
const mk = (name, slug, org) => sa.rpc("create_clinic_with_defaults", {
  clinic_name: name, clinic_slug: slug, clinic_mode: "multi_speciality", clinic_specialty: "General",
  clinic_phone: "+91 80000 00000", clinic_email: `${slug}@test.invalid`, clinic_address: "Bengaluru", ...org,
});
const existing = await api("/rest/v1/clinics?select=slug&slug=like.test-*");
const have = new Set((existing.json || []).map((c) => c.slug));
if (!have.has("test-metro-indiranagar")) {
  const a = await mk("TEST Metro Health - Indiranagar", "test-metro-indiranagar", { new_organization_name: "TEST Metro Health" });
  ok(a.ok && a.json.organization_id, "super admin creates clinic + new brand", JSON.stringify(a.json));
  const metroOrg = a.json.organization_id;
  const b = await mk("TEST Metro Health - Whitefield", "test-metro-whitefield", { for_organization_id: metroOrg });
  const c = await mk("TEST Metro Health - Jayanagar", "test-metro-jayanagar", { for_organization_id: metroOrg });
  ok(b.ok && c.ok, "super admin adds 2 more clinics to the same brand", JSON.stringify([b.json, c.json]));
  const s = await mk("TEST Solo Care Clinic", "test-solo-care", { new_organization_name: "TEST Solo Care" });
  ok(s.ok, "single-clinic brand", JSON.stringify(s.json));
}
const wanted = ["test-metro-indiranagar", "test-metro-whitefield", "test-metro-jayanagar", "test-solo-care"];
const clinics = (await api(`/rest/v1/clinics?select=id,slug,organization_id&slug=in.(${wanted.join(",")})`)).json;
const by = Object.fromEntries(clinics.map((c) => [c.slug, c]));
ok(clinics.length === 4, "4 test clinics exist", String(clinics.length));
ok(by["test-metro-indiranagar"].organization_id === by["test-metro-whitefield"].organization_id, "metro clinics share a brand");
ok(by["test-solo-care"].organization_id !== by["test-metro-indiranagar"].organization_id, "solo clinic is a different brand");
const br = (await api(`/rest/v1/branches?select=clinic_id,is_main&clinic_id=eq.${by["test-metro-whitefield"].id}`)).json;
ok(br.length === 1 && br[0].is_main, "new clinic gets a main branch");
const mods = (await api(`/rest/v1/clinic_modules?select=module_key&clinic_id=eq.${by["test-metro-whitefield"].id}`)).json;
ok(mods.length >= 10, "new clinic has modules enabled", String(mods.length));
ok(!(await mk("dup", "test-solo-care", {})).ok, "duplicate slug is rejected");
ok(!(await mk("x", "Bad Slug!", {})).ok, "invalid slug is rejected");

// ---- 2. fixtures: owner per clinic, one shared admin (service key stands in for create-staff)
const I = by["test-metro-indiranagar"], W = by["test-metro-whitefield"], J = by["test-metro-jayanagar"], S = by["test-solo-care"];
const mainBranch = async (cid) => (await api(`/rest/v1/branches?select=id&clinic_id=eq.${cid}&is_main=eq.true`)).json[0].id;
for (const [slug, c] of [["indiranagar", I], ["whitefield", W], ["jayanagar", J]]) {
  await createStaff({ email: `owner.${slug}@testmetro.test`, fullName: `Owner ${slug}`, role: "owner", clinicId: c.id, branchId: await mainBranch(c.id), code: `TMO-${slug.slice(0, 3).toUpperCase()}-OWN` });
}
await createStaff({ email: "owner@testsolo.test", fullName: "Owner Solo", role: "owner", clinicId: S.id, branchId: await mainBranch(S.id), code: "TSO-OWN-001" });
const sharedId = await createStaff({ email: "admin@testmetro.test", fullName: "Shared Admin", role: "admin", clinicId: I.id, branchId: await mainBranch(I.id), code: "TMA-ADM-001" });
await createStaff({ email: "admin@testsolo.test", fullName: "Solo Admin", role: "admin", clinicId: S.id, branchId: await mainBranch(S.id), code: "TSO-ADM-001" });

// ---- 3. super admin shares the admin across the other two metro clinics
const g1 = await sa.rpc("grant_clinic_access", { target_staff_id: sharedId, target_clinic_id: W.id });
const g2 = await sa.rpc("grant_clinic_access", { target_staff_id: sharedId, target_clinic_id: J.id });
ok(g1.ok && g2.ok, "super admin grants one admin access to 3 clinics", JSON.stringify([g1.json, g2.json]));
ok(!(await sa.rpc("grant_clinic_access", { target_staff_id: sharedId, target_clinic_id: S.id })).ok, "cannot share across brands");

// ---- 4. the shared admin sees and switches between clinics
const admin = await asUser("admin@testmetro.test");
const mine = await admin.rpc("my_clinics");
ok(mine.ok && mine.json.length === 3, "shared admin lists 3 clinics", JSON.stringify(mine.json).slice(0, 200));
ok(mine.json.filter((c) => c.is_active).length === 1, "exactly one clinic is active");
const slugOf = (id) => Object.keys(by).find((k) => by[k].id === id);
for (const c of [W, J, I]) {
  const sw = await admin.rpc("switch_active_clinic", { target_clinic_id: c.id });
  ok(sw.ok, `admin switches to ${slugOf(c.id)}`, JSON.stringify(sw.json));
  const cur = await admin.get("/rest/v1/staff_profiles?select=clinic_id,branch_id&id=eq." + admin.id);
  ok(cur.json[0].clinic_id === c.id && cur.json[0].branch_id, "active clinic and branch updated");
  const seen = await admin.get("/rest/v1/clinics?select=id");
  ok(seen.json.length === 1 && seen.json[0].id === c.id, "admin reads only the active clinic row", String(seen.json.length));
}
ok(!(await admin.rpc("switch_active_clinic", { target_clinic_id: S.id })).ok, "admin cannot switch into another brand's clinic");
const owner = await asUser("owner.whitefield@testmetro.test");
ok(!(await owner.rpc("create_clinic_with_defaults", { clinic_name: "x", clinic_slug: "x-y" })).ok, "owner cannot create clinics");
ok(!(await owner.rpc("grant_clinic_access", { target_staff_id: sharedId, target_clinic_id: J.id })).ok, "owner cannot grant access");

// ---- 5. admin shares one doctor between two clinics
await admin.rpc("switch_active_clinic", { target_clinic_id: W.id });
const docId = await createStaff({ email: "doctor1@testmetro.test", fullName: "Dr Metro One", role: "doctor", clinicId: W.id, branchId: await mainBranch(W.id), code: "TMW-DOC-001" });
const share = await admin.rpc("grant_clinic_access", { target_staff_id: docId, target_clinic_id: J.id });
ok(share.ok, "admin shares a doctor into a sibling clinic", JSON.stringify(share.json));
ok(!(await admin.rpc("grant_clinic_access", { target_staff_id: sharedId, target_clinic_id: J.id })).ok, "admin cannot share another admin");
await admin.rpc("switch_active_clinic", { target_clinic_id: J.id });
const dir = await admin.get("/rest/v1/staff_profiles?select=email,role_key");
ok(dir.json.some((p) => p.email === "doctor1@testmetro.test"), "shared doctor shows in the other clinic's directory", JSON.stringify(dir.json.map((p) => p.email)));
const rev = await admin.rpc("revoke_clinic_access", { target_staff_id: docId, target_clinic_id: J.id });
ok(rev.ok, "admin revokes shared access", JSON.stringify(rev.json));
ok(!(await admin.rpc("revoke_clinic_access", { target_staff_id: docId, target_clinic_id: W.id })).ok, "cannot revoke a person's last clinic");
summary();
