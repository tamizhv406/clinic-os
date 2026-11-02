// whatsapp-dispatch -- sends queued outbound WhatsApp messages.
//
// The app already writes every outbound message to public.whatsapp_messages with
// status 'queued' (appointment confirmations, prescriptions, reminders, invoices).
// This function is the missing last step: it takes those rows and hands them to a
// provider, then records what happened. Nothing else in the app needs to change when
// a clinic goes live -- only this function's secrets.
//
// Provider is chosen by the WHATSAPP_PROVIDER secret:
//   simulator   (default) nothing leaves Supabase; messages are marked delivered and
//               flagged simulated, so every screen can be demoed and tested safely.
//   meta_cloud  WhatsApp Business Platform (Cloud API). Needs WHATSAPP_ACCESS_TOKEN and
//               WHATSAPP_PHONE_NUMBER_ID, plus approved templates for any message sent
//               outside the 24-hour customer-service window.
//
// Identity comes from the caller's token, never from the body. A caller can only
// dispatch messages that belong to their own clinic.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const ALLOWED_ROLES = ["owner", "admin", "receptionist", "doctor", "pharmacist"];
const BATCH_LIMIT = 25;
const GRAPH_VERSION = Deno.env.get("WHATSAPP_GRAPH_VERSION") ?? "v21.0";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

// Indian numbers are stored as typed (9876543210, +91 98765 43210...). The Cloud API
// wants digits with the country code and no plus sign.
function toWhatsAppNumber(phone: string) {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10) return `91${digits}`;
  if (digits.length === 11 && digits.startsWith("0")) return `91${digits.slice(1)}`;
  return digits;
}

type Message = {
  id: string;
  clinic_id: string;
  branch_id: string | null;
  conversation_id: string | null;
  patient_id: string | null;
  phone_number: string;
  body: string;
  template_id: string | null;
  payload: Record<string, unknown> | null;
};
type SendResult = { ok: true; providerMessageId: string; simulated: boolean } | { ok: false; error: string };

async function sendViaSimulator(): Promise<SendResult> {
  return { ok: true, providerMessageId: `sim_${crypto.randomUUID()}`, simulated: true };
}

async function sendViaMetaCloud(message: Message, template: { provider_template_id: string | null } | null): Promise<SendResult> {
  const token = Deno.env.get("WHATSAPP_ACCESS_TOKEN");
  const phoneNumberId = Deno.env.get("WHATSAPP_PHONE_NUMBER_ID");
  if (!token || !phoneNumberId) return { ok: false, error: "WhatsApp is not configured (missing access token or phone number id)." };

  const to = toWhatsAppNumber(message.phone_number);
  const variables = Array.isArray(message.payload?.template_variables) ? (message.payload!.template_variables as unknown[]).map(String) : [];
  const body = template?.provider_template_id
    ? {
        messaging_product: "whatsapp",
        to,
        type: "template",
        template: {
          name: template.provider_template_id,
          language: { code: String(message.payload?.language ?? "en") },
          components: variables.length ? [{ type: "body", parameters: variables.map((text) => ({ type: "text", text })) }] : [],
        },
      }
    : { messaging_product: "whatsapp", to, type: "text", text: { body: message.body } };

  const response = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${phoneNumberId}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) return { ok: false, error: result?.error?.message ?? `WhatsApp API returned ${response.status}.` };
  const id = result?.messages?.[0]?.id;
  return id ? { ok: true, providerMessageId: id, simulated: false } : { ok: false, error: "WhatsApp API did not return a message id." };
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (request.method !== "POST") return json({ error: "Use POST." }, 405);

  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!url || !serviceKey || !anonKey) return json({ error: "Function is missing its Supabase environment." }, 500);

  const authHeader = request.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) return json({ error: "Missing bearer token." }, 401);
  const caller = createClient(url, anonKey, { global: { headers: { Authorization: authHeader } }, auth: { persistSession: false } });
  const { data: userData, error: userError } = await caller.auth.getUser();
  if (userError || !userData?.user) return json({ error: "Your session is not valid. Sign in again." }, 401);

  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
  const { data: profile } = await admin.from("staff_profiles").select("id, clinic_id, role_key, status").eq("id", userData.user.id).maybeSingle();
  if (!profile || profile.status !== "active" || !profile.clinic_id) return json({ error: "No active clinic profile." }, 403);
  if (!ALLOWED_ROLES.includes(profile.role_key)) return json({ error: "Your role cannot send messages." }, 403);

  const input = await request.json().catch(() => ({}));
  const ids: string[] | null = Array.isArray(input?.message_ids) ? input.message_ids.slice(0, BATCH_LIMIT) : null;

  let query = admin
    .from("whatsapp_messages")
    .select("id, clinic_id, branch_id, conversation_id, patient_id, phone_number, body, template_id, payload")
    .eq("clinic_id", profile.clinic_id)
    .eq("direction", "outbound")
    .eq("status", "queued")
    .order("created_at", { ascending: true })
    .limit(BATCH_LIMIT);
  if (ids) query = query.in("id", ids);
  const { data: messages, error: listError } = await query;
  if (listError) return json({ error: listError.message }, 500);

  const provider = (Deno.env.get("WHATSAPP_PROVIDER") ?? "simulator").toLowerCase();
  if (provider !== "simulator" && provider !== "meta_cloud") return json({ error: `Unknown WHATSAPP_PROVIDER "${provider}".` }, 500);

  const results: { id: string; status: string; error?: string }[] = [];
  for (const message of (messages ?? []) as Message[]) {
    // Respect opt-outs. Unknown consent is allowed (transactional appointment messages).
    const { data: consent } = await admin
      .from("whatsapp_patient_consents")
      .select("consent_status")
      .eq("clinic_id", message.clinic_id)
      .eq("phone_number", message.phone_number)
      .maybeSingle();
    let outcome: SendResult;
    if (consent && (consent.consent_status === "opted_out" || consent.consent_status === "revoked")) {
      outcome = { ok: false, error: "The patient has opted out of WhatsApp messages." };
    } else if (provider === "simulator") {
      outcome = await sendViaSimulator();
    } else {
      const template = message.template_id
        ? (await admin.from("whatsapp_templates").select("provider_template_id").eq("id", message.template_id).maybeSingle()).data
        : null;
      outcome = await sendViaMetaCloud(message, template);
    }

    const status = outcome.ok ? (outcome.simulated ? "delivered" : "sent") : "failed";
    await admin
      .from("whatsapp_messages")
      .update({
        status,
        delivery_status: status,
        provider_message_id: outcome.ok ? outcome.providerMessageId : null,
        metadata: outcome.ok ? { provider, simulated: outcome.simulated } : { provider, error: outcome.error },
      })
      .eq("id", message.id);
    await admin.from("whatsapp_delivery_logs").insert({
      clinic_id: message.clinic_id,
      branch_id: message.branch_id,
      conversation_id: message.conversation_id,
      message_id: message.id,
      patient_id: message.patient_id,
      phone_number: message.phone_number,
      delivery_status: status,
      provider_message_id: outcome.ok ? outcome.providerMessageId : null,
      metadata: outcome.ok ? { provider, simulated: outcome.simulated } : { provider, error: outcome.error },
      created_by: profile.id,
    });
    results.push({ id: message.id, status, ...(outcome.ok ? {} : { error: outcome.error }) });
  }

  return json({
    provider,
    processed: results.length,
    sent: results.filter((r) => r.status !== "failed").length,
    failed: results.filter((r) => r.status === "failed").length,
    results,
  });
});
