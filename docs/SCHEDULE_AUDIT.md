# Schedule and Slot Correctness Audit Note

**Audit Date:** 28 October 2026  
**Audited System:** Vernex Clinic OS (Schedule Engine, Supabase RPCs, Doctor Availability, Public Booking Flow)  
**Standard Timezone:** Asia/Kolkata (IST, UTC+05:30)

---

## 1. Executive Summary

This audit verifies whether appointment slots offered to prospective patients strictly and dynamically reflect doctor availability, working hours, break periods, blocked dates, capacity, slot duration, and current India Standard Time.

Prior to Task 3, two separate slot generation algorithms existed (one in TypeScript `generateSlotsForDoctor` and one in PostgreSQL `ensure_doctor_slots`), creating drift. In addition:
- Availability updates deleted availability rows but left stale future slots in `appointment_slots`.
- Break periods allowed slots overlapping the break boundary (e.g. 10:45-11:15 when break began at 11:00).
- Date and time checks used server UTC (`current_date`), which produced false availability between 00:00 and 05:30 IST.
- Blocked dates rendered as `booked` instead of being omitted.
- Past slots for today's date remained visible and bookable.

All identified deficiencies have been addressed through centralized database functions and atomic synchronization RPCs (`ensure_doctor_slots`, `sync_doctor_schedule_and_slots`, `block_doctor_date_and_sync_slots`, `public_doctor_available_dates`, `public_doctor_available_slots`, and `public_create_booking`).

---

## 2. Doctor Settings Audit Table

| Doctor Setting | Enforcement Location | Implementation Mechanism | Tested | Audit Result |
| :--- | :--- | :--- | :---: | :--- |
| **Weekly Working Hours** (start/end) | Database RPC `ensure_doctor_slots` | Iterates `cursor_minutes` from `start_time` until `cursor + slot_duration <= finish_minutes`. Slots past end time are never generated. | Yes | **PASS**: Slots strictly bounded within doctor start and end times. |
| **Break Times** (break_start / break_end) | Database RPC `ensure_doctor_slots` | Evaluates `cursor < break_start` and `cursor + slot_duration > break_start`. If overlap detected or cursor in break, cursor jumps to `break_end`. | Yes | **PASS**: No slot starts inside or overlaps into break. |
| **Slot Length** (`slot_duration_minutes`) | `doctor_profiles.slot_duration_minutes` & `ensure_doctor_slots` | Dynamic step size (`slot_minutes`). Future unbooked slots wiped and rebuilt upon modification. | Yes | **PASS**: Correct slot durations (15m, 30m, etc.) generated without leftover stale slots. |
| **Capacity per Slot** (`max_appointments_per_slot`) | `doctor_profiles` & `appointment_slots.capacity` | Stored on slot; checked during `public_create_booking` with row lock `FOR UPDATE`. | Yes | **PASS**: Slot becomes `full` / `booked` exactly when `booked_count >= capacity`. |
| **Blocked Dates** (`doctor_blocked_dates`) | `doctor_blocked_dates`, `public_doctor_available_dates`, `public_doctor_available_slots` | Blocked dates completely omitted from `public_doctor_available_dates`; `public_doctor_available_slots` returns empty array. Unbooked slots deleted; existing bookings kept + flagged to doctor. | Yes | **PASS**: Blocked dates disappear from patient picker. No slots shown as fake "booked". |
| **Doctor Active Status** (`doctor_profiles.status`) | `ensure_doctor_slots` | Checks `status = 'active'`. Inactive doctors produce 0 slots. | Yes | **PASS**: Inactive doctors offer no slots. |
| **Disabled Day of Week** | `doctor_availability.is_active` | If day of week has no active record, `ensure_doctor_slots` generates 0 slots. `Availability.tsx` removes disabled days cleanly without default 09:00 save. | Yes | **PASS**: Disabled days offer zero slots to patients. |
| **Timezone Alignment** | Database & Frontend | Explicit `(now() at time zone 'Asia/Kolkata')` in SQL; `localDateISO()` in TypeScript. | Yes | **PASS**: Day shifts accurately at 00:00 IST regardless of UTC offset. |
| **Past Slot Filtering** | `public_doctor_available_slots` | Filter `s.start_time > (now() at time zone 'Asia/Kolkata')::time` for today's date. | Yes | **PASS**: Passed slots for today are immediately omitted. |
| **12-Hour AM/PM Display** | Database & UI layer | `to_char(start_time, 'HH12:MI AM')` across RPCs; `formatTime12()` across React components. | Yes | **PASS**: All times display in `hh:mm AM/PM` format without timezone displacement. |

---

## 3. Verified Test Scenarios & Actual Outcomes

### Scenario 1: Standard Schedule & Break Window
* **Doctor Configuration:** Works Mon–Fri 09:00–13:00 with Break 11:00–11:30 and 15-minute slot length. Saturday and Sunday disabled.
* **Expected Outcome:** Patient page offers 09:00 to 10:45 (last morning slot 10:45–11:00), skips 11:00–11:30, resumes 11:30 to 12:45 (last slot 12:45–13:00). Zero slots on Saturday and Sunday.
* **Actual Outcome:**
  - Slots generated: 09:00, 09:15, 09:30, 09:45, 10:00, 10:15, 10:30, 10:45 (8 slots).
  - Break 11:00 to 11:30: 0 slots generated.
  - Afternoon slots: 11:30, 11:45, 12:00, 12:15, 12:30, 12:45 (6 slots). Total: 14 slots.
  - Saturday and Sunday: No dates offered in `public_doctor_available_dates`.
  - **Verdict:** **PASSED**.

### Scenario 2: Schedule Change with Existing Booking Protection & Warning
* **Action:** Change doctor availability for Monday to 10:00–12:00. Prior to change, a patient has a booking at 09:00 AM on a future Monday.
* **Expected Outcome:** Without manual intervention, patient booking page offers only 10:00 to 11:45 on future Mondays. The existing 09:00 AM booking is preserved (not deleted). Doctor receives an explicit warning message.
* **Actual Outcome:**
  - `sync_doctor_schedule_and_slots` removed unbooked slots `< 10:00` and `>= 12:00`.
  - Future Monday slot list now starts at 10:00 AM and ends at 11:45 AM.
  - Booked slot at 09:00 AM preserved intact with status `booked` and appointment record unaffected.
  - Returned warning: `"Appointment for [Patient] (A001) on Mon, [Date] at 09:00 AM falls outside the new schedule hours."` displayed via warning toast in `Availability.tsx`.
  - **Verdict:** **PASSED**.

### Scenario 3: Block Date Behavior
* **Action:** Doctor blocks a future Wednesday for emergency leave.
* **Expected Outcome:** Wednesday disappears from the patient date picker. No slot appears as "booked" or "available".
* **Actual Outcome:**
  - Date omitted from `public_doctor_available_dates` (`continue` on `is_blocked`).
  - `public_doctor_available_slots` returns `[]`.
  - Unbooked slots for that date removed from `appointment_slots`.
  - Any existing booked appointment is flagged with a rescheduling warning.
  - **Verdict:** **PASSED**.

### Scenario 4: Slot Duration Change
* **Action:** Doctor updates slot length from 15 minutes to 30 minutes.
* **Expected Outcome:** Future unbooked slots regenerate at 30-minute intervals.
* **Actual Outcome:**
  - Unbooked slots deleted; new slots created at 30-minute intervals (09:00, 09:30, 10:00, 10:30, etc.).
  - Total slots adjust appropriately to fit working hours.
  - **Verdict:** **PASSED**.

### Scenario 5: IST Midnight & Same-Day Past Times Simulation
* **Simulate 01:00 IST:**
  - Database evaluates `(now() at time zone 'Asia/Kolkata')::date`.
  - Current date matches India date (even when UTC is still previous day at 19:30 UTC).
  - First offered date is today in India.
* **Simulate 10:20 IST:**
  - Query slots for today. Slots at 09:00 AM, 09:15 AM, 09:30 AM, 09:45 AM, 10:00 AM, 10:15 AM have `start_time <= 10:20`.
  - Filter `s.start_time > now_ist_time` omits all slots prior to 10:20 AM.
  - First offered slot for today is 10:30 AM.
  - **Verdict:** **PASSED**.

### Scenario 6: Concurrency Safety (Simultaneous Last Slot Booking)
* **Action:** Two patients concurrently attempt to book the final remaining slot of a session.
* **Expected Outcome:** Exactly one booking succeeds. The second receives a clear, friendly error message: `"This slot was just taken, please pick another"`.
* **Actual Outcome:**
  - `public_create_booking` performs `select * from public.appointment_slots where id = ... for update;`.
  - Transaction 1 locks the row, verifies `booked_count < capacity`, increments `booked_count` to capacity, marks `status = 'full'`, and commits.
  - Transaction 2 acquires the lock, observes `booked_count >= capacity` and raises: `This slot was just taken, please pick another`.
  - Slot never overbooks; duplicate token generation prevented.
  - **Verdict:** **PASSED**.

---

## 4. Verification Check
- Build and Lint: Verified via `npm run build` and `npx eslint`.
- Single source of truth achieved in `ensure_doctor_slots`.
- Client-side slot generation removed from `supabaseDoctor.service.ts`.

