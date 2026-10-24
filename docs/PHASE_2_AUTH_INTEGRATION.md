# Phase 2 Auth Integration

Phase 2 connects Supabase Auth to the existing service provider. Feature modules remain mocked.

## Auth Flow

1. Staff enters email or Vernex staff ID on the existing login page.
2. Email login calls Supabase Auth directly.
3. Staff ID login calls `public.resolve_staff_login_email(staff_user_id text)`, then signs in with the resolved email.
4. After Supabase Auth returns a session, the auth service loads `staff_profiles` by `auth.users.id`.
5. `ProtectedRoute` allows access only when a Supabase session exists, the staff profile is active, and a role is present.

Patients do not authenticate. Public booking remains outside staff auth.

## Profile Resolution

The auth service resolves:

- auth user ID
- staff profile ID
- full name
- `user_id`
- email
- phone
- `role_key`
- `clinic_id`
- `branch_id`
- status
- linked clinic
- linked branch

## Module And Permission Resolution

Modules:

- Load `staff_modules`.
- If staff-specific rows exist, enabled staff rows win.
- Otherwise fallback to `role_modules`.
- Clinic staff modules are limited by enabled `clinic_modules`.
- Super admin can use role modules without clinic filtering.

Permissions:

- Load `staff_permissions`.
- If staff-specific rows exist, allowed staff rows win.
- Otherwise fallback to `role_permissions`.

## First Super Admin Bootstrap

Do not hardcode passwords in the app or migration.

1. Create an Auth user in Supabase Auth.
2. Copy the auth user UUID.
3. Insert a matching `staff_profiles` row:

```sql
insert into public.staff_profiles (
  id,
  clinic_id,
  branch_id,
  role_key,
  full_name,
  user_id,
  email,
  status
) values (
  '<auth_user_uuid>',
  null,
  null,
  'super_admin',
  '<full_name>',
  '<staff_user_id>',
  '<email>',
  'active'
);
```

## RLS Test Checklist

Super admin:

- Can sign in.
- Can read foundation tables.
- Can read all clinics and branches.
- Can read role/module/permission catalogs.

Clinic staff:

- Can sign in.
- Can read only their own clinic.
- Can read branches from their clinic.
- Can read their own staff profile.
- Can read enabled modules for their clinic.
- Can read their own staff module and permission overrides.

Unauthenticated:

- Cannot read foundation tables directly.
- Can only execute the narrow staff ID email resolver.

## What Still Remains Mock

- Appointments
- Patients
- Doctor workflows
- Pharmacy
- Billing
- WhatsApp
- Reports
- Support
- Most module pages and screen-level mock data

## Phase 3 Recommendation

Phase 3 should verify auth/profile RLS with real test users, then replace clinic/user context services fully. Operational tables should still wait until auth, clinic, branch, module, and permission boundaries are proven.
