import { asUser, api } from "../admin/_env.mjs";
const ph = await asUser("pharmacist@testjay.test");
const r = await ph.rpc("recheck_unavailable_pharmacy_items");
console.log("rpc:", r.status, JSON.stringify(r.json));
const items = await api("/rest/v1/pharmacy_order_items?select=medicine_name,status,notes,medicine_id,requested_quantity&order=created_at.desc&limit=2");
console.log(JSON.stringify(items.json));
const m = await api("/rest/v1/medicines?select=id,name,clinic_id,status&name=eq.Paracetamol500mg");
console.log(JSON.stringify(m.json));
