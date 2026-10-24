# Phase 5 Patient Management

Phase 5 replaces the patient mock service with Supabase-backed patient management. Patients remain clinical records only and do not authenticate.

## Tables Created

- `patients`
- `patient_family_members`
- `patient_notes`

## Patient Fields

`patients` stores clinic-scoped demographics, contact details, consent flags, basic medical summary text, status, metadata, creator, and timestamps.

Every patient has:

- `clinic_id`
- `full_name`
- `phone`
- `status`

Optional details include:

- `branch_id`
- `patient_code`
- `whatsapp_number`
- `email`
- `age`
- `gender`
- `date_of_birth`
- `blood_group`
- `address`
- emergency contact fields
- allergies/history/current medications
- source and consent flags

## RLS Policies

RLS is enabled on all patient tables.

- Super admin can read/manage all patient records.
- Clinic staff can read patients from their own clinic.
- Staff with `patients.create` can insert patients for their clinic.
- Staff with `patients.edit`, `patients.manage`, or `patients.delete` can update patients for their clinic.
- Staff with `patients.delete` or `patients.manage` can delete patients for their clinic.
- Family links and notes are scoped by clinic.
- Unauthenticated users cannot access patient tables.

## Service Methods

`supabasePatientService` implements:

- `getPatients(filters)`
- `getPatientById(id)`
- `searchPatients(query)`
- `findPatientByPhone(phone)`
- `findByWhatsAppNumber(number)`
- `findPatientByWhatsAppNumber(number)`
- `createPatient(input)`
- `updatePatient(id, input)`
- `archivePatient(id)`
- `getPatientFamilyMembers(patientId)`
- `linkFamilyMember(input)`
- `getPatientNotes(patientId)`
- `addPatientNote(input)`

## Patient Search Logic

Search checks:

- `full_name`
- `phone`
- `whatsapp_number`
- `patient_code`

Supabase RLS still limits returned records to the signed-in staff user's clinic.

## Family Linking

`patient_family_members` links two patient records inside the same clinic. The table enforces uniqueness for `primary_patient_id` and `linked_patient_id`.

## Notes

`patient_notes` stores internal, doctor, or reception notes. Notes are clinic-scoped and linked to staff via `created_by`.

## Safe Demo Data

Use only fake test patients. Do not insert production or private medical data into development seeds.

## What Still Remains Mock

- Appointments
- Consultations
- Prescriptions
- Pharmacy
- Billing
- WhatsApp
- Reports
- Support

## Pending Verification

Manual real-user Auth/RLS verification may still be pending from Phase 4.5. Before production use, verify:

- real staff login
- clinic isolation
- patient create/update/archive permissions
- search returns only same-clinic patients
- unauthenticated users cannot read patient tables
