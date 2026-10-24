create table if not exists public.report_snapshots (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  branch_id uuid references public.branches(id) on delete set null,
  report_type text not null,
  period_start date,
  period_end date,
  data jsonb not null default '{}',
  generated_by uuid references public.staff_profiles(id) on delete set null,
  generated_at timestamptz default now(),
  created_at timestamptz default now()
);

create index if not exists idx_report_snapshots_clinic_id on public.report_snapshots(clinic_id);
create index if not exists idx_report_snapshots_branch_id on public.report_snapshots(branch_id);
create index if not exists idx_report_snapshots_report_type on public.report_snapshots(report_type);
create index if not exists idx_report_snapshots_period on public.report_snapshots(period_start, period_end);

alter table public.report_snapshots enable row level security;

create policy "super_admin_manage_report_snapshots" on public.report_snapshots
for all to authenticated
using (public.is_super_admin())
with check (public.is_super_admin());

create policy "clinic_staff_view_report_snapshots" on public.report_snapshots
for select to authenticated
using (
  clinic_id = public.current_clinic_id()
  and (
    public.has_permission('reports.view')
    or public.has_permission('reports.manage')
    or public.has_permission('billing.view')
  )
);

create policy "clinic_admin_generate_report_snapshots" on public.report_snapshots
for insert to authenticated
with check (
  clinic_id = public.current_clinic_id()
  and (
    public.has_permission('reports.create')
    or public.has_permission('reports.manage')
    or public.has_permission('reports.export')
  )
);

create policy "clinic_admin_update_report_snapshots" on public.report_snapshots
for update to authenticated
using (
  clinic_id = public.current_clinic_id()
  and (
    public.has_permission('reports.edit')
    or public.has_permission('reports.manage')
  )
)
with check (
  clinic_id = public.current_clinic_id()
  and (
    public.has_permission('reports.edit')
    or public.has_permission('reports.manage')
  )
);
