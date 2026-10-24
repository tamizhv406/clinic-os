# Phase 13 - Audit & Monitoring

Phase 13 adds lightweight audit logging, error/security tables, health checks, and an admin monitoring screen.

## Scope

- Extended existing `audit_logs` safely.
- Added monitoring tables for system health, app errors, security events, and background jobs.
- Added `services.monitoring` through `serviceProvider` with Supabase and mock fallback.
- Added audit logging to important persisted actions.
- Added `/monitoring` for super admin and owner review.

## Tables

- `audit_logs`
- `system_health_checks`
- `app_error_logs`
- `security_events`
- `background_job_logs`

## RLS Summary

- `super_admin` can read/manage all logs.
- Owners can read logs for their own clinic when report/settings/staff permissions allow it.
- Authenticated staff can append logs for their own clinic.
- Normal staff have no update/delete policies for logs.
- No anonymous policies are defined.

## Logging Helpers

`services.monitoring` exposes:

- `logAuditEvent`
- `logSecurityEvent`
- `logAppError`
- `logHealthCheck`
- `getAuditLogs`
- `getSystemHealth`
- `getErrorLogs`
- `getSecurityEvents`

The local helper in `services/supabase/auditLogger.ts` is used by domain services and swallows logging failures so business actions are not blocked.

## Audit Integrations

- Login/logout and failed login security event.
- Patient create/update.
- Appointment create/status change/cancel.
- Consultation complete.
- Prescription create and WhatsApp placeholder send.
- Pharmacy stock adjustment and dispense.
- Invoice create/payment/cancel.
- WhatsApp placeholder send.

## Exclusions

- No real WhatsApp API.
- No external monitoring provider.
- No payments/refunds/webhook implementation.
- No noisy UI-click tracking.

## Future Work

- Add server-side request IP capture.
- Add dashboards for background job duration and retry counts.
- Add alert thresholds and notification routing.
- Add export/download for super admin investigations.
