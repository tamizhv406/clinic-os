# Phase 3 Auth/RLS Verification

Phase 3 verifies Supabase staff auth and hardens access-control fallbacks. Feature services remain mocked.

## Test Users Needed

Create five Supabase Auth users manually in the Supabase dashboard:

- `super_admin`
- `owner`
- `receptionist`
- `doctor`
- `pharmacist`

Do not commit real passwords. Use temporary test passwords only in the dashboard or a secure local note.

## Bootstrap Process

After Auth users exist, create one test clinic and branch, then insert matching staff profiles.

```sql
insert into public.clinics (name, slug, clinic_mode, specialty, status)
values ('Vernex Test Clinic A', 'vernex-test-a', 'multi_speciality', 'General', 'active')
returning id;

insert into public.branches (clinic_id, name, is_main, status)
values ('<clinic_a_id>', 'Main Branch', true, 'active')
returning id;

insert into public.clinic_modules (clinic_id, module_key, enabled)
select '<clinic_a_id>', key, true from public.modules
on conflict (clinic_id, module_key) do update set enabled = excluded.enabled;

insert into public.staff_profiles (
  id, clinic_id, branch_id, role_key, full_name, user_id, email, status
) values
  ('<super_admin_auth_uuid>', null, null, 'super_admin', 'Test Super Admin', 'SA-TEST', '<super_admin_email>', 'active'),
  ('<owner_auth_uuid>', '<clinic_a_id>', '<branch_a_id>', 'owner', 'Test Owner', 'OWN-TEST', '<owner_email>', 'active'),
  ('<receptionist_auth_uuid>', '<clinic_a_id>', '<branch_a_id>', 'receptionist', 'Test Receptionist', 'REC-TEST', '<receptionist_email>', 'active'),
  ('<doctor_auth_uuid>', '<clinic_a_id>', '<branch_a_id>', 'doctor', 'Test Doctor', 'DOC-TEST', '<doctor_email>', 'active'),
  ('<pharmacist_auth_uuid>', '<clinic_a_id>', '<branch_a_id>', 'pharmacist', 'Test Pharmacist', 'PHA-TEST', '<pharmacist_email>', 'active');
```

For clinic isolation, create `Vernex Test Clinic B` with a separate branch and at least one staff user.

## Auth Tests

- Log in with staff email.
- Log in with `staff_profiles.user_id`.
- Log out.
- Refresh a protected route after login.
- Confirm logged-out users are redirected to `/login`.
- Set a test staff profile to `suspended` or `inactive`; confirm protected route access is denied.
- Confirm there is no patient login flow.

## Staff ID Resolver

`public.resolve_staff_login_email(staff_user_id text)`:

- Returns only email.
- Matches only `status = 'active'`.
- Requires non-null email.
- Trims submitted staff ID.
- Uses `security definer`.
- Sets `search_path = public`.
- Grants execute only to `anon` and `authenticated`.

Remaining risk: staff ID login still allows email discovery for valid active staff IDs. Rate limiting should be handled with Supabase/Auth provider controls, edge middleware, or WAF rules before production.

## RLS Tests

Use real signed-in sessions from the frontend or Supabase client.

Super admin:

- Can read/manage `clinics`.
- Can read/manage `branches`.
- Can read/manage `staff_profiles`.
- Can read role/module/permission tables.
- Can read `audit_logs`.

Clinic staff:

- Can read only their own `clinics` row.
- Can read only own-clinic `branches`.
- Can read their own `staff_profiles` row.
- Can read own `staff_modules`.
- Can read own `staff_permissions`.
- Can read catalog `role_modules` and `role_permissions`.
- Can read same-clinic `audit_logs`.

Clinic isolation:

- Clinic A staff cannot read Clinic B `clinics`.
- Clinic A staff cannot read Clinic B `branches`.
- Clinic A staff cannot read Clinic B `audit_logs`.
- Clinic A staff cannot read Clinic B staff profile rows unless future policies explicitly allow same-clinic staff management.

Unauthenticated:

- Cannot read protected foundation tables.
- Can execute only the staff-ID email resolver.

Tables to verify:

- `clinics`
- `branches`
- `staff_profiles`
- `clinic_modules`
- `staff_modules`
- `staff_permissions`
- `role_modules`
- `role_permissions`
- `audit_logs`

## Access-Control Tests

- Navigation is loaded from Supabase auth context.
- `RoleSwitcher` is read-only and cannot change authenticated role.
- `Sidebar` does not fall back to mock navigation after auth failure.
- `canAccess` no longer grants mock role defaults.
- `ModuleGuard` and `PermissionGuard` use Supabase context.

## What Still Remains Mock

- Appointments
- Patients
- Consultations
- Prescriptions
- Pharmacy
- Billing
- WhatsApp
- Reports
- Support

## Next Phase

Phase 4 should replace clinic/user context services fully, then verify role and permission management flows. Operational feature modules should still wait until access-control is proven with real users.
