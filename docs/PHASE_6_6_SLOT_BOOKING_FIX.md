# Phase 6.6 Slot Booking Fix

## Root Cause

The appointment modal loaded doctors with `doctor_profiles.id`, which is correct, but slot loading only queried existing `appointment_slots`. If slots had not already been generated, reception saw no available slots even when the doctor had valid availability.

The old generation path was also manual and used an upsert that could overwrite existing slot state, including booked counts.

## Files Fixed

- `frontend/src/services/interfaces/doctor.service.ts`
- `frontend/src/services/supabase/supabaseDoctor.service.ts`
- `frontend/src/modules/reception/components/AppointmentFormModal.tsx`

## Doctor ID Mapping

Appointment booking continues to use `doctor_profiles.id`.

- `doctor_profiles.id` is used for `doctor_availability.doctor_id`.
- `doctor_profiles.id` is used for `appointment_slots.doctor_id`.
- `doctor_profiles.id` is sent into the appointment slot/RPC flow through the selected slot.
- Staff IDs are only used to resolve doctor display names.

## Slot Generation Logic

`services.doctor.getAvailableSlots(doctorId, date)` now:

- checks existing slots for the doctor/date;
- auto-generates slots if none exist;
- uses `doctor_availability.day_of_week`;
- skips `doctor_blocked_dates`;
- skips break windows;
- uses `doctor_profiles.max_appointments_per_slot`;
- avoids duplicate slots with the unique constraint;
- does not overwrite existing booked/full slots.

`generateSlotsForDoctor` now accepts either a single date string or a `{ from, to }` range.

## RLS Changes

No migration was added. Existing Phase 6 policies already allow clinic staff to read same-clinic `doctor_profiles`, `doctor_availability`, and `appointment_slots`, and allow appointment slot creation when the staff user has appointment create/assign or availability configure permissions.

## Test Checklist

- Log in as doctor.
- Create availability for a weekday.
- Refresh and confirm availability remains.
- Log in as receptionist.
- Open appointment creation.
- Select patient, doctor, and matching date.
- Confirm slots appear automatically.
- Create appointment using a selected slot.
- Refresh and confirm appointment remains.
- Confirm doctor queue shows appointment.
- Try booking the same doctor/date/slot twice.
- Confirm second booking fails when capacity is full and `booked_count` does not exceed capacity.

## Notes

Remote DB spot check found at least one active `doctor_availability` row. Follow-up count queries were blocked by Supabase pooler temporary login failures and should be retried later with `SUPABASE_DB_PASSWORD` if deeper DB inspection is needed.
