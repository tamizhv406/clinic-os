-- Brands (organizations) and multi-clinic staff access.
--
-- A brand such as "SIMS Hospital" owns several clinics/branches that live in one
-- database. Until now every staff login was tied to exactly one clinic through
-- staff_profiles.clinic_id, so a single admin (or doctor) could not work across the
-- clinics of a brand.
--
-- Design: staff_profiles.clinic_id stays what it has always been -- the *active*
-- clinic -- so every existing RLS policy that calls current_clinic_id() keeps
-- working untouched. What is new is the list of clinics a person is *allowed* to
-- activate (staff_clinic_access) and a switch_active_clinic() RPC that moves the
-- active clinic between them. Tenant isolation is unchanged: a request still only
-- ever sees one clinic's data at a time, and access can never cross brands.
--
-- Idempotent: safe to re-run.

-- ---------------------------------------------------------------------
-- 1. Organizations (brands)
-- ---------------------------------------------------------------------
create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique not null,
  status text not null default 'active' check (status in ('active', 'inactive')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.clinics
  add column if not exists organization_id uuid references public.organizations(id) on delete set null;

create index if not exists idx_clinics_organization_id on public.clinics(organization_id);

drop trigger if exists set_organizations_updated_at on public.organizations;
create trigger set_organizations_updated_at before update on public.organizations
for each row execute function public.set_updated_at();

-- Every existing clinic becomes a brand of one, so nothing is left unassigned.
insert into public.organizations (name, slug)
select c.name, c.slug
from public.clinics c
where c.organization_id is null
on conflict (slug) do nothing;

update public.clinics c
set organization_id = o.id
from public.organizations o
where c.organization_id is null
  and o.slug = c.slug;

-- ---------------------------------------------------------------------
-- 2. Which clinics a staff member may activate
-- ---------------------------------------------------------------------
create table if not exists public.staff_clinic_access (
  staff_id uuid not null references public.staff_profiles(id) on delete cascade,
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  branch_id uuid references public.branches(id) on delete set null,
  granted_by uuid references public.staff_profiles(id) on delete set null,
  created_at timestamptz default now(),
  primary key (staff_id, clinic_id)
);

create index if not exists idx_staff_clinic_access_clinic_id on public.staff_clinic_access(clinic_id);

-- Everyone keeps access to the clinic they are already in.
insert into public.staff_clinic_access (staff_id, clinic_id, branch_id)
select id, clinic_id, branch_id from public.staff_profiles where clinic_id is not null
on conflict (staff_id, clinic_id) do nothing;

-- Whatever clinic a profile points at is, by definition, one they may use. Keeps the
-- table complete for the existing create-staff Edge Function and any direct insert.
create or replace function public.sync_staff_clinic_access()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.clinic_id is not null then
    insert into public.staff_clinic_access (staff_id, clinic_id, branch_id)
    values (new.id, new.clinic_id, new.branch_id)
    on conflict (staff_id, clinic_id) do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists staff_profiles_sync_clinic_access on public.staff_profiles;
create trigger staff_profiles_sync_clinic_access
after insert or update of clinic_id on public.staff_profiles
for each row execute function public.sync_staff_clinic_access();

-- ---------------------------------------------------------------------
-- 3. Row level security
-- ---------------------------------------------------------------------
alter table public.organizations enable row level security;
alter table public.staff_clinic_access enable row level security;

drop policy if exists "super_admin_manage_organizations" on public.organizations;
create policy "super_admin_manage_organizations" on public.organizations
for all to authenticated
using (public.is_super_admin())
with check (public.is_super_admin());

drop policy if exists "staff_view_own_organizations" on public.organizations;
create policy "staff_view_own_organizations" on public.organizations
for select to authenticated
using (
  id in (
    select c.organization_id
    from public.clinics c
    join public.staff_clinic_access a on a.clinic_id = c.id
    where a.staff_id = auth.uid()
  )
);

drop policy if exists "super_admin_manage_staff_clinic_access" on public.staff_clinic_access;
create policy "super_admin_manage_staff_clinic_access" on public.staff_clinic_access
for all to authenticated
using (public.is_super_admin())
with check (public.is_super_admin());

-- Reading only. Writes go through grant_clinic_access / revoke_clinic_access, which
-- carry the brand and role checks.
drop policy if exists "staff_view_clinic_access" on public.staff_clinic_access;
create policy "staff_view_clinic_access" on public.staff_clinic_access
for select to authenticated
using (
  staff_id = auth.uid()
  or clinic_id = public.current_clinic_id()
);

-- A shared admin is "active" in only one clinic at a time, so the other clinics'
-- staff directories would otherwise lose them. Show anyone with access to the
-- clinic the caller is currently in.
drop policy if exists "staff_view_clinic_staff_profiles" on public.staff_profiles;
create policy "staff_view_clinic_staff_profiles" on public.staff_profiles
for select to authenticated
using (
  (clinic_id is not null and clinic_id = public.current_clinic_id())
  or exists (
    select 1
    from public.staff_clinic_access a
    where a.staff_id = staff_profiles.id
      and a.clinic_id = public.current_clinic_id()
  )
);

-- ---------------------------------------------------------------------
-- 4. Switching and listing
-- ---------------------------------------------------------------------
create or replace function public.my_clinics()
returns table (
  clinic_id uuid,
  clinic_name text,
  clinic_slug text,
  clinic_status text,
  organization_id uuid,
  organization_name text,
  branch_id uuid,
  is_active boolean
)
language sql
security definer
set search_path = public
stable
as $$
  select
    c.id,
    c.name,
    c.slug,
    c.status,
    o.id,
    o.name,
    a.branch_id,
    c.id = sp.clinic_id
  from public.staff_profiles sp
  join public.staff_clinic_access a on a.staff_id = sp.id
  join public.clinics c on c.id = a.clinic_id
  left join public.organizations o on o.id = c.organization_id
  where sp.id = auth.uid()
    and sp.status = 'active'
  order by o.name nulls last, c.name
$$;

create or replace function public.switch_active_clinic(target_clinic_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  caller public.staff_profiles;
  access_row public.staff_clinic_access;
  target_status text;
  target_branch uuid;
begin
  select * into caller from public.staff_profiles where id = auth.uid();
  if not found or caller.status <> 'active' then
    raise exception 'Your staff profile is not active.';
  end if;
  if caller.role_key = 'super_admin' then
    raise exception 'Platform admins do not work inside a clinic.';
  end if;

  select * into access_row
  from public.staff_clinic_access
  where staff_id = caller.id and clinic_id = target_clinic_id;
  if not found then
    raise exception 'You do not have access to that clinic.';
  end if;

  select status into target_status from public.clinics where id = target_clinic_id;
  if target_status is null or target_status not in ('trial', 'active') then
    raise exception 'That clinic is not active.';
  end if;

  target_branch := coalesce(
    access_row.branch_id,
    (select b.id from public.branches b
      where b.clinic_id = target_clinic_id and b.status = 'active'
      order by b.is_main desc nulls last, b.created_at limit 1)
  );

  update public.staff_profiles
  set clinic_id = target_clinic_id, branch_id = target_branch
  where id = caller.id;

  return target_clinic_id;
end;
$$;

-- ---------------------------------------------------------------------
-- 5. Sharing a person between clinics of the same brand
-- ---------------------------------------------------------------------
-- Who may share whom:
--   * super_admin: anyone except another super_admin.
--   * clinic admin: only delivery staff (doctor, receptionist, pharmacist), and only
--     into a clinic they themselves have access to.
-- In every case the target clinic must belong to the same brand as a clinic the
-- person already works in -- access never crosses brands.
create or replace function public.grant_clinic_access(
  target_staff_id uuid,
  target_clinic_id uuid,
  target_branch_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  caller public.staff_profiles;
  target public.staff_profiles;
  target_org uuid;
begin
  select * into caller from public.staff_profiles where id = auth.uid() and status = 'active';
  if not found then raise exception 'Your staff profile is not active.'; end if;

  select * into target from public.staff_profiles where id = target_staff_id;
  if not found then raise exception 'That staff member does not exist.'; end if;
  if target.role_key = 'super_admin' then raise exception 'Platform admins cannot be assigned to a clinic.'; end if;

  select organization_id into target_org from public.clinics where id = target_clinic_id;
  if target_org is null then raise exception 'That clinic does not belong to a brand.'; end if;

  if caller.role_key <> 'super_admin' then
    if caller.role_key <> 'admin' then raise exception 'Only an admin can share staff between clinics.'; end if;
    if not (target.role_key = any (public.admin_manageable_roles())) then
      raise exception 'Admins can only share doctors, receptionists and pharmacists.';
    end if;
    if not exists (select 1 from public.staff_clinic_access where staff_id = caller.id and clinic_id = target_clinic_id) then
      raise exception 'You do not have access to that clinic.';
    end if;
  end if;

  -- Same brand as something the person already belongs to.
  if not exists (
    select 1
    from public.staff_clinic_access a
    join public.clinics c on c.id = a.clinic_id
    where a.staff_id = target.id and c.organization_id = target_org
  ) then
    raise exception 'Staff can only be shared between clinics of the same brand.';
  end if;

  if target_branch_id is not null and not exists (
    select 1 from public.branches where id = target_branch_id and clinic_id = target_clinic_id
  ) then
    raise exception 'That branch does not belong to the clinic.';
  end if;

  insert into public.staff_clinic_access (staff_id, clinic_id, branch_id, granted_by)
  values (target.id, target_clinic_id, target_branch_id, caller.id)
  on conflict (staff_id, clinic_id) do update
    set branch_id = coalesce(excluded.branch_id, public.staff_clinic_access.branch_id),
        granted_by = excluded.granted_by;
end;
$$;

create or replace function public.revoke_clinic_access(target_staff_id uuid, target_clinic_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  caller public.staff_profiles;
  target public.staff_profiles;
  fallback_clinic uuid;
begin
  select * into caller from public.staff_profiles where id = auth.uid() and status = 'active';
  if not found then raise exception 'Your staff profile is not active.'; end if;

  select * into target from public.staff_profiles where id = target_staff_id;
  if not found then raise exception 'That staff member does not exist.'; end if;

  if caller.role_key <> 'super_admin' then
    if caller.role_key <> 'admin' then raise exception 'Only an admin can change clinic access.'; end if;
    if not (target.role_key = any (public.admin_manageable_roles())) then
      raise exception 'Admins can only manage doctors, receptionists and pharmacists.';
    end if;
    if not exists (select 1 from public.staff_clinic_access where staff_id = caller.id and clinic_id = target_clinic_id) then
      raise exception 'You do not have access to that clinic.';
    end if;
  end if;

  select clinic_id into fallback_clinic
  from public.staff_clinic_access
  where staff_id = target.id and clinic_id <> target_clinic_id
  order by created_at limit 1;
  if fallback_clinic is null then
    raise exception 'A staff member must keep access to at least one clinic. Suspend them instead.';
  end if;

  delete from public.staff_clinic_access where staff_id = target.id and clinic_id = target_clinic_id;

  if target.clinic_id = target_clinic_id then
    update public.staff_profiles
    set clinic_id = fallback_clinic,
        branch_id = (select b.id from public.branches b where b.clinic_id = fallback_clinic
                      order by b.is_main desc nulls last, b.created_at limit 1)
    where id = target.id;
  end if;
end;
$$;

-- ---------------------------------------------------------------------
-- 6. Creating a clinic with everything it needs to be usable
-- ---------------------------------------------------------------------
-- A bare INSERT into clinics left the new clinic with no branch and no enabled
-- modules, so its first login saw an empty workspace. This does it in one step.
create or replace function public.create_clinic_with_defaults(
  clinic_name text,
  clinic_slug text,
  clinic_mode text default 'single_speciality',
  clinic_specialty text default null,
  clinic_phone text default null,
  clinic_email text default null,
  clinic_address text default null,
  for_organization_id uuid default null,
  new_organization_name text default null,
  enabled_modules text[] default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  org_id uuid := for_organization_id;
  new_clinic public.clinics;
  new_branch uuid;
  org_slug text;
begin
  if not public.is_super_admin() then
    raise exception 'Only a platform admin can create clinics.';
  end if;
  if coalesce(trim(clinic_name), '') = '' then raise exception 'Clinic name is required.'; end if;
  if coalesce(trim(clinic_slug), '') = '' then raise exception 'Clinic slug is required.'; end if;
  if clinic_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' then
    raise exception 'Slug may only contain lowercase letters, numbers and single hyphens.';
  end if;
  if exists (select 1 from public.clinics where slug = clinic_slug) then
    raise exception 'A clinic with the slug "%" already exists.', clinic_slug;
  end if;

  if org_id is null then
    org_slug := clinic_slug;
    if coalesce(trim(new_organization_name), '') <> '' then
      org_slug := trim(both '-' from regexp_replace(lower(new_organization_name), '[^a-z0-9]+', '-', 'g'));
    end if;
    if exists (select 1 from public.organizations where slug = org_slug) then
      org_slug := org_slug || '-' || substr(gen_random_uuid()::text, 1, 6);
    end if;
    insert into public.organizations (name, slug)
    values (coalesce(nullif(trim(new_organization_name), ''), clinic_name), org_slug)
    returning id into org_id;
  elsif not exists (select 1 from public.organizations where id = org_id) then
    raise exception 'That brand does not exist.';
  end if;

  insert into public.clinics (name, slug, clinic_mode, specialty, phone, email, address, status, organization_id)
  values (trim(clinic_name), clinic_slug, clinic_mode, nullif(clinic_specialty, ''), nullif(clinic_phone, ''),
          nullif(clinic_email, ''), nullif(clinic_address, ''), 'trial', org_id)
  returning * into new_clinic;

  insert into public.branches (clinic_id, name, address, phone, is_main)
  values (new_clinic.id, 'Main branch', nullif(clinic_address, ''), nullif(clinic_phone, ''), true)
  returning id into new_branch;

  insert into public.clinic_modules (clinic_id, module_key, enabled)
  select new_clinic.id, m.key, true
  from public.modules m
  where case
          when enabled_modules is null then m.key not in ('support')
          else m.key = any (enabled_modules)
        end
  on conflict (clinic_id, module_key) do nothing;

  return jsonb_build_object(
    'clinic_id', new_clinic.id,
    'branch_id', new_branch,
    'organization_id', org_id
  );
end;
$$;

-- ---------------------------------------------------------------------
-- 7. Grants
-- ---------------------------------------------------------------------
revoke all on function public.my_clinics() from public, anon;
revoke all on function public.switch_active_clinic(uuid) from public, anon;
revoke all on function public.grant_clinic_access(uuid, uuid, uuid) from public, anon;
revoke all on function public.revoke_clinic_access(uuid, uuid) from public, anon;
revoke all on function public.create_clinic_with_defaults(text, text, text, text, text, text, text, uuid, text, text[]) from public, anon;

grant execute on function public.my_clinics() to authenticated;
grant execute on function public.switch_active_clinic(uuid) to authenticated;
grant execute on function public.grant_clinic_access(uuid, uuid, uuid) to authenticated;
grant execute on function public.revoke_clinic_access(uuid, uuid) to authenticated;
grant execute on function public.create_clinic_with_defaults(text, text, text, text, text, text, text, uuid, text, text[]) to authenticated;
