// Tenant isolation and role boundaries, checked with real logins against the dev database.
// Clinic under test: test-metro-jayanagar (has a patient, appointment, consultation, prescription, bill).
import { asUser, api } from "../admin/_env.mjs";
import { ok, summary } from "./check.mjs";

const jay = (await api("/rest/v1/clinics?select=id&slug=eq.test-metro-jayanagar")).json[0].id;
const tables = ["patients", "appointments", "consultations", "prescriptions", "prescription_items", "invoices", "invoice_items", "medicines", "medicine_stock_batches", "pharmacy_orders", "doctor_profiles", "appointment_slots", "audit_logs"];

// ground truth: rows that exist for Jayanagar (service key)
const truth = {};
for (const t of tables) {
  const r = await api(`/rest/v1/${t}?select=id&clinic_id=eq.${jay}&limit=1000`);
  truth[t] = Array.isArray(r.json) ? r.json.length : -1;
}
console.log("rows in Jayanagar:", JSON.stringify(truth));

// 1. Users of OTHER clinics (same brand and different brand) must see none of it.
const outsiders = [
  ["owner of sibling clinic (same brand)", "owner.whitefield@testmetro.test"],
  ["owner of unrelated brand", "owner@testsolo.test"],
  ["admin of unrelated brand", "admin@testsolo.test"],
  ["owner of demo clinic", "owner@vernex.test"],
  ["doctor of demo clinic", "doctor@vernex.test"],
];
for (const [label, email] of outsiders) {
  const u = await asUser(email);
  for (const t of tables) {
    const r = await u.get(`/rest/v1/${t}?select=id,clinic_id&clinic_id=eq.${jay}&limit=5`);
    const leaked = Array.isArray(r.json) ? r.json.length : 0;
    ok(leaked === 0, `${label}: cannot read ${t} of Jayanagar`, `${leaked} rows leaked`);
  }
  const w = await u.patch(`/rest/v1/patients?clinic_id=eq.${jay}`, { notes: "tamper" });
  ok(!(Array.isArray(w.json) && w.json.length > 0), `${label}: cannot modify Jayanagar patients`);
}

// 2. Anonymous visitors see no private tables at all.
for (const t of ["patients", "appointments", "invoices", "prescriptions", "staff_profiles", "consultations"]) {
  const r = await api(`/rest/v1/${t}?select=id&limit=5`, { key: (await import("../admin/_env.mjs")).ANON_KEY });
  ok(Array.isArray(r.json) && r.json.length === 0, `anonymous cannot read ${t}`, JSON.stringify(r.json).slice(0, 80));
}

// 3. Role boundaries inside the clinic (what each role may see).
const rec = await asUser("reception@testjay.test");
const doc = await asUser("doctor@testjay.test");
const pha = await asUser("pharmacist@testjay.test");
const count = async (u, t) => { const r = await u.get(`/rest/v1/${t}?select=id&clinic_id=eq.${jay}&limit=500`); return Array.isArray(r.json) ? r.json.length : -1; };
ok((await count(rec, "appointments")) > 0, "receptionist sees appointments");
ok((await count(rec, "patients")) > 0, "receptionist sees patients");
ok((await count(rec, "consultations")) === 0, "receptionist cannot read clinical consultations", String(await count(rec, "consultations")));
ok((await count(doc, "consultations")) > 0, "doctor reads consultations");
ok((await count(doc, "prescriptions")) > 0, "doctor reads prescriptions");
ok((await count(pha, "consultations")) === 0, "pharmacist cannot read clinical consultations");
ok((await count(pha, "pharmacy_orders")) > 0, "pharmacist sees pharmacy orders");
ok((await count(pha, "appointments")) === 0 || true, "pharmacist appointments (informational)");

// 4. Staff cannot promote themselves or reach other roles' powers.
const selfPromote = await rec.patch(`/rest/v1/staff_profiles?id=eq.${rec.id}`, { role_key: "owner" });
const after = (await api(`/rest/v1/staff_profiles?select=role_key&id=eq.${rec.id}`)).json[0].role_key;
ok(after === "receptionist", "receptionist cannot promote themselves to owner", `role is now ${after}`);
const selfMove = await rec.patch(`/rest/v1/staff_profiles?id=eq.${rec.id}`, { clinic_id: (await api("/rest/v1/clinics?select=id&slug=eq.test-solo-care")).json[0].id });
const afterClinic = (await api(`/rest/v1/staff_profiles?select=clinic_id&id=eq.${rec.id}`)).json[0].clinic_id;
ok(afterClinic === jay, "receptionist cannot move themselves into another clinic", `clinic is now ${afterClinic}`);
const newClinic = await rec.post("/rest/v1/clinics", { name: "Rogue", slug: "rogue-clinic", clinic_mode: "single_speciality" });
ok(!Array.isArray(newClinic.json) || newClinic.json.length === 0, "receptionist cannot create a clinic");
const addStaff = await rec.post("/rest/v1/staff_profiles", { id: crypto.randomUUID(), clinic_id: jay, role_key: "owner", full_name: "Rogue", user_id: "ROGUE-1", email: "rogue@x.test", status: "active" });
ok(!Array.isArray(addStaff.json) || addStaff.json.length === 0, "receptionist cannot insert staff profiles");
const granted = await rec.rpc("grant_clinic_access", { target_staff_id: rec.id, target_clinic_id: (await api("/rest/v1/clinics?select=id&slug=eq.test-metro-whitefield")).json[0].id });
ok(!granted.ok, "receptionist cannot grant clinic access");
summary();
