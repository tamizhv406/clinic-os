# Phase 9 - Pharmacy Backend

## Scope

Phase 9 replaces the pharmacy inventory, stock movement, prescription queue, dispensing, and low-stock alert workflows with Supabase-backed data.

Out of scope and still mocked: billing, reports, real WhatsApp API, payments, refunds, webhooks, and settlements.

## Tables

- `medicines`: clinic-scoped medicine master data.
- `medicine_stock_batches`: batch-level stock, expiry, supplier, and price data.
- `stock_movements`: immutable stock movement log for adjustments and dispensing.
- `pharmacy_orders`: queue/order header created from routed prescriptions.
- `pharmacy_order_items`: dispense lines linked to prescription items and stock batches.
- `low_stock_alerts`: active/resolved low-stock alert records.

All tables include `clinic_id`. Branch-scoped stock/order rows also include `branch_id`.

## RLS

RLS is enabled on all Phase 9 tables.

- `super_admin` can manage all pharmacy data.
- Clinic staff can read own-clinic pharmacy records when their modules/permissions allow it.
- Pharmacist/owner-style users can manage pharmacy records using `pharmacy.*` permissions.
- Doctor/receptionist-style access is limited to routed prescription/order summary reads when prescription permissions allow it.
- Unauthenticated users have no access policies.

## RPCs

- `create_pharmacy_order_from_prescription(prescription_id uuid)`
  - Requires an active staff profile and routed prescription.
  - Creates one idempotent pharmacy order per prescription.
  - Creates pharmacy order items from prescription items.
  - Updates `prescriptions.pharmacy_status` to `received`.
  - Writes a prescription delivery log.

- `dispense_pharmacy_order(input jsonb)`
  - Reduces stock batch quantities.
  - Blocks negative stock.
  - Blocks expired/inactive batches.
  - Updates order item and order status.
  - Updates prescription pharmacy status.
  - Writes stock movements and delivery log.

- `adjust_medicine_stock(input jsonb)`
  - Adjusts an existing stock batch.
  - Blocks negative stock.
  - Writes a stock movement.
  - Refreshes low-stock alerts.

- `refresh_low_stock_alerts(clinic_id uuid, branch_id uuid default null)`
  - Creates/updates active alerts for stock below reorder level.
  - Resolves alerts when stock is replenished.

## Service Methods

`services.pharmacy` now supports:

- `getMedicines`
- `getMedicineById`
- `createMedicine`
- `updateMedicine`
- `getStockBatches`
- `addStockBatch`
- `adjustStock`
- `getPharmacyQueue`
- `createOrderFromPrescription`
- `dispenseOrder`
- `getLowStockAlerts`
- `refreshLowStockAlerts`
- `getStockMovements`
- Legacy-compatible `getInventory`
- Legacy-compatible `getPharmacyOrders`

## Frontend

Connected to Supabase:

- Pharmacy dashboard stock/queue summaries.
- Medicine stock page.
- Add medicine + initial batch.
- Stock adjustment.
- Purchase entry batch creation.
- Low-stock page.
- Expiry alerts page.
- Prescription queue/order creation from routed prescriptions.
- Dispense available stock from an order.

Still placeholder/mock:

- Billing and counter-sale flow.
- Recent purchase-entry display history.
- Payment status and bill creation.
- Real WhatsApp billing/prescription messages.
- Reports.

## Testing Checklist

- `supabase db push`
- Regenerate Supabase types.
- `npm run build` from `frontend`
- Create medicine.
- Add stock batch.
- Route prescription to pharmacy.
- Open prescription queue and create/sync order.
- Dispense medicine.
- Verify batch stock reduces.
- Verify negative stock is blocked.
- Verify expired batches cannot be dispensed.
- Refresh low-stock alerts and verify active alert rows.
- Confirm unauthenticated users cannot read pharmacy tables.
