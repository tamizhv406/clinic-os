import { api } from "../admin/_env.mjs";
const c = (await api("/rest/v1/clinics?select=id&slug=eq.test-metro-jayanagar")).json[0].id;
const show = async (label, path) => console.log(label, JSON.stringify((await api(path)).json));
await show("appointments", `/rest/v1/appointments?select=token_number,appointment_date,status,payment_status&clinic_id=eq.${c}&order=created_at`);
await show("consultations", `/rest/v1/consultations?select=status,completed_at&clinic_id=eq.${c}`);
await show("prescriptions", `/rest/v1/prescriptions?select=status,pharmacy_status&clinic_id=eq.${c}`);
await show("invoices", `/rest/v1/invoices?select=invoice_number,total_amount,payment_status,paid_amount,invoice_type,consultation_id&clinic_id=eq.${c}`);
