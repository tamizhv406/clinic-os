# Phase 6 Appointments

Phase 6 adds Supabase-backed appointments, doctor profiles, availability, slots, and queue status history.

## Schema

Tables:

- `doctor_profiles`
- `doctor_availability`
- `doctor_blocked_dates`
- `appointment_slots`
- `appointments`
- `appointment_status_history`

## RPCs

`create_appointment_with_slot(input jsonb)`:

- Locks the selected slot with `for update`.
- Confirms the slot exists.
- Confirms the slot is available.
- Confirms `booked_count < capacity`.
- Inserts the appointment.
- Increments `booked_count`.
- Marks the slot `full` when capacity is reached.
- Inserts initial status history.
- Returns the created appointment.

`update_appointment_status(appointment_id uuid, new_status text, reason text default null)`:

- Checks appointment exists.
- Checks clinic scope.
- Updates status.
- Saves cancellation reason when relevant.
- Inserts status history.
- Returns the updated appointment.

## RLS

RLS is enabled on all Phase 6 tables.

- Super admin can manage all Phase 6 data.
- Clinic staff can read same-clinic doctor profiles, availability, slots, appointments, and status history.
- Appointment create/update is gated by appointment permissions.
- Availability management is gated by `availability.configure`.
- Unauthenticated users cannot access appointment tables.

## Service Methods

Appointment service:

- `getAppointments(filters)`
- `getAppointmentById(id)`
- `getTodayAppointments()`
- `getDoctorAppointments(doctorId)`
- `getQueue()`
- `createAppointment(input)`
- `bookAppointmentWithSlot(input)`
- `assignDoctor(appointmentId, doctorId, slotId)`
- `updateAppointmentStatus(id, status)`
- `cancelAppointment(id, reason)`
- `getAppointmentStatusHistory(id)`
- `createSlot(input)`

Doctor availability service:

- `getDoctorProfiles()`
- `getDoctorProfileByStaffId(staffId)`
- `getDoctorAvailability(doctorId)`
- `updateDoctorAvailability(input)`
- `blockDoctorDate(input)`
- `getAvailableSlots(doctorId, date)`
- `generateSlotsForDoctor(doctorId, dateRange)`

Consultations, prescriptions, and reminders still delegate to mocks.

## Queue Status Flow

Supported statuses:

- `requested`
- `booked`
- `confirmed`
- `arrived`
- `waiting`
- `in_consultation`
- `completed`
- `cancelled`
- `no_show`

Frontend domain mapping normalizes `requested` and `confirmed` to `booked` for older UI compatibility.

## What Remains Mock

- Consultations
- Prescriptions
- Pharmacy
- Billing
- WhatsApp
- Reports
- Payments

## Pending Verification

Real-user Auth/RLS testing may still be pending. Before production use:

- Create doctor profiles for doctor staff users.
- Create availability.
- Generate slots.
- Book an appointment through `create_appointment_with_slot`.
- Attempt over-capacity booking and confirm it fails.
- Update queue statuses.
- Verify Clinic A staff cannot read Clinic B appointments.
