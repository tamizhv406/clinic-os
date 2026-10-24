alter table public.audit_logs
  add column if not exists user_id uuid references public.staff_profiles(id) on delete set null,
  add column if not exists actor_role text,
  add column if not exists event_type text default 'audit',
  add column if not exists status text default 'success',
  add column if not exists severity text default 'info',
  add column if not exists message text,
  add column if not exists ip_address inet,
  add column if not exists user_agent text;

update public.audit_logs
set user_id = coalesce(user_id, actor_id),
    event_type = coalesce(event_type, action, 'audit'),
    status = coalesce(status, 'success'),
    severity = coalesce(severity, 'info')
where user_id is null or event_type is null or status is null or severity is null;

create table if not exists public.system_health_checks (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid references public.clinics(id) on delete cascade,
  branch_id uuid references public.branches(id) on delete set null,
  user_id uuid references public.staff_profiles(id) on delete set null,
  actor_role text,
  event_type text not null default 'health_check',
  entity_type text,
  entity_id uuid,
  action text not null default 'check',
  status text not null default 'ok' check (status in ('ok','degraded','down','unknown')),
  severity text not null default 'info' check (severity in ('debug','info','warning','error','critical')),
  message text,
  ip_address inet,
  user_agent text,
  metadata jsonb not null default '{}',
  created_at timestamptz default now()
);

create table if not exists public.app_error_logs (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid references public.clinics(id) on delete cascade,
  branch_id uuid references public.branches(id) on delete set null,
  user_id uuid references public.staff_profiles(id) on delete set null,
  actor_role text,
  event_type text not null default 'app_error',
  entity_type text,
  entity_id uuid,
  action text,
  status text not null default 'open' check (status in ('open','acknowledged','resolved','ignored')),
  severity text not null default 'error' check (severity in ('debug','info','warning','error','critical')),
  message text not null,
  ip_address inet,
  user_agent text,
  metadata jsonb not null default '{}',
  created_at timestamptz default now()
);

create table if not exists public.security_events (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid references public.clinics(id) on delete cascade,
  branch_id uuid references public.branches(id) on delete set null,
  user_id uuid references public.staff_profiles(id) on delete set null,
  actor_role text,
  event_type text not null default 'security_event',
  entity_type text,
  entity_id uuid,
  action text,
  status text not null default 'recorded' check (status in ('recorded','reviewed','resolved','ignored')),
  severity text not null default 'warning' check (severity in ('debug','info','warning','error','critical')),
  message text not null,
  ip_address inet,
  user_agent text,
  metadata jsonb not null default '{}',
  created_at timestamptz default now()
);

create table if not exists public.background_job_logs (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid references public.clinics(id) on delete cascade,
  branch_id uuid references public.branches(id) on delete set null,
  user_id uuid references public.staff_profiles(id) on delete set null,
  actor_role text,
  event_type text not null default 'background_job',
  entity_type text,
  entity_id uuid,
  action text,
  status text not null default 'queued' check (status in ('queued','running','success','failed','cancelled')),
  severity text not null default 'info' check (severity in ('debug','info','warning','error','critical')),
  message text,
  ip_address inet,
  user_agent text,
  metadata jsonb not null default '{}',
  created_at timestamptz default now()
);

create index if not exists idx_audit_logs_user_id on public.audit_logs(user_id);
create index if not exists idx_audit_logs_event_type on public.audit_logs(event_type);
create index if not exists idx_audit_logs_status on public.audit_logs(status);
create index if not exists idx_audit_logs_severity on public.audit_logs(severity);
create index if not exists idx_system_health_checks_clinic_id on public.system_health_checks(clinic_id);
create index if not exists idx_system_health_checks_status on public.system_health_checks(status);
create index if not exists idx_system_health_checks_created_at on public.system_health_checks(created_at);
create index if not exists idx_app_error_logs_clinic_id on public.app_error_logs(clinic_id);
create index if not exists idx_app_error_logs_status on public.app_error_logs(status);
create index if not exists idx_app_error_logs_severity on public.app_error_logs(severity);
create index if not exists idx_app_error_logs_created_at on public.app_error_logs(created_at);
create index if not exists idx_security_events_clinic_id on public.security_events(clinic_id);
create index if not exists idx_security_events_status on public.security_events(status);
create index if not exists idx_security_events_severity on public.security_events(severity);
create index if not exists idx_security_events_created_at on public.security_events(created_at);
create index if not exists idx_background_job_logs_clinic_id on public.background_job_logs(clinic_id);
create index if not exists idx_background_job_logs_status on public.background_job_logs(status);
create index if not exists idx_background_job_logs_created_at on public.background_job_logs(created_at);

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
        and sp.role_key = 'owner'
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

alter table public.system_health_checks enable row level security;
alter table public.app_error_logs enable row level security;
alter table public.security_events enable row level security;
alter table public.background_job_logs enable row level security;

drop policy if exists "staff_view_clinic_audit_logs" on public.audit_logs;
drop policy if exists "super_admin_view_audit_logs" on public.audit_logs;
drop policy if exists "authenticated_insert_audit_logs" on public.audit_logs;
drop policy if exists "super_admin_manage_audit_logs" on public.audit_logs;
drop policy if exists "owner_read_own_clinic_audit_logs" on public.audit_logs;

create policy "super_admin_manage_audit_logs" on public.audit_logs
for all to authenticated
using (public.is_super_admin())
with check (public.is_super_admin());

create policy "owner_read_own_clinic_audit_logs" on public.audit_logs
for select to authenticated
using (public.can_read_monitoring_logs(clinic_id));

create policy "authenticated_insert_audit_logs" on public.audit_logs
for insert to authenticated
with check (
  public.is_super_admin()
  or (
    (clinic_id is null or clinic_id = public.current_clinic_id())
    and (coalesce(user_id, actor_id) is null or coalesce(user_id, actor_id) = auth.uid())
  )
);

create policy "super_admin_manage_system_health_checks" on public.system_health_checks for all to authenticated using (public.is_super_admin()) with check (public.is_super_admin());
create policy "owner_read_own_clinic_system_health_checks" on public.system_health_checks for select to authenticated using (public.can_read_monitoring_logs(clinic_id));
create policy "authenticated_insert_system_health_checks" on public.system_health_checks for insert to authenticated with check (public.is_super_admin() or clinic_id is null or clinic_id = public.current_clinic_id());

create policy "super_admin_manage_app_error_logs" on public.app_error_logs for all to authenticated using (public.is_super_admin()) with check (public.is_super_admin());
create policy "owner_read_own_clinic_app_error_logs" on public.app_error_logs for select to authenticated using (public.can_read_monitoring_logs(clinic_id));
create policy "authenticated_insert_app_error_logs" on public.app_error_logs for insert to authenticated with check (public.is_super_admin() or clinic_id is null or clinic_id = public.current_clinic_id());

create policy "super_admin_manage_security_events" on public.security_events for all to authenticated using (public.is_super_admin()) with check (public.is_super_admin());
create policy "owner_read_own_clinic_security_events" on public.security_events for select to authenticated using (public.can_read_monitoring_logs(clinic_id));
create policy "authenticated_insert_security_events" on public.security_events for insert to authenticated with check (public.is_super_admin() or clinic_id is null or clinic_id = public.current_clinic_id());

create policy "super_admin_manage_background_job_logs" on public.background_job_logs for all to authenticated using (public.is_super_admin()) with check (public.is_super_admin());
create policy "owner_read_own_clinic_background_job_logs" on public.background_job_logs for select to authenticated using (public.can_read_monitoring_logs(clinic_id));
create policy "authenticated_insert_background_job_logs" on public.background_job_logs for insert to authenticated with check (public.is_super_admin() or clinic_id is null or clinic_id = public.current_clinic_id());

revoke all on function public.can_read_monitoring_logs(uuid) from public;
grant execute on function public.can_read_monitoring_logs(uuid) to authenticated;
