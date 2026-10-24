# Phase 11 - Reports Backend

## Scope

Phase 11 replaces report/dashboard mock reads with Supabase-backed clinic reports calculated from existing operational tables.

No real WhatsApp API, payments, refunds, webhooks, settlements, production monitoring, or new business modules were added.

## Tables Used

Reports read from:

- `patients`
- `appointments`
- `consultations`
- `prescriptions`
- `pharmacy_orders`
- `medicines`
- `medicine_stock_batches`
- `low_stock_alerts`
- `invoices`
- `invoice_items`
- `manual_payment_records`

Optional cached snapshots use:

- `report_snapshots`

## Snapshot RLS

`report_snapshots` has RLS enabled.

- `super_admin` can manage all snapshots.
- Clinic staff can read own-clinic snapshots with report/billing permissions.
- Owner/admin-style users can generate snapshots with report create/manage/export permissions.
- Unauthenticated users are blocked.

## Report Methods

`services.reports` now supports:

- `getDashboardSummary`
- `getAppointmentReport`
- `getPatientReport`
- `getConsultationReport`
- `getPrescriptionReport`
- `getPharmacyReport`
- `getBillingReport`
- `getRevenueSummary`
- `getLowStockReport`
- `getDoctorPerformanceReport`
- `generateReportSnapshot`
- `getReportSnapshots`
- legacy-compatible `getReports`

## Calculations

Dashboard summary includes:

- total patients
- today appointments
- completed consultations
- pending prescriptions
- pharmacy orders
- low-stock medicines
- total invoices
- paid amount
- pending amount
- revenue by date range

Reports support current clinic context, optional branch, date range, doctor, and status filters where the source table supports those fields.

## Frontend Connected

- Billing Reports page now loads revenue, appointment, doctor performance, pharmacy, and patient reports through `services.reports`.
- Billing Dashboard now loads revenue trend/payment split through `services.reports`.
- Existing export/CSV buttons remain placeholders.

## Remaining Mock Areas

- Follow-up report tab is still based on existing mock follow-up data.
- Reports chart presentation is unchanged.
- Export/CSV remains placeholder.
- Production monitoring is not implemented.

## Testing Checklist

- `supabase db push`
- Regenerate Supabase types.
- `npm run build` from `frontend`
- Verify dashboard loads real billing/revenue counts.
- Verify appointment report.
- Verify patient report.
- Verify billing/revenue report.
- Verify pharmacy/low-stock report.
- Verify snapshot insert/read with RLS-enabled staff users.
