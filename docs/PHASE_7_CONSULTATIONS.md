# Phase 7 Consultations

## Tables

- `consultations`
- `consultation_vitals`
- `consultation_notes`

The tables are clinic-scoped, linked to appointments, patients, doctor profiles, and staff profiles, and include indexes for clinic, patient, doctor, appointment, status, and consultation lookups.

## RLS

RLS is enabled on all Phase 7 tables.

- `super_admin` can read and manage all consultation data.
- Clinic staff can read consultation data in their own clinic when they have consultation view/manage permission.
- Doctors can read, create, and update consultations assigned to their own `doctor_profiles` row.
- Vitals and notes require the consultation to belong to the same clinic and be accessible to the current staff user.
- Unauthenticated users have no policies.

## Service Methods

Implemented through `services.doctor`:

- `getConsultations(filters)`
- `getConsultationById(id)`
- `getConsultationsByPatient(patientId)`
- `getConsultationByAppointment(appointmentId)`
- `createConsultation(input)`
- `updateConsultation(id, input)`
- `completeConsultation(id)`
- `saveVitals(input)`
- `getVitals(consultationId)`
- `addConsultationNote(input)`
- `getConsultationNotes(consultationId)`

## Appointment Status Integration

- Creating a consultation calls the existing appointment status RPC and moves the appointment to `in_consultation`.
- Completing a consultation sets `consultations.status = completed`, sets `completed_at`, and moves the appointment to `completed`.

## Frontend

- Doctor queue links now pass `appointmentId` into the consultation route.
- The doctor consultation page loads the real patient, assigned appointment, doctor profile, existing consultation, latest vitals, and consultation history.
- Saving persists symptoms, diagnosis, clinical notes, advice, follow-up, vitals, and a doctor note.
- Prescription actions remain mocked until Phase 8.

## Still Mocked

- Prescriptions
- Pharmacy
- Billing
- WhatsApp
- Reports
- Payments, refunds, webhooks, and settlements

## Testing Checklist

- Log in as doctor.
- Open an assigned appointment from doctor queue.
- Start consultation and verify appointment status becomes `in_consultation`.
- Save symptoms, vitals, diagnosis, advice, notes, and follow-up.
- Refresh and verify consultation fields persist.
- Complete consultation.
- Verify consultation status is `completed`.
- Verify appointment status is `completed`.
- Verify owner/reception can only view permitted clinic consultation summaries.
- Verify Clinic A staff cannot read Clinic B consultation rows.
- Verify unauthenticated reads fail.
