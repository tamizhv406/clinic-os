# Vernex Clinic OS — Application Security & Architecture Audit Report

**Date of Execution:** 28–29 October 2026  
**Auditor / Reviewer:** Senior Application Security Reviewer & Full-Stack Engineer  
**System Scope:** Vernex Clinic OS (Frontend, Supabase PostgreSQL, Authentication, RLS Policies, Public APIs, Concurrency, Dependencies)  
**Standard Compliance:** OWASP Top 10, Healthcare Data Privacy Principles, PostgreSQL Security Best Practices

---

## 1. Security Architecture Summary

Vernex Clinic OS enforces a dual-perimeter security model:
1. **Frontend Perimeter:** Role-based route guards (`ModuleGuard`, `PermissionGuard`, `ProtectedRoute`), clean separation of visitor and staff contexts, and zero client-side secrets.
2. **Database Perimeter (Authority):** Row-Level Security (RLS) enabled on all tables, `current_clinic_id()` multi-tenant isolation, and strictly scoped `SECURITY DEFINER` RPCs with `search_path = public` for all anonymous actions.

During this phased review, specific attention was given to:
- Patient clinical privacy in unauthenticated endpoints.
- Race conditions during concurrent slot reservations and token generation.
- Abuse vectors against anonymous phone-lookup endpoints.
- Timezone manipulation vectors at midnight boundaries.

---

## 2. Security Findings Matrix

| Finding ID | Severity | Affected Area | Title / Vulnerability | Remediation Status |
| :---: | :---: | :--- | :--- | :---: |
| **SEC-01** | **HIGH** | Token Generation / Concurrency | Token Collisions via Race Condition in `next_token_number` | **RESOLVED** |
| **SEC-02** | **MEDIUM** | Anonymous Lookup / Privacy | Enumeration Risk on Mobile-Number-Only Lookup Endpoint | **MITIGATED** |
| **SEC-03** | **MEDIUM** | Slot Reservation | Overbooking via Concurrent Final Slot Requests | **RESOLVED** |
| **SEC-04** | **LOW** | Date & Time Logic | Midnight Timezone Discrepancy (UTC vs. IST) | **RESOLVED** |
| **SEC-05** | **LOW** | Doctor Queue / Consultation | Unauthorized Consultation Start for Booked Patients | **RESOLVED** |
| **SEC-06** | **HIGH (Deps)** | Frontend Dependencies | Pre-Existing Vulnerabilities in Node Tooling Packages | **AUDITED / DOCUMENTED** |

---

## 3. Detailed Security Findings & Remediations

### SEC-01: Token Collisions via Race Condition in `next_token_number`
* **Severity:** **HIGH**
* **Affected Area:** `supabase/migrations/20260804120000_phase_15_feature_completion.sql` (`next_token_number`)
* **Vulnerability Description:**  
  The legacy token generation function executed `SELECT coalesce(max(...), 0) + 1` without acquiring table or transaction-level advisory locks. Two concurrent bookings submitted at the same second calculated the exact same integer token value, producing duplicate consultation tokens for different patients at the same clinic on the same day.
* **Remediation Implemented (`20261028183000_concurrency_safe_tokens.sql`):**  
  1. Implemented transactional advisory locks:
     ```sql
     perform pg_advisory_xact_lock(hashtext(target_clinic_id::text || ':' || target_date::text));
     ```
  2. Implemented unique database index:
     ```sql
     create unique index idx_appointments_clinic_date_token
     on public.appointments (clinic_id, appointment_date, token_number)
     where token_number is not null;
     ```
  3. Added alpha-numeric rollover safe past `A999` (advancing through `B001..Z999`).
* **Verification:** Concurrent test verified serial token issuance (`A001`, `A002`); duplicate token insertion is rejected by the database engine.

---

### SEC-02: Enumeration Risk on Mobile-Number-Only Lookup Endpoint
* **Severity:** **MEDIUM**
* **Affected Area:** `public_lookup_appointments` RPC & `/booking/status`
* **Vulnerability Description:**  
  Per product owner requirements, prospective patients look up their appointments using only their mobile number (without OTP verification). Without defensive controls, an attacker could automate phone number brute-forcing to discover which clinics patients visit and harvest their identity.
* **Remediation Implemented (`20261028184000_my_appointments_lookup.sql`):**  
  1. **Server-Side Throttling:** Dedicated tracking table `appointment_lookup_rate_limits` enforces a maximum of 5 lookup attempts per phone number and clinic within a rolling 5-minute window. Rapid querying throws: `"Too many tries, please try again in a few minutes"`.
  2. **Patient Name Masking:** SQL helper `mask_patient_name` masks all but the first name and initials (e.g., `"Aisha Khan"` becomes `"Aisha K."`, `"John Michael Doe"` becomes `"John M. D."`).
  3. **Zero Clinical Data Exposure:** The RPC explicitly omits diagnosis, doctor advice, notes, vitals, prescriptions, medication dosages, and billing/invoice data. Only logistical fields (token, doctor, clinic address, 12h time, status) are returned.
* **Plain Risk Statement & Recommendation:**  
  > [!WARNING]
  > **Mobile-Number-Only Identification Risk:**  
  > While server-side rate limiting and name masking reduce automated scraping, any individual who knows a patient's mobile number and chosen clinic can still confirm that the patient has an appointment there. **It is strongly recommended to require an OTP delivered via SMS or WhatsApp once an official SMS/WhatsApp Business gateway is connected.**

---

### SEC-03: Overbooking via Concurrent Final Slot Requests
* **Severity:** **MEDIUM**
* **Affected Area:** `public_create_booking` RPC
* **Vulnerability Description:**  
  When only one capacity spot remains for a doctor's slot, simultaneous submissions could read `booked_count < capacity` before either incremented the count, causing the slot to overbook beyond `max_appointments_per_slot`.
* **Remediation Implemented (`20261028182000_schedule_and_slot_correctness.sql`):**  
  - Locked the slot row within the transaction:
    ```sql
    select * into slot_row from public.appointment_slots where id = ... for update;
    ```
  - Slot capacity validation occurs after the exclusive row lock is granted. The second transaction immediately detects `booked_count >= capacity` and raises:
    ```sql
    raise exception 'This slot was just taken, please pick another';
    ```
* **Verification:** Exactly one winner succeeds; second user receives the friendly retry prompt.

---

### SEC-04: Midnight Timezone Discrepancy (UTC vs. IST)
* **Severity:** **LOW**
* **Affected Area:** Slot availability filters, reporting filters, and dashboard queries.
* **Vulnerability Description:**  
  Using `new Date().toISOString().slice(0, 10)` or PostgreSQL `current_date` (which defaults to UTC) causes calendar calculations to lag 5.5 hours behind between 00:00 and 05:30 IST. A patient booking at 01:00 AM IST on Tuesday was offered Monday's schedule.
* **Remediation Implemented:**  
  - Replaced all 10 occurrences in the frontend with `localDateISO()` and `addDaysISO()` pegged to `Asia/Kolkata`.
  - In PostgreSQL RPCs, standardized on `(now() at time zone 'Asia/Kolkata')::date` and `(now() at time zone 'Asia/Kolkata')::time`.
* **Verification:** Simulated 01:00 AM IST verifies today's date in India is correctly recognized.

---

### SEC-05: Unauthorized Consultation Start for Booked Patients
* **Severity:** **LOW**
* **Affected Area:** `frontend/src/modules/doctor/components/DoctorQueueCard.tsx`
* **Vulnerability Description:**  
  The consultation flow could prematurely be triggered before reception checked in the patient, bypassing vital recording and front-desk identity confirmation.
* **Remediation Implemented:**  
  - Guarded the "Start Consultation" action in `DoctorQueueCard.tsx` so that only appointments in `arrived` or `waiting` status can initiate a consultation. Booked patients show an informational "View Patient" action.
* **Verification:** "Start Consultation" button is disabled/hidden for status `booked`.

---

## 4. Package Dependency Security Audit (`npm audit`)

An audit of the frontend package tree (`frontend/node_modules`) revealed 16 pre-existing vulnerabilities in development tooling:

| Package | Severity | Advisory / Advisory URL | Vulnerability Type |
| :--- | :---: | :--- | :--- |
| `brace-expansion` | **HIGH** | GHSA-3jxr-9vmj-r5cp | DoS via exponential-time expansion |
| `js-yaml` | **HIGH** | GHSA-5p4m-2wfm-xmqj | Quadratic CPU consumption in `!!omap` |
| `nanoid` | **HIGH** | GHSA-28wg-ghj8-5hjv | Uncontrolled loop with negative/zero size |
| `postcss` | **HIGH** | GHSA-fxqj-rqcc-2cmp | Arbitrary `.map` file disclosure via `sourceMappingURL` |
| `react-router` | **HIGH** | GHSA-qwww-vcr4-c8h2 | RSC Mode CSRF Bypass |
| `source-map-js` | **HIGH** | GHSA-68fv-2mgg-jv7q | Event-loop DoS via source-map offsets |
| `vite` | **HIGH** | GHSA-698v-4r3x-3vcv | Windows path handling in `launch-editor` |
| `zod` | **HIGH** | GHSA-mrhx-c7xc-m3w5 | Memory exhaustion on oversized collections |
| `fast-uri` | **MODERATE** | GHSA-w74x-v6f9-j3xg | URI scheme spoofing |
| `postcss-selector-parser` | **MODERATE** | GHSA-rj75-hqrm-r3gf | Quadratic complexity in flat selector parsing |

### Security Assessment of Dependencies
- All reported high-severity advisories reside in devDependencies or build tools (`vite`, `postcss`, `@typescript-eslint`).
- `react-router` advisory applies only to React Server Component (RSC) mode; Vernex Clinic OS runs purely as a client-side SPA with Vite.
- To avoid breaking changes in the production build pipeline, `npm audit fix --force` was intentionally deferred to avoid upgrading `vite-plugin-pwa` to a breaking version. Safe updates can be applied via `npm audit fix` during scheduled maintenance.

---

## 5. Security Posture Sign-Off

The system adheres strictly to the zero-trust principle between frontend and backend. Anonymous visitors cannot read protected tables, patient clinical histories remain invisible to unauthenticated endpoints, and database concurrency controls safeguard against race conditions.

