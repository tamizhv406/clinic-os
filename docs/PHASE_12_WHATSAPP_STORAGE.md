# Phase 12 - WhatsApp Storage + Future Hooks

Phase 12 makes the WhatsApp module storage-backed in Supabase while keeping all messaging as placeholders.

## Scope

- Added Supabase tables for conversations, messages, templates, delivery logs, patient consent, and placeholder webhook events.
- Wired `services.whatsapp` to Supabase with mock fallback.
- Connected dashboard, conversations, templates, and preview send actions to `services.whatsapp`.
- Placeholder sends insert a queued message and a delivery log only.

## Not Included

- No real WhatsApp API calls.
- No real webhook endpoint.
- No payments, payment links, refunds, or gateway logic.
- No provider approval flow.

## Tables

- `whatsapp_conversations`
- `whatsapp_messages`
- `whatsapp_templates`
- `whatsapp_delivery_logs`
- `whatsapp_patient_consents`
- `whatsapp_webhook_events`

## RLS Summary

- `super_admin` can manage all WhatsApp rows.
- Authenticated clinic staff can read rows for their own clinic.
- Owners and receptionists can create/update/delete WhatsApp rows when their WhatsApp permissions allow it.
- Doctors and pharmacists have an explicit helper for related patient-message visibility when patient/prescription/pharmacy permissions allow it.
- No `anon` policies are defined, so unauthenticated access is blocked by RLS.

## Service Behavior

`services.whatsapp` now supports:

- Conversation CRUD and transfer to reception.
- Message CRUD.
- Template CRUD.
- Consent read/upsert.
- Delivery log creation.
- Placeholder webhook event storage.
- Placeholder sends for appointment, prescription, reminder, and invoice.

All placeholder sends mark messages as `queued`, create a delivery log, add `noExternalApi: true` metadata, and never call an external provider.

## UI Behavior

- Conversations and messages persist through Supabase when the user is authenticated and RLS permits writes.
- The conversations screen can create a conversation and queue a placeholder outbound message.
- The template screen can create or update templates.
- If Supabase is unavailable, the module falls back to mock data.

## Future Hooks

- Add a real provider adapter behind the placeholder send methods.
- Add signed webhook endpoint handling separately.
- Add provider template approval/status sync.
- Add automated retry scheduling and operational dashboards.
