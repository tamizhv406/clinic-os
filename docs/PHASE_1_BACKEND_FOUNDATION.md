# Phase 1 Backend Foundation

Phase 1 adds the Supabase SaaS foundation only. Mock services remain active and no operational modules are connected.

## Tables Created

- `clinics`
- `branches`
- `roles`
- `modules`
- `permissions`
- `staff_profiles`
- `clinic_modules`
- `staff_modules`
- `staff_permissions`
- `role_modules`
- `role_permissions`
- `audit_logs`

No patients, appointments, consultations, prescriptions, pharmacy, WhatsApp, reports, gateway payments, refunds, settlements, or webhook tables are created in this phase.

## RLS Policies

RLS is enabled on every Phase 1 table.

- Super admins can view and manage foundation data.
- Clinic staff can view their own clinic.
- Clinic staff can view branches for their clinic.
- Clinic staff can view their own staff profile.
- Clinic staff can view enabled modules for their clinic.
- Clinic staff can view their own module and permission overrides.
- Authenticated users can view role, module, and permission catalogs.
- Authenticated users can insert audit logs.
- Audit logs are visible to super admins and same-clinic staff.

## Helper Functions

- `public.current_staff_profile()`
- `public.current_clinic_id()`
- `public.is_super_admin()`
- `public.has_module(module_key text)`
- `public.has_permission(permission_key text)`

## Seed Data

Seeded roles:

- `super_admin`
- `owner`
- `receptionist`
- `doctor`
- `pharmacist`

Seeded modules:

- `dashboard`
- `appointments`
- `whatsapp`
- `patients`
- `consultation`
- `prescriptions`
- `pharmacy`
- `billing`
- `reports`
- `staff`
- `settings`
- `subscription`
- `support`
- `delivery`
- `availability`
- `reminders`
- `follow_ups`

Seeded permissions use `{module}.{action}` keys for the base actions:

- `view`
- `create`
- `edit`
- `assign`
- `approve`
- `cancel`
- `delete`
- `bill`
- `dispense`
- `export`
- `manage`
- `configure`

## Apply Migration

From the repository root:

```bash
supabase db push
```

## Generate Types

Local generation:

```bash
cd frontend
npm run supabase:types
```

Linked remote generation:

```bash
supabase gen types typescript --project-id <PROJECT_REF> --schema public > frontend/src/shared/types/database.types.ts
```

## What Remains Mock

- Auth flow and login page
- `serviceProvider.ts`
- All existing mock services
- Reception, doctor, pharmacy, billing, patient booking, WhatsApp, reports, and support screens
- Direct mock imports identified in Phase 0

## Phase 2 Recommendation

Phase 2 should connect Supabase Auth and staff profile lookup behind the service provider. Start with `auth`, `clinics`, and `users` only. Do not begin operational data tables until role, module, permission, clinic, and branch scoping are verified with RLS.
