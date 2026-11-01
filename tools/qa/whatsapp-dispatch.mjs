// whatsapp-dispatch: queued -> delivered (simulator), opt-out respected, tenant scoped.
import { asUser, api, SUPABASE_URL, ANON_KEY } from "../admin/_env.mjs";
import { ok, summary } from "./check.mjs";

const call = (u, body = {}) => fetch(`${SUPABASE_URL}/functions/v1/whatsapp-dispatch`, {
  method: "POST", headers: { apikey: ANON_KEY, Authorization: `Bearer ${u.token}`, "Content-Type": "application/json" }, body: JSON.stringify(body),
}).then(async (r) => ({ status: r.status, json: await r.json().catch(() => null) }));

const rec = await asUser("reception@testjay.test");
const me = (await rec.get(`/rest/v1/staff_profiles?select=clinic_id&id=eq.${rec.id}`)).json[0];
const mk = async (phone, body) => (await rec.post("/rest/v1/whatsapp_messages", { clinic_id: me.clinic_id, phone_number: phone, direction: "outbound", sender_type: "bot", message_type: "appointment", body, status: "queued", delivery_status: "queued", sent_by: rec.id })).json[0];

const a = await mk("9000000001", "Your slot is reserved. Token A001.");
const b = await mk("9000000002", "Opted-out patient message.");
await api("/rest/v1/whatsapp_patient_consents?on_conflict=clinic_id,phone_number", { method: "POST", body: { clinic_id: me.clinic_id, phone_number: "9000000002", consent_status: "opted_out" }, headers: { Prefer: "resolution=merge-duplicates" } });

const r = await call(rec, { message_ids: [a.id, b.id] });
ok(r.status === 200 && r.json.provider === "simulator", "dispatch runs in simulator mode", JSON.stringify(r.json));
const rows = (await rec.get(`/rest/v1/whatsapp_messages?select=id,status,provider_message_id,metadata&id=in.(${a.id},${b.id})`)).json;
const A = rows.find((x) => x.id === a.id), B = rows.find((x) => x.id === b.id);
ok(A.status === "delivered" && A.provider_message_id?.startsWith("sim_") && A.metadata.simulated === true, "normal message delivered and flagged simulated", JSON.stringify(A));
ok(B.status === "failed" && /opted out/.test(B.metadata.error), "opted-out patient is not messaged", JSON.stringify(B));
const logs = (await rec.get(`/rest/v1/whatsapp_delivery_logs?select=delivery_status&message_id=eq.${a.id}`)).json;
ok(logs.length >= 1 && logs.at(-1).delivery_status === "delivered", "delivery log written");

// another clinic's user cannot dispatch this clinic's messages
const c = await mk("9000000003", "Should only be sendable by its own clinic.");
const other = await asUser("owner@vernex.test");
const x = await call(other, { message_ids: [c.id] });
const still = (await rec.get(`/rest/v1/whatsapp_messages?select=status&id=eq.${c.id}`)).json[0];
ok(x.json?.processed === 0 && still.status === "queued", "other clinic cannot dispatch it", JSON.stringify(x.json));
const doc = await asUser("doctor@testjay.test");
ok((await call(doc, { message_ids: [c.id] })).status === 200, "doctor of the same clinic may dispatch");
ok((await fetch(`${SUPABASE_URL}/functions/v1/whatsapp-dispatch`, { method: "POST", headers: { apikey: ANON_KEY } })).status === 401, "no token rejected");
summary();
