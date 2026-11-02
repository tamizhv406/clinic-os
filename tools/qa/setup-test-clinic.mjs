// Idempotent: gives the "TEST Metro Health - Jayanagar" clinic a doctor, receptionist
// and pharmacist through the real create-staff Edge Function (as the platform admin).
import { asUser, api, SUPABASE_URL, ANON_KEY, TEST_PASSWORD } from "../admin/_env.mjs";

const sa = await asUser("super_admin@vernex.test");
const clinic = (await api("/rest/v1/clinics?select=id&slug=eq.test-metro-jayanagar")).json[0];
if (!clinic) throw new Error("Run multi-clinic.mjs first.");

const people = [
  { email: "doctor@testjay.test", full_name: "Dr Meera Rao", role_key: "doctor", specialization: "General Medicine", department: "General", qualification: "MBBS, MD", consultation_fee: 500, slot_duration_minutes: 15 },
  { email: "reception@testjay.test", full_name: "Kavya Reception", role_key: "receptionist" },
  { email: "pharmacist@testjay.test", full_name: "Ravi Pharmacist", role_key: "pharmacist" },
];
for (const p of people) {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/create-staff`, {
    method: "POST",
    headers: { apikey: ANON_KEY, Authorization: `Bearer ${sa.token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ ...p, password: TEST_PASSWORD, clinic_id: clinic.id }),
  });
  const body = await res.json().catch(() => ({}));
  console.log(p.email.padEnd(28), res.status, res.status === 201 ? body.staff_code : body.error);
}
