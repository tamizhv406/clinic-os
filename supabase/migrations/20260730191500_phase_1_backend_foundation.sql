create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.clinics (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique not null,
  clinic_mode text not null check (clinic_mode in ('single_speciality', 'multi_speciality')),
  specialty text,
  phone text,
  whatsapp_number text,
  email text,
  logo_url text,
  address text,
  status text not null default 'trial' check (status in ('trial', 'active', 'suspended', 'expired')),
  settings jsonb not null default '{}',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.branches (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  name text not null,
  address text,
  phone text,
  is_main boolean default false,
  status text not null default 'active' check (status in ('active', 'inactive')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.roles (
  id uuid primary key default gen_random_uuid(),
  key text unique not null,
  name text not null,
  description text,
  is_system boolean default true,
  created_at timestamptz default now()
);

create table if not exists public.modules (
  id uuid primary key default gen_random_uuid(),
  key text unique not null,
  name text not null,
  description text,
  category text,
  created_at timestamptz default now()
);

create table if not exists public.permissions (
  id uuid primary key default gen_random_uuid(),
  key text unique not null,
  name text not null,
  module_key text references public.modules(key),
  action text not null,
  description text,
  created_at timestamptz default now()
);

create table if not exists public.staff_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  clinic_id uuid references public.clinics(id) on delete set null,
  branch_id uuid references public.branches(id) on delete set null,
  role_key text not null references public.roles(key),
  full_name text not null,
  user_id text unique not null,
  email text,
  phone text,
  avatar_url text,
  status text not null default 'active' check (status in ('active', 'inactive', 'suspended')),
  metadata jsonb not null default '{}',
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  constraint staff_profiles_clinic_required_for_staff check (role_key = 'super_admin' or clinic_id is not null)
);

create table if not exists public.clinic_modules (
  clinic_id uuid references public.clinics(id) on delete cascade,
  module_key text references public.modules(key) on delete cascade,
  enabled boolean not null default true,
  created_at timestamptz default now(),
  primary key (clinic_id, module_key)
);

create table if not exists public.staff_modules (
  staff_id uuid references public.staff_profiles(id) on delete cascade,
  module_key text references public.modules(key) on delete cascade,
  enabled boolean not null default true,
  created_at timestamptz default now(),
  primary key (staff_id, module_key)
);

create table if not exists public.staff_permissions (
  staff_id uuid references public.staff_profiles(id) on delete cascade,
  permission_key text references public.permissions(key) on delete cascade,
  allowed boolean not null default true,
  created_at timestamptz default now(),
  primary key (staff_id, permission_key)
);

create table if not exists public.role_modules (
  role_key text references public.roles(key) on delete cascade,
  module_key text references public.modules(key) on delete cascade,
  enabled boolean not null default true,
  created_at timestamptz default now(),
  primary key (role_key, module_key)
);

create table if not exists public.role_permissions (
  role_key text references public.roles(key) on delete cascade,
  permission_key text references public.permissions(key) on delete cascade,
  allowed boolean not null default true,
  created_at timestamptz default now(),
  primary key (role_key, permission_key)
);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid references public.clinics(id) on delete set null,
  branch_id uuid references public.branches(id) on delete set null,
  actor_id uuid references public.staff_profiles(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  metadata jsonb not null default '{}',
  created_at timestamptz default now()
);

create index if not exists idx_clinics_slug on public.clinics(slug);
create index if not exists idx_clinics_status on public.clinics(status);
create index if not exists idx_branches_clinic_id on public.branches(clinic_id);
create index if not exists idx_staff_profiles_clinic_id on public.staff_profiles(clinic_id);
create index if not exists idx_staff_profiles_branch_id on public.staff_profiles(branch_id);
create index if not exists idx_staff_profiles_role_key on public.staff_profiles(role_key);
create index if not exists idx_staff_profiles_user_id on public.staff_profiles(user_id);
create index if not exists idx_clinic_modules_clinic_id on public.clinic_modules(clinic_id);
create index if not exists idx_staff_modules_staff_id on public.staff_modules(staff_id);
create index if not exists idx_staff_permissions_staff_id on public.staff_permissions(staff_id);
create index if not exists idx_audit_logs_clinic_id on public.audit_logs(clinic_id);
create index if not exists idx_audit_logs_actor_id on public.audit_logs(actor_id);
create index if not exists idx_audit_logs_created_at on public.audit_logs(created_at);

drop trigger if exists set_clinics_updated_at on public.clinics;
create trigger set_clinics_updated_at before update on public.clinics
for each row execute function public.set_updated_at();

drop trigger if exists set_branches_updated_at on public.branches;
create trigger set_branches_updated_at before update on public.branches
for each row execute function public.set_updated_at();

drop trigger if exists set_staff_profiles_updated_at on public.staff_profiles;
create trigger set_staff_profiles_updated_at before update on public.staff_profiles
for each row execute function public.set_updated_at();

insert into public.roles (key, name, description, is_system)
values
  ('super_admin', 'Super Admin', 'Platform-level administrator.', true),
  ('owner', 'Owner', 'Clinic owner and administrator.', true),
  ('receptionist', 'Receptionist', 'Front desk and appointment operations.', true),
  ('doctor', 'Doctor', 'Clinical consultation and prescription workflows.', true),
  ('pharmacist', 'Pharmacist', 'Pharmacy stock and dispensing workflows.', true)
on conflict (key) do update set
  name = excluded.name,
  description = excluded.description,
  is_system = excluded.is_system;

insert into public.modules (key, name, description, category)
values
  ('dashboard', 'Dashboard', 'Workspace overview.', 'core'),
  ('appointments', 'Appointments', 'Appointment and queue workflows.', 'operations'),
  ('whatsapp', 'WhatsApp', 'WhatsApp booking and conversations.', 'communication'),
  ('patients', 'Patients', 'Clinical patient records.', 'clinical'),
  ('consultation', 'Consultation', 'Doctor consultation workflow.', 'clinical'),
  ('prescriptions', 'Prescriptions', 'Prescription workflow.', 'clinical'),
  ('pharmacy', 'Pharmacy', 'Inventory and dispensing workflow.', 'operations'),
  ('billing', 'Billing', 'Manual billing workflow.', 'finance'),
  ('reports', 'Reports', 'Reports and analytics.', 'analytics'),
  ('staff', 'Staff', 'Staff management.', 'admin'),
  ('settings', 'Settings', 'Clinic settings.', 'admin'),
  ('subscription', 'Subscription', 'Clinic subscription settings.', 'platform'),
  ('support', 'Support', 'Support tickets.', 'platform'),
  ('delivery', 'Delivery', 'Delivery coordination.', 'operations'),
  ('availability', 'Availability', 'Doctor availability.', 'clinical'),
  ('reminders', 'Reminders', 'Patient reminders.', 'communication'),
  ('follow_ups', 'Follow Ups', 'Follow-up workflow.', 'clinical')
on conflict (key) do update set
  name = excluded.name,
  description = excluded.description,
  category = excluded.category;

insert into public.permissions (key, name, module_key, action, description)
select
  modules.key || '.' || actions.action,
  initcap(replace(modules.key, '_', ' ')) || ' ' || initcap(actions.action),
  modules.key,
  actions.action,
  'Allows ' || actions.action || ' on ' || modules.key || '.'
from public.modules
cross join (
  values ('view'), ('create'), ('edit'), ('assign'), ('approve'), ('cancel'),
         ('delete'), ('bill'), ('dispense'), ('export'), ('manage'), ('configure')
) as actions(action)
on conflict (key) do update set
  name = excluded.name,
  module_key = excluded.module_key,
  action = excluded.action,
  description = excluded.description;

insert into public.role_modules (role_key, module_key, enabled)
select 'super_admin', key, true from public.modules
on conflict (role_key, module_key) do update set enabled = excluded.enabled;

insert into public.role_modules (role_key, module_key, enabled)
select 'owner', key, true from public.modules
where key <> 'support'
on conflict (role_key, module_key) do update set enabled = excluded.enabled;

insert into public.role_modules (role_key, module_key, enabled)
values
  ('receptionist', 'dashboard', true),
  ('receptionist', 'appointments', true),
  ('receptionist', 'patients', true),
  ('receptionist', 'billing', true),
  ('receptionist', 'whatsapp', true),
  ('doctor', 'appointments', true),
  ('doctor', 'patients', true),
  ('doctor', 'consultation', true),
  ('doctor', 'prescriptions', true),
  ('doctor', 'availability', true),
  ('doctor', 'reminders', true),
  ('doctor', 'follow_ups', true),
  ('pharmacist', 'dashboard', true),
  ('pharmacist', 'pharmacy', true),
  ('pharmacist', 'prescriptions', true),
  ('pharmacist', 'billing', true)
on conflict (role_key, module_key) do update set enabled = excluded.enabled;

insert into public.role_permissions (role_key, permission_key, allowed)
select 'super_admin', key, true from public.permissions
on conflict (role_key, permission_key) do update set allowed = excluded.allowed;

insert into public.role_permissions (role_key, permission_key, allowed)
select 'owner', p.key, true
from public.permissions p
where p.module_key <> 'support'
on conflict (role_key, permission_key) do update set allowed = excluded.allowed;

insert into public.role_permissions (role_key, permission_key, allowed)
select rm.role_key, p.key, true
from public.role_modules rm
join public.permissions p on p.module_key = rm.module_key
where rm.role_key in ('receptionist', 'doctor', 'pharmacist')
  and p.action in ('view', 'create', 'edit', 'assign', 'cancel', 'bill', 'dispense', 'configure')
on conflict (role_key, permission_key) do update set allowed = excluded.allowed;

create or replace function public.current_staff_profile()
returns public.staff_profiles
language sql
security definer
set search_path = public
stable
as $$
  select *
  from public.staff_profiles
  where id = auth.uid()
  limit 1
$$;

create or replace function public.current_clinic_id()
returns uuid
language sql
security definer
set search_path = public
stable
as $$
  select clinic_id
  from public.staff_profiles
  where id = auth.uid()
  limit 1
$$;

create or replace function public.is_super_admin()
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
      and role_key = 'super_admin'
      and status = 'active'
  )
$$;

create or replace function public.has_module(module_key text)
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
      join public.clinic_modules cm on cm.clinic_id = sp.clinic_id and cm.module_key = $1 and cm.enabled
      left join public.staff_modules sm on sm.staff_id = sp.id and sm.module_key = $1
      left join public.role_modules rm on rm.role_key = sp.role_key and rm.module_key = $1
      where sp.id = auth.uid()
        and sp.status = 'active'
        and coalesce(sm.enabled, rm.enabled, false)
    )
$$;

create or replace function public.has_permission(permission_key text)
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
      left join public.staff_permissions sper on sper.staff_id = sp.id and sper.permission_key = $1
      left join public.role_permissions rper on rper.role_key = sp.role_key and rper.permission_key = $1
      where sp.id = auth.uid()
        and sp.status = 'active'
        and coalesce(sper.allowed, rper.allowed, false)
    )
$$;

alter table public.clinics enable row level security;
alter table public.branches enable row level security;
alter table public.roles enable row level security;
alter table public.modules enable row level security;
alter table public.permissions enable row level security;
alter table public.staff_profiles enable row level security;
alter table public.clinic_modules enable row level security;
alter table public.staff_modules enable row level security;
alter table public.staff_permissions enable row level security;
alter table public.role_modules enable row level security;
alter table public.role_permissions enable row level security;
alter table public.audit_logs enable row level security;

create policy "super_admin_manage_clinics" on public.clinics for all to authenticated using (public.is_super_admin()) with check (public.is_super_admin());
create policy "staff_view_own_clinic" on public.clinics for select to authenticated using (id = public.current_clinic_id());

create policy "super_admin_manage_branches" on public.branches for all to authenticated using (public.is_super_admin()) with check (public.is_super_admin());
create policy "staff_view_clinic_branches" on public.branches for select to authenticated using (clinic_id = public.current_clinic_id());

create policy "authenticated_view_roles" on public.roles for select to authenticated using (true);
create policy "super_admin_manage_roles" on public.roles for all to authenticated using (public.is_super_admin()) with check (public.is_super_admin());

create policy "authenticated_view_modules" on public.modules for select to authenticated using (true);
create policy "super_admin_manage_modules" on public.modules for all to authenticated using (public.is_super_admin()) with check (public.is_super_admin());

create policy "authenticated_view_permissions" on public.permissions for select to authenticated using (true);
create policy "super_admin_manage_permissions" on public.permissions for all to authenticated using (public.is_super_admin()) with check (public.is_super_admin());

create policy "super_admin_manage_staff_profiles" on public.staff_profiles for all to authenticated using (public.is_super_admin()) with check (public.is_super_admin());
create policy "staff_view_own_profile" on public.staff_profiles for select to authenticated using (id = auth.uid());

create policy "super_admin_manage_clinic_modules" on public.clinic_modules for all to authenticated using (public.is_super_admin()) with check (public.is_super_admin());
create policy "staff_view_clinic_modules" on public.clinic_modules for select to authenticated using (clinic_id = public.current_clinic_id() and enabled);

create policy "super_admin_manage_staff_modules" on public.staff_modules for all to authenticated using (public.is_super_admin()) with check (public.is_super_admin());
create policy "staff_view_own_modules" on public.staff_modules for select to authenticated using (staff_id = auth.uid());

create policy "super_admin_manage_staff_permissions" on public.staff_permissions for all to authenticated using (public.is_super_admin()) with check (public.is_super_admin());
create policy "staff_view_own_permissions" on public.staff_permissions for select to authenticated using (staff_id = auth.uid());

create policy "authenticated_view_role_modules" on public.role_modules for select to authenticated using (true);
create policy "super_admin_manage_role_modules" on public.role_modules for all to authenticated using (public.is_super_admin()) with check (public.is_super_admin());

create policy "authenticated_view_role_permissions" on public.role_permissions for select to authenticated using (true);
create policy "super_admin_manage_role_permissions" on public.role_permissions for all to authenticated using (public.is_super_admin()) with check (public.is_super_admin());

create policy "authenticated_insert_audit_logs" on public.audit_logs
for insert to authenticated
with check (
  actor_id is null
  or actor_id = auth.uid()
);

create policy "super_admin_view_audit_logs" on public.audit_logs for select to authenticated using (public.is_super_admin());
create policy "staff_view_clinic_audit_logs" on public.audit_logs for select to authenticated using (clinic_id = public.current_clinic_id());
