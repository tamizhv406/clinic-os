# Phase 4 Core Administration

Phase 4 connects Supabase foundation administration for super admins. Feature services remain mocked.

## Test User Setup

Create Auth users in Supabase Dashboard first. Do not commit passwords.

Required test users:

- `super_admin`
- `owner`
- `receptionist`
- `doctor`
- `pharmacist`

After creating each Auth user, copy the Auth user UUID. The Super Admin dashboard can create matching `staff_profiles` rows when signed in as a real `super_admin`.

Minimum staff profile fields:

- `id`: Auth user UUID
- `role_key`
- `full_name`
- `user_id`
- `email`
- `status = active`
- `clinic_id` for clinic staff
- `branch_id` where relevant

## Clinic Creation Flow

Super admin creates clinics from `/super-admin/dashboard`.

The UI writes:

- `clinics`
- `clinic_modules`

Enabled module checkboxes are saved into `clinic_modules`.

## Branch Flow

Super admin selects a clinic and creates branches.

The UI writes:

- `branches`

Branch updates are supported by `supabaseClinicService.updateBranch()` for future edit UI.

## Staff Profile Flow

Auth users must be created outside the frontend first.

The UI writes:

- `staff_profiles`
- `staff_modules`
- `staff_permissions`

The frontend never uses a service role key and does not create Supabase Auth users directly.

## Module And Permission Flow

Clinic modules:

- Saved to `clinic_modules` during clinic creation/update.

Staff modules:

- Saved to `staff_modules`.
- Override role module defaults.

Staff permissions:

- Saved to `staff_permissions`.
- Override role permission defaults.
- Permission keys use `{module}.{action}`.

Role defaults remain in:

- `role_modules`
- `role_permissions`

## RLS Checks

Super admin:

- Can manage all clinics.
- Can manage all branches.
- Can manage staff profiles.
- Can assign modules and permissions.

Owner:

- Can view own clinic foundation data.
- Cannot manage other clinics.

Receptionist, doctor, pharmacist:

- Can authenticate.
- Can view own context only.
- Cannot access other clinic foundation data.

Unauthenticated:

- Cannot read protected foundation tables.

## What Still Remains Mock

- Patients
- Appointments
- Consultations
- Prescriptions
- Pharmacy
- Billing
- WhatsApp
- Reports
- Support

## Secure User Provisioning Later

Creating Auth users from the frontend with the anon key is unsafe. Future production provisioning should use a secure backend or Edge Function with service-role access stored only server-side.

## Validation Checklist

- Log in as real `super_admin`.
- Create a clinic.
- Create a branch.
- Create staff profiles for owner/receptionist/doctor/pharmacist using existing Auth UUIDs.
- Assign modules and permissions.
- Log out and log back in as staff.
- Refresh protected routes.
- Verify navigation matches assigned modules and permissions.
- Verify Clinic A staff cannot read Clinic B foundation data.
