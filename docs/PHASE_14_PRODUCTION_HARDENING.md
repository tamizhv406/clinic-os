# Phase 14 - Production Hardening

Phase 14 hardens the existing app without adding business modules.

## Env Safety

- Frontend env uses only Vite-exposed public keys:
  - `VITE_SUPABASE_URL`
  - `VITE_SUPABASE_ANON_KEY`
  - optional disabled placeholders such as `VITE_RAZORPAY_KEY` and `VITE_WHATSAPP_PROVIDER`
- Removed `SUPABASE_SERVICE_ROLE_KEY` from `frontend/.env`.
- `frontend/.env.example` is safe and contains no secrets.
- Root `.gitignore` ignores `.env`, `.env.local`, and `.env.*.local`.
- Added `.env.server.example` for server/admin scripts that may need service-role credentials.

## RLS Review Result

- Phase 1-13 application tables use RLS policies.
- No table-level anonymous policies were found for business data.
- `resolve_staff_login_email` remains callable by `anon` intentionally for staff-ID login resolution.
- Clinic data policies scope staff access through `current_clinic_id()`.
- Super admin policies are centralized through `is_super_admin()`.
- Write policies remain permission-gated for operational modules.
- Audit/monitoring logs remain append-only for normal staff.

## Security Fixes

- Tightened audit/monitoring insert policies so non-super-admin users can append only clinic-scoped rows.
- Normal users still have no update/delete policies for log tables.
- Protected layout now redirects to login when session context is missing instead of showing an endless loading state.

## Data Integrity

- Existing migrations already include important FKs, status checks, `updated_at` triggers, stock/payment non-negative checks, invoice balance/payment constraints, and expired stock dispense blocking.
- Added production indexes for common filtered views:
  - patients by clinic/status
  - appointments by clinic/date/status
  - invoices by clinic/created date
  - audit logs by clinic/created date

## Frontend Hardening

- Kept route/module guards intact.
- Preserved UI/routes/styling.
- Monitoring continues through `services.monitoring` with mock fallback.
- No real WhatsApp API, payment gateway, refunds, webhooks, settlements, or external monitoring service were added.

## Performance Notes

- Added targeted DB indexes for high-use filters.
- Monitoring page already limits reads to recent rows.
- Existing Vite large-chunk warning remains noted; no risky bundling refactor was made in this phase.

## Remaining Risks

- Client-side Vite env variables are public by design; only anon/public placeholders should be used there.
- Staff-ID email resolution is intentionally anonymous and should be rate-limited server-side before public production launch.
- Full RLS testing should be repeated with real owner/staff/super-admin accounts.

## Phase 15 Validation Checklist

- Run role-based RLS tests for super admin, owner, receptionist, doctor, and pharmacist.
- Verify service-role credentials exist only in server/admin runtime.
- Enable production CSP/security headers at hosting layer.
- Add backup/restore drill.
- Add rate limiting for public auth helpers.
