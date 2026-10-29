# Vernex Clinic OS

A role-based clinic management system for Indian clinics: appointments, consultations,
prescriptions, pharmacy, billing, reports and public/WhatsApp-first patient booking.

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
| Backend | Supabase (PostgreSQL, Auth, RLS, RPCs) |
| Timezone | Asia/Kolkata (IST, UTC+05:30) |

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
  pages/
    public/            visitor landing page (/)
    auth/              staff login (/login)
  access-control/      role, module and permission guards
  shared/types/        domain types + generated database.types.ts
  utils/               formatDate.ts (IST date/time helpers)
supabase/
  migrations/          schema, RLS policies and RPCs (phases 1-16 + booking & doctor flow)
  seed/demo_seed.sql   demo data, safe to re-run
```

**Access control is enforced twice.** The UI hides what a role cannot use
(`ModuleGuard`, `PermissionGuard`), and PostgreSQL RLS independently rejects
anything the UI might have let through. The database is the authority.

**Public booking is the front door.** Visitors landing on `/` see the public landing
page with immediate options to book an appointment or look up existing appointments.
Staff members with an active session are routed directly to their role-based home.

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

Key migrations added for Booking Flow and Doctor Schedule:
1. `20261028181000_honest_booking_status.sql` — Real status reporting (`booked`, `arrived`, etc.), phone normalisation, and removed misleading confirmation claims.
2. `20261028182000_schedule_and_slot_correctness.sql` — Single-source slot generation in `ensure_doctor_slots`, atomic schedule updates, 12-hour AM/PM formatting, past slot filtering, and slot concurrency guards.
3. `20261028183000_concurrency_safe_tokens.sql` — Transactional advisory locks for tokens, unique constraint per clinic and date, and A001..Z999 rollover.
4. `20261028184000_my_appointments_lookup.sql` — Anonymous lookup RPC by clinic and mobile number, server-side rolling rate limiting, and patient name masking.

### 3. Demo Data (Optional)

Create these users under **Authentication → Users** with *Auto Confirm User*
ticked, all sharing one password:

```
owner@vernex.test        reception@vernex.test    pharmacist@vernex.test
doctor@vernex.test       doctor2@vernex.test      doctor3@vernex.test
super_admin@vernex.test
```

Then run `supabase/seed/demo_seed.sql`.

### 4. Run

```bash
cd frontend
npm install
npm run dev     # http://localhost:5173
npm run build   # production build
npm run lint    # ESLint check
```

---

## Demo Accounts

Sign in with **either the email or the staff ID** at `/login` — the login screen resolves a
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
> create the users.

---

## Modules & Key Flows

### Public Landing Page (`/`)
- Public front door for prospective patients.
- Large primary action: **Book an appointment** (direct to published clinic or `/book` directory).
- Secondary action: **My appointments** (direct to phone lookup at `/booking/status`).
- Quiet **Staff login** link to `/login`.
- If an authenticated staff member navigates to `/`, they are automatically routed to their role dashboard without flashing the landing page.

### Honest Booking Status & Flow
- Established a single shared appointment-status dictionary (`Booked - your slot is reserved`, `Checked in - waiting`, `With the doctor`, `Completed`, `Cancelled`, `Missed`).
- Removed all misleading claims that a doctor approved or confirmed a booking.
- Fully auto-booked workflow; reserves slot immediately without artificial doctor approval gates.
- Booking success page links directly to status and calendar.

### Doctor Dashboard (`/doctor/queue`)
- **Today** and **Upcoming** view tabs, fully responsive down to 375 px.
- Displays all appointments for today (including booked appointments prior to check-in).
- "Start Consultation" is strictly guarded to checked-in patients only (`arrived`, `waiting`).
- Real database statistics (today total, checked in, waiting, completed, upcoming this week); zero fixed zeroes.
- Dynamic greeting based on current India Standard Time hour (`Good morning / afternoon / evening, Dr. [Name]`).
- Single-query patient loading to avoid N+1 queries.
- Automatic 30-second live refresh with timestamp.

### Doctor Schedule & Slot Engine
- Single source of truth: PostgreSQL function `ensure_doctor_slots`.
- Dynamic slot materialization respecting working hours, break windows (never starts in or overlaps a break), slot duration, capacity, blocked dates, and active status.
- Schedule modification RPC `sync_doctor_schedule_and_slots` removes future unbooked slots, regenerates new slots, preserves booked slots, and alerts the doctor in plain words about conflicting bookings.
- Timezone alignment: All date evaluations use `Asia/Kolkata` time; past slots for today are omitted from available lists.
- Displayed uniformly in 12-hour AM/PM format (`hh:mm AM/PM`).
- Concurrency protection: `SELECT ... FOR UPDATE` ensures exact single-winner slot allocation with a clear message: `"This slot was just taken, please pick another"`.

### My Appointments & Privacy (`/booking/status`)
- Patients select their clinic and enter their mobile number.
- Displays upcoming appointments (soonest first) followed by past appointments from the last 90 days.
- Normalizes phone numbers (last 10 digits) across formats (`+91`, `91`, leading `0`, spaces, hyphens).
- Anonymous access strictly restricted to the curated `public_lookup_appointments` RPC.
- Patient privacy: Patient names are masked (e.g. `Aisha K.`); clinical data (notes, diagnosis, vitals, prescriptions, billing) is never exposed.
- Server-side rate limiting prevents brute-force phone probing (5 requests per 5 minutes per phone/clinic).

---

## Security Notes

- RLS is enabled on all tables; policies scope reads and writes to `current_clinic_id()` and check per-module permissions.
- The anonymous booking path never touches a table directly — only `security definer` RPCs that return curated payloads.
- Token numbers use transactional advisory locks and unique database constraints to prevent race-condition collisions.
- Mobile-number-only lookup is protected by database-enforced rate limiting and patient name masking. OTP via SMS or WhatsApp is recommended once an official provider is integrated.
- Never commit `frontend/.env`, a service role key, or credentials into Git.

---

## Reports & Documentation

- [Booking Workflow End-to-End Test](docs/BOOKING_WORKFLOW_TEST.md)
- [Schedule and Slot Correctness Audit](docs/SCHEDULE_AUDIT.md)
- [Final QA Report](docs/FINAL_QA_REPORT.md)
- [Security Audit Report](docs/SECURITY_AUDIT_REPORT.md)
- [Frontend/Backend Contract](docs/FRONTEND_BACKEND_CONTRACT.md)
- [Pharmacist Module (Phase 16)](docs/PHASE_16_PHARMACIST_MODULE.md)
