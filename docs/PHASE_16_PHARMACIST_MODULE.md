# Phase 16 — Pharmacist module: fix, rebuild and demo-ready

Specification: [`docs/tasks/PHARMACIST_MODULE_TASK.pdf`](tasks/PHARMACIST_MODULE_TASK.pdf) (Tasks 1–10).

> **Status.** All code and migrations are written. Nothing in this phase has been
> applied to a hosted Supabase project by the developer; every database change was
> verified on a local, in-memory PostgreSQL (see [Verification](#verification)).
> Signed-in browser testing and realtime delivery have **not** been demonstrated yet.

---

## 1. Root causes found

| # | Problem | Cause | Fixed in |
|---|---|---|---|
| F1 | Pharmacist could not open Medicine Stock / Purchase Entry | Role `pharmacist` was never granted `pharmacy.manage` | `20261013120000_pharmacist_access_fix.sql` |
| F2 | Fixing role grants alone did not help seeded users | Per-staff rows override role rows (`coalesce(staff, role)`); the seed had copied the old grants | same migration (updates every pharmacist's staff rows) |
| F3 | Pharmacist appeared "logged out" | `ModuleGuard` redirected every denial to `/login` | Access Denied page; only "no session" goes to `/login` |
| F4 | Login failed with "JSON object requested, multiple (or no) rows returned" | `.single()` on a missing staff profile; session left half signed in | `.maybeSingle()`, clear messages, sign-out on failure |
| F5 | Queue and billing missing from the sidebar | Not in `navForRole.pharmacist` | new pharmacist navigation |
| F6 | Prescriptions only reached the pharmacy when the queue page was opened | Orders were created lazily by the page | database trigger + `_ensure_pharmacy_order` |
| F7 | Doctors had to press a separate button; "placeholder" toasts | Complete Consultation never routed | "Send to pharmacy" checkbox (ticked by default) |
| F8 | Stocked medicines showed as unavailable | Exact-name matching only; doctor items had no `medicine_id` | tiered matching; doctor search sends `medicine_id` |
| F9 | Receiving stock replaced batch quantities | Client `upsert` with `quantity_available: item.quantity`, no transaction | `create_stock_purchase` RPC (adds, atomic) |
| F10 | No Excel/CSV upload | — | Add Stock → Excel / CSV tab (SheetJS 0.20.3) |
| F11 | One request per medicine on several pages | `getMedicineById` in a loop | `getMedicineCatalog()` (one query) |
| F12 | Garbled characters on login / WhatsApp panel | Mojibake | fixed text |

Additional defects found and fixed while doing this work (not in the brief):

| Problem | Effect | Fixed in |
|---|---|---|
| `refresh_low_stock_alerts` (phase 9) always failed: its parameters `clinic_id`/`branch_id` made `ON CONFLICT (medicine_id, branch_id, status)` ambiguous (error 42702) | **Every** stock adjustment and dispense failed, and the Low Stock page could not load | `20261013120500_fix_low_stock_alert_refresh.sql` (same signature) |
| The same function could not resolve an alert twice (unique key on `status`) | Errors once a medicine recovered a second time | same migration |
| `route_prescription_to_pharmacy` reset any status to `sent_to_pharmacy` | A dispensed prescription could look unsent again | `20261013122000_prescription_pharmacy_flow.sql` |
| `dispense_pharmacy_order` compared expiry with the server's UTC date; allowed dispensing more than prescribed and on cancelled orders | Expired stock dispensable for up to 5½ hours after midnight IST; over-dispensing | same migration |
| `create_invoice_from_pharmacy_order` billed every item (1 unit of undispensed/unavailable items) | Wrong bills | same migration (bills dispensed quantities only) |
| Counter Billing created an invoice with client-typed prices and never reduced stock | Stock and revenue disagreed | `create_pharmacy_counter_sale` RPC |
| Purchase entry form cleared everything even when saving failed | Lost data entry | rewritten form keeps input on failure |
| Medicine mapper showed the selling price as MRP; several pages used UTC for "today" | Wrong MRP; wrong day 00:00–05:30 IST | `supabaseMappers.ts`, `localDateISO()` |
| Doctor "Save Prescription" twice created two prescriptions | Duplicates | builder refuses to save twice |
| ESLint could not run (no `eslint.config.js`), 35 existing lint errors | — | flat config added, errors fixed (Task 2) |

---

## 2. Migrations (apply in this order)

All are new files, idempotent (`create or replace`, `if not exists`, `on conflict`), and safe to re-run.

| File | Contents |
|---|---|
| `20261013120000_pharmacist_access_fix.sql` | Pharmacist role + every pharmacist staff member: modules `dashboard, pharmacy, prescriptions, billing`; permissions `pharmacy.view/create/edit/manage/dispense/bill/export`, `prescriptions.view`, `billing.view/create/bill`, `dashboard.view`. Nothing revoked; other roles untouched. |
| `20261013120500_fix_low_stock_alert_refresh.sql` | Fixed `refresh_low_stock_alerts` (see above) and internal `_low_stock_candidates`. |
| `20261013121000_pharmacy_stock_intake.sql` | `stock_purchases.metadata`, indexes, `create_stock_purchase`, internal parsing helpers. |
| `20261013121500_medicine_batch_status.sql` | `set_medicine_batch_status` (block / unblock). |
| `20261013122000_prescription_pharmacy_flow.sql` | `_ensure_pharmacy_order`, matching helpers, trigger on `prescriptions`, updated `create_prescription_with_items`, `route_prescription_to_pharmacy`, `dispense_pharmacy_order`, `create_invoice_from_pharmacy_order`; new `mark_pharmacy_order_item_unavailable`, `acknowledge_pharmacy_order`; back-fill; `pharmacy_orders` added to `supabase_realtime`. |
| `20261013123000_pharmacy_counter_sale.sql` | `create_pharmacy_counter_sale`. |

Then re-run `supabase/seed/demo_seed.sql` for the demo clinic (it refuses to run until these are applied).

Helper functions whose names start with `_` are internal: `EXECUTE` is revoked from `public`, `anon` and `authenticated`.

---

## 3. RPCs

Every RPC below is `security definer`, `search_path = public`, executable by `authenticated` only (revoked from `anon`). Clinic and branch always come from the **caller's staff profile**, never from the input.

### `create_stock_purchase(input jsonb) → jsonb`
- **Permission:** super admin, or module `pharmacy` and (`pharmacy.manage` or `pharmacy.create`); caller must belong to a clinic.
- **Input:** `supplier_name`*, `supplier_phone`, `invoice_number`*, `purchase_date`* (YYYY-MM-DD, not in the future), `notes`, `source` (`manual`|`excel`), `items`* (1–1000) of `medicine_name`*, `batch_no`*, `expiry_date`* (after today, IST), `quantity`* (whole, 1–1,000,000), `purchase_price`* (≥0), `selling_price`* (≥0, ≤ MRP when MRP>0), `mrp`, `category`, `generic_name`, `manufacturer`, `strength`, `unit`, `hsn_code`, `gst_rate` (0–28), `reorder_level` (whole ≥0).
- **Behaviour:** validates everything first and raises one error listing every bad row (`Row 2: …; Row 5: …`); per-clinic transaction lock; rejects a duplicate supplier + invoice (case/space-insensitive); finds the medicine by trimmed name (case-insensitive) or creates it; fills only empty master fields; reuses an existing batch even if the batch number differs only in case; **adds** to the batch quantity; refuses a `blocked` batch; one `add_stock` movement per item (`reference_type = 'stock_purchase'`); refreshes low-stock alerts; writes an audit row.
- **Output:** `{ purchase_id, items, medicines_created, batches_created, batches_topped_up, total_amount }`.

### `set_medicine_batch_status(input jsonb) → medicine_stock_batches`
- **Permission:** `pharmacy.manage` (or super admin), same clinic.
- **Input:** `batch_id`, `action` (`block`|`unblock`), `reason` (required to block, ≤500).
- **Behaviour:** blocking makes the batch undispensable and unsellable; unblocking restores `expired`, `depleted` or `active` as appropriate; audit row; alert refresh.

### `create_pharmacy_order_from_prescription(prescription_id uuid) → pharmacy_orders`
Unchanged signature. Permission: module `pharmacy` and `pharmacy.dispense`/`manage`/`create`. Calls `_ensure_pharmacy_order`. Used only by the queue page's **Sync** fallback.

### `_ensure_pharmacy_order(prescription_id uuid)` (internal)
Creates the order for a prescription that is sent to pharmacy and not cancelled, then adds any prescription items the order does not have yet (while the order is pending or partially dispensed). Medicine matching, in order, within the clinic's active medicines, preferring one with usable stock: `medicine_id` → exact trimmed name → normalised name (case, spaces, dots, hyphens removed) → name starting with the prescribed text (4+ characters) → generic name. No match or no usable stock ⇒ item `unavailable` with a note saying which. Called by the trigger `prescriptions_sync_pharmacy_order` (insert, or `send_to_pharmacy` turned on), at the end of `create_prescription_with_items` and of `route_prescription_to_pharmacy`.

### `dispense_pharmacy_order(input jsonb) → pharmacy_orders`
Same input `{ order_id, items: [{ order_item_id, batch_id, quantity }] }`. Permission `pharmacy.dispense`/`manage`. Now also refuses: cancelled orders, more than the remaining prescribed quantity, a batch of a different medicine, non-active or expired batches (IST date).

### `mark_pharmacy_order_item_unavailable(input jsonb) → pharmacy_orders`
`{ order_item_id, reason }`. Permission `pharmacy.dispense`/`manage`. When every item is settled the order becomes `dispensed` (if anything was dispensed) or `cancelled` (nothing could be supplied), and the prescription's `pharmacy_status` follows.

### `acknowledge_pharmacy_order(order_id uuid) → prescriptions`
Called when a pharmacist opens an order: `sent_to_pharmacy` → `received`, so the doctor sees "Received".

### `create_invoice_from_pharmacy_order(pharmacy_order_id uuid) → invoices`
Same signature; bills only dispensed quantities at the dispensed batch's selling price; refuses an order with nothing dispensed; returns the existing invoice if there is one.

### `create_pharmacy_counter_sale(input jsonb) → jsonb`
- **Permission:** module `pharmacy` and `pharmacy.bill`/`manage`.
- **Input:** `patient_id`*, `payment_mode` (`cash`|`upi`|`card`|`online_link`), `discount_amount` (bill level), `paid_amount` (default: full total), `notes`, `items`* (1–100) of `medicine_id`*, `quantity`* (whole, 1–10,000), `batch_id` (optional).
- **Behaviour:** prices come from the batches (never the client); stock is allocated FEFO across batches (or from the one chosen batch); expired, blocked or empty batches are never sold; a shortage rejects the whole sale; invoice + one line per batch used (discount spread so lines add up) + payment record + status history + one `dispense` movement per batch (`reference_type = 'pharmacy_counter_sale'`) + alert refresh + audit row, in one transaction. Selling prices are treated as GST-inclusive (tax 0), as existing pharmacy invoices were.
- **Output:** `{ invoice_id, invoice_number, subtotal, discount_amount, total_amount, paid_amount, payment_status, lines }`.

---

## 4. Frontend

| Area | What changed |
|---|---|
| Login & guards | Clear errors, sign-out on failed context, `/login` redirects signed-in users home, **Access Denied** page (`pages/shared/AccessDenied.tsx`). |
| Navigation | Pharmacist: Dashboard, Prescription Queue (live pending badge), Counter Billing, Medicine Stock, Add Stock, Low Stock, Expiry Alerts. Owner/admin: Pharmacy. `/pharmacy/purchase-entry` → `/pharmacy/add-stock?tab=history`. |
| Add Stock (`/pharmacy/add-stock`, `?tab=manual|excel|history`, `?medicine=` pre-fill) | Manual grid (catalogue autocomplete with last prices, "New medicine" fields, expiry as date or month, live totals, Enter adds a row, save disabled while invalid); Excel/CSV upload with template, preview, inline editing, skip-errors, error report; purchase history with drawer and CSV export. |
| Medicine Stock | One row per medicine with expandable batches; filters (search, category, status, expiring within 30/60/90) and sort; CSV export; Edit medicine, Adjust stock, Block/Unblock, movement history (manage only). URL `?status=` / `?expiring=` for dashboard links. |
| Prescription Queue | Tabs Pending / Partially dispensed / Dispensed today / All (`?tab=`); live updates via `usePharmacyQueueLive` (realtime + 30 s poll; "New prescription from Dr. X" toast shown by the sidebar); drawer with allergies banner, FEFO batch per item, editable quantity, Mark unavailable, Dispense, Dispense and create bill (opens the bill), Print dispensing slip; Sync fallback. |
| Doctor | "Send to pharmacy" checkbox (default on); Complete Consultation saves, finalises and sends in one call when not yet saved; medicine search returns `medicine_id` and shows stock; status chip Sent → Received → Dispensed (polled every 30 s). |
| Dashboard | Greeting and IST date; six KPI tiles linking to filtered pages; quick actions; live pending queue, low stock with Reorder, expiring soon, recent movements, top dispensed this week (bar chart), today's bills — each section loads and fails independently. |
| Counter Billing | Only in-stock, unexpired medicines; FEFO or chosen batch; estimate shown, server prices the sale; discount; paid / part paid / not paid; Today's bills. |

Pure, testable modules: `modules/pharmacy/stockImport.ts`, `stockSummary.ts`, `dispensePlan.ts`; shared helpers `utils/formatDate.ts` (`localDateISO`, IST helpers) and `utils/csv.ts` (CSV export with formula-injection protection).

---

## 5. Excel / CSV template

Download from **Add Stock → Excel / CSV upload → Download template** (`vernex_stock_template.xlsx`, sheets *Stock* and *Instructions*). Sample: [`docs/sample-data/pharmacy_stock_upload_sample.csv`](sample-data/pharmacy_stock_upload_sample.csv) (25 rows).

| Column | Required | Also accepted (case/space-insensitive) | Rule |
|---|---|---|---|
| Medicine Name | yes | medicine, item, item name, product, drug | trimmed text |
| Batch No | yes | batch, batch number, batch no., lot | text |
| Expiry Date | yes | expiry, exp, exp date, expiry dt | Excel date, DD-MM-YYYY, DD/MM/YYYY, YYYY-MM-DD, MM/YY, MMM-YY; month-only → last day of the month; must be after today |
| Quantity | yes | qty, units, quantity received | whole number > 0 |
| Purchase Price | yes | rate, cost, purchase rate, ptr | number ≥ 0 |
| Selling Price | yes | sale price, selling rate, price | number ≥ 0, not above MRP |
| MRP | no | m.r.p | number ≥ 0 |
| Generic Name, Category, Manufacturer, Strength, Unit, HSN Code, GST %, Reorder Level | no | generic, company/mfr, form, hsn, gst / tax %, min stock | used for new medicines or empty fields; unknown category → `general` with a warning |

Limits: `.xlsx`, `.xls`, `.csv`; 5 MB; 1000 data rows; the sheet named *Stock*, otherwise the first sheet. One file = one supplier invoice (supplier, invoice number and date are entered on the page). Rows are marked Valid / Warning (new medicine, expiry within 90 days, month-only expiry, category defaulted) / Error; duplicate medicine + batch rows are errors; unknown columns are listed and ignored. Nothing is saved until **Import**, and the import is one atomic `create_stock_purchase` call (`source = 'excel'`).

---

## 6. Deliberate differences from the brief

| Brief | Implemented | Why |
|---|---|---|
| Task 2: reject a clinic that is "not active" | `trial` and `active` clinics may sign in; `suspended`, `expired` and missing clinics are refused | New clinics are created as `trial` and the rest of the app treats trial as operational. **Decision taken by the product owner (Option A).** |
| Task 3: Medicine Stock route permission `view` | as specified, but the route stays pharmacist-only (owners/admins can open Add Stock but not Medicine Stock) | The brief only changed the permission; widening roles was not requested. |
| Task 4: top-up sets batch status `active` | a `blocked` batch (recall / quality hold) is never reactivated; the purchase is rejected | Patient safety. |
| Task 4 | purchase date may not be in the future; purchase and selling price required | Data integrity; the template marks them required. |
| Task 5 History drawer: "batches it created (join `purchase_id`)" | lines come from the purchase's `add_stock` movements (exact quantity received); purchases recorded before Phase 16 fall back to `purchase_id` | `purchase_id` moves to the latest purchase when a batch is topped up, so it cannot show what an older purchase received. |
| Task 7: status Sent → Received → Dispensed | "Received" is set when a pharmacist opens the order (`acknowledge_pharmacy_order`) | Orders are now created instantly, so "order exists" no longer means the pharmacy has seen it. |
| Task 7 | when no prescribed item can be supplied, the order is closed as `cancelled` (doctor sees "Pharmacy could not supply") | Keeps the queue clean and tells the doctor. |
| Task 9 | re-running the seed resets the demo clinic's pharmacy (and removes medicines added during a demo) | Makes the demo repeatable; never touches other clinics. |

---

## 7. Verification

**Ran and passed (this environment):**
- `npm run lint` — 0 errors (13 warnings, all pre-existing, in files outside this work).
- `npm run build` — passes; SheetJS is a separate lazily loaded chunk (main bundle unchanged).
- All migrations applied to a local in-memory PostgreSQL (PGlite) with stand-ins for Supabase `auth`/`storage`, each Phase 16 migration applied twice:
  - Tasks 1 & 4: 38 checks (grants unchanged for other roles; 12 + 50 = 62; failing row changes nothing; one movement per item; every validation rule; permissions; the low-stock bug reproduced and fixed).
  - Task 6: 9 checks. Task 7: 35 checks (end-to-end prescription → order → FEFO dispense → bill, matching tiers, back-fill, realtime publication, permissions). Task 8: 19 checks. Import round trip: sample CSV and template through `create_stock_purchase`.
  - Task 9: 26 checks — seed runs twice with identical results and with only some demo users; every target in the brief's table; every batch quantity equals the sum of its movements.
- Unit checks of the pure modules: `stockImport` 37, `stockSummary` 14, `dispensePlan` 15.
- Earlier (Task 2): signed-out browser checks in Chrome against the real Supabase project (login page, redirects, wrong-credential messages, 375 px).

**Not yet verified:**
- Signed-in use of any page in a browser (no test password was available to the developer).
- Realtime delivery from the hosted Supabase project (needs `20261013122000` applied there).
- The migrations and seed on the hosted project — they have only run locally. PGlite is real PostgreSQL, but Supabase's own `auth.uid()`, RLS context and realtime were simulated.

**To finish acceptance:** apply the six migrations in order on a development/demo project, re-run the seed, then walk through the 5-minute demo below.

---

## 8. Demo steps

See the README section *5-minute pharmacist demo*:
1. Sign in as `VNX-PHAR-001` → dashboard shows 6 pending prescriptions, today's sales, low-stock and expiry tiles.
2. Prescription Queue → open a pending order → allergies, FEFO batches → Dispense and create bill.
3. In another browser, `doctor@vernex.test` completes a consultation with medicines → the pharmacist sees it live.
4. Add Stock → Excel / CSV → Download template, upload the sample CSV → preview → import → tiles update.
5. Add Stock → Manual → receive 100 more of `PCM-A29` → Medicine Stock shows the summed quantity and the movement.
6. Counter Billing → quick sale → appears in Today's bills.
