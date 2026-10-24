# Phase 4.5 Real Auth/RLS Verification Gate

This gate must pass before Patient Management begins.

## Test Users Created

Creation is supported by `frontend/scripts/phase-4-5-create-test-users.mjs`.

Codex could not execute the remote admin bootstrap in this session because the linked Supabase project rejected CLI admin access without `SUPABASE_DB_PASSWORD`, and no `SUPABASE_SERVICE_ROLE_KEY` is present in the workspace. Do not commit passwords or service-role keys.

Required users:

- `super_admin`
- `owner`
- `receptionist`
- `doctor`
- `pharmacist`

## Safe Auth User Process

Admin script option:

```powershell
cd frontend
$env:SUPABASE_SERVICE_ROLE_KEY = "<service-role-key>"
$env:VERNEX_TEST_PASSWORD = "<temporary-test-password>"
node scripts/phase-4-5-create-test-users.mjs
Remove-Item Env:\SUPABASE_SERVICE_ROLE_KEY
Remove-Item Env:\VERNEX_TEST_PASSWORD
```

The script creates or updates:

- `super_admin@vernex.test` / `VNX-SUPER-001` / `super_admin`
- `owner@vernex.test` / `VNX-OWNER-001` / `owner`
- `reception@vernex.test` / `VNX-REC-001` / `receptionist`
- `doctor@vernex.test` / `VNX-DOC-001` / `doctor`
- `pharmacist@vernex.test` / `VNX-PHAR-001` / `pharmacist`
- `Vernex Demo Clinic`
- `Main Branch`
- `clinic_modules`
- `staff_profiles`
- explicit `staff_modules`
- explicit `staff_permissions`
- the doctor's `doctor_profiles` row

Dashboard option:

1. Open Supabase Dashboard.
2. Go to Authentication > Users.
3. Create each test user with a temporary password.
4. Copy each Auth user UUID.
5. Run the staff profile SQL below with those UUIDs.

## Test Clinic And Staff SQL

```sql
insert into public.clinics (name, slug, clinic_mode, specialty, status)
values ('Vernex RLS Test Clinic A', 'vernex-rls-test-a', 'multi_speciality', 'General', 'active')
returning id;

insert into public.branches (clinic_id, name, is_main, status)
values ('<clinic_a_id>', 'Main Branch', true, 'active')
returning id;

insert into public.clinic_modules (clinic_id, module_key, enabled)
select '<clinic_a_id>', key, true from public.modules
on conflict (clinic_id, module_key) do update set enabled = excluded.enabled;

insert into public.staff_profiles (id, clinic_id, branch_id, role_key, full_name, user_id, email, status)
values
  ('<super_admin_auth_uuid>', null, null, 'super_admin', 'Test Super Admin', 'SA-TEST', '<super_admin_email>', 'active'),
  ('<owner_auth_uuid>', '<clinic_a_id>', '<branch_a_id>', 'owner', 'Test Owner', 'OWN-TEST', '<owner_email>', 'active'),
  ('<receptionist_auth_uuid>', '<clinic_a_id>', '<branch_a_id>', 'receptionist', 'Test Receptionist', 'REC-TEST', '<receptionist_email>', 'active'),
  ('<doctor_auth_uuid>', '<clinic_a_id>', '<branch_a_id>', 'doctor', 'Test Doctor', 'DOC-TEST', '<doctor_email>', 'active'),
  ('<pharmacist_auth_uuid>', '<clinic_a_id>', '<branch_a_id>', 'pharmacist', 'Test Pharmacist', 'PHA-TEST', '<pharmacist_email>', 'active');
```

Create Clinic B for isolation:

```sql
insert into public.clinics (name, slug, clinic_mode, specialty, status)
values ('Vernex RLS Test Clinic B', 'vernex-rls-test-b', 'single_speciality', 'Dental', 'active')
returning id;

insert into public.branches (clinic_id, name, is_main, status)
values ('<clinic_b_id>', 'Main Branch', true, 'active')
returning id;

insert into public.clinic_modules (clinic_id, module_key, enabled)
select '<clinic_b_id>', key, true from public.modules
on conflict (clinic_id, module_key) do update set enabled = excluded.enabled;
```

## Module And Permission Setup

Role defaults already exist in `role_modules` and `role_permissions`.

For explicit staff overrides:

```sql
insert into public.staff_modules (staff_id, module_key, enabled)
select '<staff_auth_uuid>', key, true from public.modules
where key in ('dashboard', 'staff', 'settings')
on conflict (staff_id, module_key) do update set enabled = excluded.enabled;

insert into public.staff_permissions (staff_id, permission_key, allowed)
select '<staff_auth_uuid>', key, true from public.permissions
where key in ('dashboard.view', 'staff.view', 'staff.manage', 'settings.configure')
on conflict (staff_id, permission_key) do update set allowed = excluded.allowed;
```

## Login Results

Pending real-user execution.

Required checks:

- Email/password login works.
- Staff `user_id`/password login works.
- Logout works.
- Refresh keeps session.
- Logged-out protected routes redirect to `/login`.
- Suspended/inactive staff are blocked.
- No patient login exists.

## Role And Module Results

Pending real-user execution.

Required checks:

- `super_admin` sees platform/admin access.
- `owner` sees assigned clinic modules only.
- `receptionist` sees assigned modules only.
- `doctor` sees assigned modules only.
- `pharmacist` sees assigned modules only.
- `RoleSwitcher` is read-only.
- Disabled clinic modules do not appear in navigation.

## Core Admin Results

Pending real-user execution.

Required checks as `super_admin`:

- Create clinic.
- Update clinic status.
- Create branch.
- Create staff profile after Auth user exists.
- Assign staff modules.
- Assign staff permissions.

## RLS Results

Pending real-user execution.

Required checks:

- `super_admin` can manage foundation data.
- Clinic staff can read only their own clinic.
- Clinic A staff cannot read Clinic B data.
- Unauthenticated users cannot read protected foundation tables.
- Staff cannot access disabled modules.

Tables:

- `clinics`
- `branches`
- `staff_profiles`
- `clinic_modules`
- `staff_modules`
- `staff_permissions`
- `role_modules`
- `role_permissions`
- `audit_logs`

## Phase 4.5 Fixes Applied

- Clinic staff no longer get role modules when `clinic_modules` is empty.
- `canAccess()` no longer treats an empty enabled module list as allow-all.

## Remaining Risks

- Real Auth users still require a secure admin credential or Dashboard access from an authorized operator.
- Staff ID login can reveal active staff IDs by resolving an email; production rate limiting is still needed.
- Frontend still must not create Auth users directly.

## Gate Status

Blocked pending secure admin credential/Dashboard execution and manual RLS verification.
