# Phase 10 - Billing and Invoices Backend

## Scope

Phase 10 replaces mock billing/invoice flows with Supabase-backed invoices, invoice items, manual payment records, invoice status history, receipts, and billing history.

This phase does not implement real payments, payment gateways, refunds, webhooks, settlements, reports, real WhatsApp API, or production monitoring.

## Tables

- `invoices`: clinic-scoped invoice header with patient, appointment, consultation, prescription, and pharmacy order links.
- `invoice_items`: invoice line items and calculated line totals.
- `manual_payment_records`: manual cash/UPI/card/online-link payment records only.
- `invoice_status_history`: status and payment-status audit trail.

All tables include `clinic_id`. Branch-aware rows include `branch_id`.

## RLS

RLS is enabled on all Phase 10 tables.

- `super_admin` can manage all billing records.
- Clinic staff can read own-clinic billing records when billing permissions allow.
- Owner/receptionist-style users can create/manage invoices with `billing.*` permissions.
- Pharmacists can create pharmacy invoices with pharmacy billing/manage permissions.
- Doctors can only view billing summaries when billing/prescription permissions allow.
- Unauthenticated users have no access policies.

## RPCs

- `create_invoice_with_items(input jsonb)`
  - Generates `invoice_number`.
  - Calculates subtotal, discount, tax, total, paid, and balance.
  - Sets `payment_status`: `unpaid`, `partial`, or `paid`.
  - Creates initial manual payment record when `paid_amount > 0`.
  - Adds invoice status history.

- `record_manual_payment(input jsonb)`
  - Blocks payment on cancelled invoices.
  - Blocks payment amount greater than current balance.
  - Updates paid amount, balance, and payment status.
  - Adds manual payment record and history row.

- `cancel_invoice(invoice_id uuid, reason text)`
  - Sets invoice status to `cancelled`.
  - Records cancellation metadata and history.
  - Cancelled invoices cannot receive later manual payment.

- `create_invoice_from_pharmacy_order(pharmacy_order_id uuid)`
  - Creates an idempotent pharmacy invoice from pharmacy order items.
  - Does not collect real payment.

## Service Methods

`services.billing` now supports:

- `getInvoices`
- `getInvoiceById`
- `getInvoicesByPatient`
- `createInvoice`
- `createInvoiceFromPharmacyOrder`
- `recordManualPayment`
- `cancelInvoice`
- `getInvoiceStatusHistory`
- `getManualPayments`
- legacy-compatible `getPayments`

## Frontend

Connected to Supabase:

- Billing dashboard invoice/pending-payment summaries.
- Invoice list and invoice preview.
- Create Bill.
- Pending Payments manual payment modal.
- Receipts from manual payment records.
- Pharmacy queue create-invoice placeholder.

Still mocked/placeholders:

- Reports charts/top services.
- Refund pages/workflows.
- Real payment links.
- WhatsApp receipt/payment messages.
- PDF generation.

## Manual Payment Rules

- Manual payment only.
- No gateway calls.
- Amount must be greater than zero.
- Amount cannot exceed invoice balance.
- Cancelled invoices reject payment.
- Status moves to `partial` or `paid` based on remaining balance.
- Every payment/status change adds history.

## Testing Checklist

- `supabase db push`
- Regenerate Supabase types.
- `npm run build` from `frontend`
- Create invoice with one or more items.
- Verify totals and payment status.
- Record manual payment.
- Verify unpaid/partial/paid transitions.
- Cancel invoice.
- Verify cancelled invoice blocks payment.
- Create pharmacy invoice from pharmacy order when available.
- Verify invoice status history rows.
- Verify manual payment records become receipts.
