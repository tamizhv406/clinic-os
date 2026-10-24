# Vernex Clinic OS

A role-based clinic management system for Indian clinics: appointments, consultations,
prescriptions, pharmacy, billing, reports and WhatsApp-first patient booking.

Every screen reads and writes **live Supabase data**. There is no mock layer — the
service registry in `frontend/src/services/serviceProvider.ts` points at Supabase
implementations only, and row-level security scopes every query to the signed-in
staff member's clinic.

---

## Stack

| Layer | Choice |
| --- | --- |
| Frontend | React 19, TypeScript, Vite 6, Tailwind CSS 3 |
| Routing | React Router 7 with lazy routes and module guards |
| Charts | Recharts |
| Forms | React Hook Form + Zod |
| Backend | Supabase (PostgreSQL, Auth, RLS, RPC) |

---

## Architecture

```
frontend/src/
  services/
    interfaces/        typed service contracts (the backend boundary)
    supabase/          the only implementations — one per domain
    serviceProvider.ts single registry every screen imports
  modules/             feature modules: reception, doctor, pharmacy,
                       billing, whatsapp-booking, patient-booking
  access-control/      role, module and permission guards
  shared/types/        domain types + generated database.types.ts
supabase/
  migrations/          schema, RLS policies and RPCs (phases 1-15)
  seed/demo_seed.sql   demo data, safe to re-run
```

**Access control is enforced twice.** The UI hides what a role cannot use
(`ModuleGuard`, `PermissionGuard`), and PostgreSQL RLS independently rejects
anything the UI might have let through. The database is the authority.

**Patients never log in.** They reach the clinic through WhatsApp or the public
booking link. Patient records are clinical data owned by staff.

---

## Setup

### 1. Environment

```bash
cd frontend
cp .env.example .env
```

Fill in from your Supabase project (Settings → API):

```
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon key>
```

`frontend/.env` is git-ignored. Never commit it. The anon key is safe in the
browser precisely because RLS is enforced — do not put the service role key here.

### 2. Database

Apply every migration in `supabase/migrations/` in filename order, either with
the Supabase CLI:

```bash
supabase db push
```

or by pasting each file into the SQL editor. All migrations are idempotent and
safe to re-run.

### 3. Demo data (optional)

Create these users under **Authentication → Users** with *Auto Confirm User*
ticked, all sharing one password:

```
owner@vernex.test        reception@vernex.test    pharmacist@vernex.test
doctor@vernex.test       doctor2@vernex.test      doctor3@vernex.test
super_admin@vernex.test
```

Then run `supabase/seed/demo_seed.sql` (SQL editor, or `psql`). It needs
**every** migration from step 2 applied first, including the Phase 16 pharmacy
migrations (`20261013120000_…` to `20261013123000_…`); it stops with a clear
message if they are missing. It identifies the demo clinic by its slug
(`vernex-demo-clinic`), adopts an existing one if present, re-dates itself around
today and skips any user you chose not to create. Re-running refreshes the data
rather than duplicating it, and resets the demo clinic's pharmacy (stock,
purchases, movements, pharmacy bills) so the demo below can be repeated. It never
touches another clinic.

The pharmacy demo data: 40 medicines, ~70 batches (6 low stock, 3 out of stock,
5 expiring within 30 days, 3 more within 90 days, 3 expired), 8 supplier
purchases over 60 days, ~20 dispensed prescriptions over the last two weeks,
~25 counter sales (at least 5 today) and 6 prescriptions waiting in today's
queue — one with a medicine that is not in the catalogue, one with an
out-of-stock medicine and one partially dispensed.

#### 5-minute pharmacist demo

1. Sign in as `VNX-PHAR-001`. The dashboard shows 6 pending prescriptions,
   today's sales and the low-stock and expiry tiles with real numbers.
2. **Prescription Queue** → open a pending order → see the allergies banner and
   the earliest-expiry (FEFO) batches → **Dispense and create bill**.
3. In another browser, sign in as `doctor@vernex.test`, complete a consultation
   with medicines (keep *Send to pharmacy* ticked) → the pharmacist sees the new
   prescription appear with a toast, without refreshing.
4. **Add Stock → Excel / CSV upload** → *Download template*, then upload
   `docs/sample-data/pharmacy_stock_upload_sample.csv` (enter a supplier and an
   invoice number first) → preview → import → the stock and low-stock tiles update.
5. **Add Stock → Manual entry** → receive 100 more of an existing batch (e.g.
   Paracetamol 650mg, batch `PCM-A29`) → **Medicine Stock** shows the summed
   quantity and the movement in its history.
6. **Counter Billing** → quick sale → it appears under *Today's bills*.

### 4. Run

```bash
cd frontend
npm install
npm run dev     # http://localhost:5173
npm run build   # production build
```

---

## Demo accounts

Sign in with **either the email or the staff ID** — the login screen resolves a
staff ID to its email through the `resolve_staff_login_email` RPC.

| Login | Staff ID | Role | Lands on |
| --- | --- | --- | --- |
| `owner@vernex.test` | `VNX-OWNER-001` | Owner | `/owner/dashboard` |
| `reception@vernex.test` | `VNX-REC-001` | Receptionist | `/reception/dashboard` |
| `doctor@vernex.test` | `VNX-DOC-001` | Doctor · General Medicine | `/doctor/queue` |
| `doctor2@vernex.test` | `VNX-DOC-002` | Doctor · Dental | `/doctor/queue` |
| `doctor3@vernex.test` | `VNX-DOC-003` | Doctor · Dermatology | `/doctor/queue` |
| `pharmacist@vernex.test` | `VNX-PHAR-001` | Pharmacist | `/pharmacy/dashboard` |
| `super_admin@vernex.test` | `VNX-SUPER-002` | Super Admin | `/super-admin/dashboard` |

> Passwords are **not** stored in this repository. You choose them when you
> create the users. These are disposable test accounts — never reuse them, or
> the `@vernex.test` addresses, for anything real.

The public patient page needs no login: `/book/vernex-demo-clinic`.

---

## Modules

**Reception** — dashboard with live queue and today's appointments; appointment
search and filters; booking, rescheduling and cancellation with WhatsApp notice;
walk-in registration; a billing shortcut that records real payments against open
invoices.

**Doctor** — queue with WhatsApp-booking context; consultation capture (symptoms,
vitals, diagnosis, advice, follow-up); prescription builder with clinic medicine
autocomplete, saved templates, learned favourites and lab tests; WhatsApp
delivery and pharmacy routing; follow-up tracking; medicine reminder schedules;
weekly availability and blocked dates.

**Pharmacy** — prescriptions sent by doctors become pharmacy orders in the
database immediately and appear live in the queue (realtime plus a 30-second
poll), with medicine matching, allergies, FEFO batch selection, partial
dispensing and "mark unavailable"; Add Stock by manual entry or Excel/CSV upload
with a validated preview, saved atomically (quantities are always added to an
existing batch, never overwritten); medicine stock per medicine with batches,
filters, adjustments, batch blocking and movement history; counter billing that
prices from stock and reduces it in one transaction. See
[Phase 16](docs/PHASE_16_PHARMACIST_MODULE.md).

**Billing** — invoice builder driven by the clinic service catalogue; invoices,
receipts, pending payments with reminders; refunds with a request → approve →
process workflow; seven reports with date/doctor/branch filters and CSV export.

**WhatsApp booking** — booking console that walks a patient through department →
doctor → date → slot → details and creates a real appointment with source
`whatsapp`, persisting the conversation; message templates; conversation
tracking; clinic-level settings stored on the clinic record.

**Public booking** — `/book/:clinicSlug` runs unauthenticated through
security-definer RPCs (`public_clinic_doctors`, `public_doctor_available_slots`,
`public_create_booking`, …). Anonymous visitors can browse doctors, services and
open slots and book an appointment, but **cannot read patient, appointment or
billing tables directly** — RLS returns nothing. Booking status lookup requires
both the phone number and the token.

**Owner / Super Admin** — clinic overview with revenue trend, appointment mix,
doctor-wise revenue and low-stock alerts; monitoring (audit, errors, security,
health); clinic, branch, staff and module administration.

---

## Security notes

- RLS is enabled on all tables; policies scope reads and writes to
  `current_clinic_id()` and check per-module permissions.
- The anonymous booking path never touches a table directly — only
  `security definer` RPCs that return a curated payload.
- Slot booking takes a row lock and rejects double-booking.
- Booking status requires phone **and** reference; a matching token alone
  returns nothing.
- WhatsApp sends are recorded in `whatsapp_messages` and
  `whatsapp_delivery_logs` but **no message leaves the system** until an official
  WhatsApp Business API provider is connected. Do not use unofficial WhatsApp
  automation for patient health data.
- Never commit `frontend/.env`, a service role key, or the Supabase CLI
  `.temp/` link state.

---

## Documentation

Phase-by-phase build notes live in [docs/](docs/), including the
[frontend/backend contract](docs/FRONTEND_BACKEND_CONTRACT.md), the
[Supabase integration guide](docs/SUPABASE_REPLACEMENT_GUIDE.md) and the
[pharmacist module (Phase 16)](docs/PHASE_16_PHARMACIST_MODULE.md).
