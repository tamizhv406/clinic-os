-- Clinic admin role.
--
-- 'admin' is a per-clinic role carrying the same module and permission set as
-- 'owner', plus the one thing an owner deliberately does not have: the ability to
-- put new staff into their own clinic. Until now the only INSERT path into
-- staff_profiles was "super_admin_manage_staff_profiles", which is why the owner
-- staff directory ends with "handled by the platform admin".
--
-- An admin may only ever touch the three delivery roles (doctor, receptionist,
-- pharmacist) and only inside their own clinic. They cannot mint another admin, an
-- owner, or a super_admin -- that stays a platform-level action.
--
-- Creating the *login* cannot happen from the browser (the anon key has no access
-- to the Admin API), so the create-staff Edge Function owns that half and runs with
-- the service role. The policies below are what lets an admin manage staff
-- afterwards -- suspend, re-assign a branch, change module access -- from the
-- client directly.

-- ---------------------------------------------------------------------
-- 1. The role itself, with owner-equivalent access
-- ---------------------------------------------------------------------
insert into public.roles (key, name, description, is_system)
values ('admin', 'Admin', 'Clinic administrator: owner-level access plus staff onboarding.', true)
on conflict (key) do update set
  name = excluded.name,
  description = excluded.description,
  is_system = excluded.is_system;

-- Same modules as owner: everything except the platform 'support' desk.
insert into public.role_modules (role_key, module_key, enabled)
select 'admin', key, true from public.modules
where key <> 'support'
on conflict (role_key, module_key) do update set enabled = excluded.enabled;

insert into public.role_permissions (role_key, permission_key, allowed)
select 'admin', p.key, true
from public.permissions p
where p.module_key <> 'support'
on conflict (role_key, permission_key) do update set allowed = excluded.allowed;

-- ---------------------------------------------------------------------
-- 2. Helpers
-- ---------------------------------------------------------------------
-- The roles a clinic admin may create and manage. Kept as a function so the
-- policies below and the Edge Function agree on a single definition.
create or replace function public.admin_manageable_roles()
returns text[]
language sql
immutable
as $$
  select array['doctor', 'receptionist', 'pharmacist']::text[]
$$;

create or replace function public.is_clinic_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.staff_profiles
    where id = auth.uid()
      and role_key = 'admin'
      and status = 'active'
      and clinic_id is not null
  )
$$;

-- True when the caller may onboard/manage staff in the given clinic. Security
-- definer so it reads staff_profiles without re-entering RLS.
create or replace function public.can_manage_clinic_staff(target_clinic_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select public.is_super_admin()
    or (
      target_clinic_id is not null
      and public.is_clinic_admin()
      and target_clinic_id = public.current_clinic_id()
    )
$$;

grant execute on function public.admin_manageable_roles() to authenticated;
grant execute on function public.is_clinic_admin() to authenticated;
grant execute on function public.can_manage_clinic_staff(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- 3. Staff management policies for the clinic admin
-- ---------------------------------------------------------------------
-- The role_key guard sits in both USING and WITH CHECK: an admin must not be able
-- to reach an owner row, nor to promote a doctor they manage into an owner.
drop policy if exists "admin_manage_clinic_staff_profiles" on public.staff_profiles;
create policy "admin_manage_clinic_staff_profiles" on public.staff_profiles
for all to authenticated
using (
  public.can_manage_clinic_staff(clinic_id)
  and role_key = any (public.admin_manageable_roles())
)
with check (
  public.can_manage_clinic_staff(clinic_id)
  and role_key = any (public.admin_manageable_roles())
);

drop policy if exists "admin_manage_clinic_staff_modules" on public.staff_modules;
create policy "admin_manage_clinic_staff_modules" on public.staff_modules
for all to authenticated
using (
  exists (
    select 1 from public.staff_profiles sp
    where sp.id = staff_modules.staff_id
      and public.can_manage_clinic_staff(sp.clinic_id)
      and sp.role_key = any (public.admin_manageable_roles())
  )
)
with check (
  exists (
    select 1 from public.staff_profiles sp
    where sp.id = staff_modules.staff_id
      and public.can_manage_clinic_staff(sp.clinic_id)
      and sp.role_key = any (public.admin_manageable_roles())
  )
);

drop policy if exists "admin_manage_clinic_staff_permissions" on public.staff_permissions;
create policy "admin_manage_clinic_staff_permissions" on public.staff_permissions
for all to authenticated
using (
  exists (
    select 1 from public.staff_profiles sp
    where sp.id = staff_permissions.staff_id
      and public.can_manage_clinic_staff(sp.clinic_id)
      and sp.role_key = any (public.admin_manageable_roles())
  )
)
with check (
  exists (
    select 1 from public.staff_profiles sp
    where sp.id = staff_permissions.staff_id
      and public.can_manage_clinic_staff(sp.clinic_id)
      and sp.role_key = any (public.admin_manageable_roles())
  )
);

-- An admin reads every colleague's permission rows in their clinic; the phase-1
-- policy only ever exposed the caller's own, which left the access column on the
-- staff screen blank for everyone else.
drop policy if exists "admin_view_clinic_staff_permissions" on public.staff_permissions;
create policy "admin_view_clinic_staff_permissions" on public.staff_permissions
for select to authenticated
using (
  exists (
    select 1 from public.staff_profiles sp
    where sp.id = staff_permissions.staff_id
      and sp.clinic_id is not null
      and sp.clinic_id = public.current_clinic_id()
  )
);

-- Onboarding a doctor writes the clinical half of the record too. The phase-5
-- policy required 'availability.configure', which an admin does hold, but staff
-- management alone should be enough to stand a doctor up.
drop policy if exists "admin_manage_clinic_doctor_profiles" on public.doctor_profiles;
create policy "admin_manage_clinic_doctor_profiles" on public.doctor_profiles
for all to authenticated
using (public.can_manage_clinic_staff(clinic_id))
with check (public.can_manage_clinic_staff(clinic_id));

-- ---------------------------------------------------------------------
-- 4. Teach the two role-hardcoded helpers about 'admin'
-- ---------------------------------------------------------------------
-- phase 12 -- WhatsApp actions were gated on ('owner','receptionist').
create or replace function public.can_manage_whatsapp(action_key text)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select public.is_super_admin()
    or exists (
      select 1
      from public.staff_profiles sp
      where sp.id = auth.uid()
        and sp.status = 'active'
        and sp.role_key in ('owner','admin','receptionist')
        and (
          public.has_permission('whatsapp.manage')
          or public.has_permission('whatsapp.' || action_key)
        )
    )
$$;

-- phase 13 -- monitoring logs were gated on role_key = 'owner'.
create or replace function public.can_read_monitoring_logs(target_clinic_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select public.is_super_admin()
    or exists (
      select 1
      from public.staff_profiles sp
      where sp.id = auth.uid()
        and sp.status = 'active'
        and sp.role_key in ('owner','admin')
        and target_clinic_id is not null
        and sp.clinic_id = target_clinic_id
        and (
          public.has_permission('reports.view')
          or public.has_permission('reports.manage')
          or public.has_permission('settings.configure')
          or public.has_permission('staff.manage')
        )
    )
$$;
