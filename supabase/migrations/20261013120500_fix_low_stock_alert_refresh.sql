-- =====================================================================
-- Fix refresh_low_stock_alerts (Phase 16, found while testing Task 4)
-- =====================================================================
-- The phase 9 version cannot run: its parameters are named clinic_id and
-- branch_id, so "on conflict (medicine_id, branch_id, status)" is ambiguous
-- in PL/pgSQL (error 42702). Every caller fails, including
-- adjust_medicine_stock, dispense_pharmacy_order and the Low Stock page.
--
-- It also could not resolve an alert once a resolved row already existed for
-- the same medicine and branch (unique key medicine_id, branch_id, status),
-- and the unique key never matches rows whose branch_id is NULL.
--
-- This version keeps the same signature and parameter names (the frontend
-- calls it by name), the same permission rule and the same stock rule
-- (sum of quantity in 'active' batches <= reorder_level, reorder_level > 0).
-- Safe to re-run.
-- =====================================================================

-- Medicines in scope that are at or below their reorder level.
create or replace function public._low_stock_candidates(p_clinic_id uuid, p_branch_id uuid)
returns table (medicine_id uuid, branch_id uuid, current_stock int, reorder_level int)
language sql
stable
set search_path = public
as $$
  select
    m.id,
    coalesce(p_branch_id, m.branch_id),
    coalesce(sum(b.quantity_available) filter (where b.status = 'active'), 0)::int,
    coalesce(m.reorder_level, 0)
  from public.medicines m
  left join public.medicine_stock_batches b
    on b.medicine_id = m.id
   and b.clinic_id = m.clinic_id
   and (p_branch_id is null or b.branch_id = p_branch_id)
  where m.clinic_id = p_clinic_id
    and (p_branch_id is null or m.branch_id is null or m.branch_id = p_branch_id)
    and m.status = 'active'
  group by m.id, m.branch_id, m.reorder_level
  having coalesce(m.reorder_level, 0) > 0
     and coalesce(sum(b.quantity_available) filter (where b.status = 'active'), 0)::int <= coalesce(m.reorder_level, 0)
$$;

revoke all on function public._low_stock_candidates(uuid, uuid) from public, anon, authenticated;

create or replace function public.refresh_low_stock_alerts(clinic_id uuid, branch_id uuid default null)
returns integer
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  staff_row public.staff_profiles;
  v_clinic uuid := refresh_low_stock_alerts.clinic_id;
  v_branch uuid := refresh_low_stock_alerts.branch_id;
  v_updated int := 0;
  v_inserted int := 0;
begin
  select * into staff_row from public.staff_profiles where id = auth.uid() and status = 'active';
  if staff_row.id is null and not public.is_super_admin() then
    raise exception 'Active staff profile required';
  end if;
  if not public.is_super_admin() and v_clinic is distinct from staff_row.clinic_id then
    raise exception 'Clinic is outside current scope';
  end if;

  -- 1. Still-low medicines: refresh the numbers on their open alert.
  update public.low_stock_alerts a
  set current_stock = l.current_stock,
      reorder_level = l.reorder_level,
      resolved_at = null
  from public._low_stock_candidates(v_clinic, v_branch) l
  where a.clinic_id = v_clinic
    and a.status = 'active'
    and a.medicine_id = l.medicine_id
    and a.branch_id is not distinct from l.branch_id;
  get diagnostics v_updated = row_count;

  -- 2. Newly low medicines: open an alert.
  insert into public.low_stock_alerts (clinic_id, branch_id, medicine_id, current_stock, reorder_level, status)
  select v_clinic, l.branch_id, l.medicine_id, l.current_stock, l.reorder_level, 'active'
  from public._low_stock_candidates(v_clinic, v_branch) l
  where not exists (
    select 1 from public.low_stock_alerts a
    where a.status = 'active'
      and a.medicine_id = l.medicine_id
      and a.branch_id is not distinct from l.branch_id
  );
  get diagnostics v_inserted = row_count;

  -- 3. Recovered medicines: close their alert. The unique key allows one
  --    resolved row per medicine and branch, so the previous one is removed first.
  delete from public.low_stock_alerts r
  using public.low_stock_alerts a
  where a.clinic_id = v_clinic
    and a.status = 'active'
    and (v_branch is null or a.branch_id = v_branch)
    and r.status = 'resolved'
    and r.medicine_id = a.medicine_id
    and r.branch_id is not distinct from a.branch_id
    and not exists (
      select 1 from public._low_stock_candidates(v_clinic, v_branch) l
      where l.medicine_id = a.medicine_id and l.branch_id is not distinct from a.branch_id
    );

  update public.low_stock_alerts a
  set status = 'resolved',
      resolved_at = now()
  where a.clinic_id = v_clinic
    and a.status = 'active'
    and (v_branch is null or a.branch_id = v_branch)
    and not exists (
      select 1 from public._low_stock_candidates(v_clinic, v_branch) l
      where l.medicine_id = a.medicine_id and l.branch_id is not distinct from a.branch_id
    );

  return v_updated + v_inserted;
end;
$$;

revoke all on function public.refresh_low_stock_alerts(uuid, uuid) from public, anon;
grant execute on function public.refresh_low_stock_alerts(uuid, uuid) to authenticated;
