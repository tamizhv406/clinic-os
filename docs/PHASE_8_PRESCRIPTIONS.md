# Phase 8 - Prescriptions Backend

## Scope

Phase 8 replaces the doctor prescription save/share workflow with Supabase-backed prescription records. Pharmacy inventory, billing, reports, real WhatsApp API delivery, and payments remain mocked or placeholder-only.

## Tables

- `prescriptions`: clinic-scoped prescription header linked to patient, doctor profile, optional consultation, and optional appointment.
- `prescription_items`: medicine rows for each prescription.
- `prescription_delivery_logs`: audit trail for manual, WhatsApp placeholder, print placeholder, and pharmacy placeholder status changes.
- `medicine_reminders`: reminder-ready schedules created only when reminder consent is confirmed and the patient has reminder consent.

All operational rows include `clinic_id`.

## RLS

RLS is enabled for all Phase 8 tables.

- `super_admin` can manage all prescription tables.
- Clinic staff can read prescription rows in their own clinic when they have prescription access or are the assigned doctor.
- Doctors can create and update prescriptions for their own doctor profile.
- Owner/receptionist access depends on existing `prescriptions.*` permissions.
- Pharmacists can view routed prescriptions when pharmacy module/permissions allow it.
- Unauthenticated users have no policies.

## RPCs

- `create_prescription_with_items(input jsonb)`: validates staff/profile/clinic scope, creates prescription + items, creates reminder rows when allowed, and writes a delivery log.
- `update_prescription_delivery_status(prescription_id uuid, new_status text, message text default null)`: updates WhatsApp placeholder delivery state and logs it.
- `route_prescription_to_pharmacy(prescription_id uuid)`: marks a prescription as routed to pharmacy placeholder and logs it.

## Service Methods

The doctor domain service now includes:

- `getPrescriptions`
- `getPrescriptionById`
- `getPrescriptionsByPatient`
- `getPrescriptionsByConsultation`
- `createPrescription`
- `updatePrescription`
- `createPrescriptionWithItems`
- `updatePrescriptionDeliveryStatus`
- `routePrescriptionToPharmacy`
- `sendPrescriptionToPatientPlaceholder`
- `getMedicineReminders`
- `createMedicineReminderSchedule`
- `updateReminderStatus`

Legacy-compatible `sendPrescriptionToWhatsApp` and `getReminders` remain as wrappers.

## Frontend Wiring

- `/doctor/prescription/:patientId` loads the patient through `services.patients`.
- `PrescriptionBuilder` saves prescriptions through `services.doctor`.
- WhatsApp sending is a placeholder status update only.
- Pharmacy routing is a placeholder flag/status update only.
- Print remains a browser print placeholder.
- Favorites, templates, lab suggestions, and mock fallback data remain unchanged.

## Still Mocked

- Pharmacy inventory and dispensing.
- Billing.
- Reports.
- Real WhatsApp API sending/webhooks.
- Payment gateway, refunds, settlements.

## Testing Checklist

- `supabase db push`
- Regenerate Supabase types.
- `npm run build`
- Login as doctor.
- Open assigned patient prescription page.
- Save prescription with medicines.
- Refresh and verify data persists in `prescriptions` and `prescription_items`.
- Mark WhatsApp placeholder sent and verify `prescription_delivery_logs`.
- Route to pharmacy placeholder and verify `send_to_pharmacy` / `pharmacy_status`.
- Enable reminders for a consented patient and verify `medicine_reminders`.
- Confirm unauthenticated users cannot read prescription tables.
