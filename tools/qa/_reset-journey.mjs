// Dev helper: closes out leftover test appointments so a fresh journey starts clean.
import { api } from "../admin/_env.mjs";
const c = (await api("/rest/v1/clinics?select=id&slug=eq.test-metro-jayanagar")).json[0].id;
const r = await api(`/rest/v1/appointments?clinic_id=eq.${c}&status=in.(booked,arrived,waiting,in_consultation)`, { method: "PATCH", body: { status: "cancelled" }, headers: { Prefer: "return=representation" } });
console.log("cancelled", Array.isArray(r.json) ? r.json.length : r.json);
const k = await api(`/rest/v1/consultations?clinic_id=eq.${c}&status=eq.draft`, { method: "PATCH", body: { status: "cancelled" }, headers: { Prefer: "return=representation" } });
console.log("consultations cancelled", Array.isArray(k.json) ? k.json.length : k.json);
