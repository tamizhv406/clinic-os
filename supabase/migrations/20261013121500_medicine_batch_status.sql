-- =====================================================================
-- Block / unblock a stock batch (Phase 16, Task 6)
-- =====================================================================
-- Medicine Stock's "Mark batch blocked" (e.g. a recall or quality hold).
-- A blocked batch cannot be dispensed (dispense_pharmacy_order requires
-- status 'active') and cannot be topped up by create_stock_purchase.
--
-- Status change, audit row and low-stock refresh happen in one transaction,
-- permission-checked on the server (pharmacy.manage). Unblocking restores the
-- status the batch should have: 'expired' when past its expiry date,
-- 'depleted' when empty, otherwise 'active'. Safe to re-run.
-- =====================================================================

create or replace function public.set_medicine_batch_status(input jsonb)
returns public.medicine_stock_batches
language plpgsql
security definer
set search_path = public
as $$
declare
  v_staff public.staff_profiles;
  v_batch public.medicine_stock_batches;
  v_medicine_name text;
  v_today date := (now() at time zone 'Asia/Kolkata')::date;
  v_action text := lower(btrim(coalesce(input->>'action', '')));
  v_reason text := nullif(btrim(coalesce(input->>'reason', '')), '');
  v_old_status text;
  v_new_status text;
begin
  select * into v_staff from public.staff_profiles where id = auth.uid() and status = 'active';
  if v_staff.id is null then
    raise exception 'An active staff profile is required.' using errcode = '42501';
  end if;
  if not (public.is_super_admin() or (public.has_module('pharmacy') and public.has_permission('pharmacy.manage'))) then
    raise exception 'You do not have permission to block or unblock stock.' using errcode = '42501';
  end if;
  if v_action not in ('block', 'unblock') then
    raise exception 'Action must be "block" or "unblock".' using errcode = '22023';
  end if;
  if v_action = 'block' and v_reason is null then
    raise exception 'A reason is required to block a batch.' using errcode = '22023';
  end if;
  if v_reason is not null and length(v_reason) > 500 then
    raise exception 'Reason is too long (max 500 characters).' using errcode = '22023';
  end if;

  select * into v_batch from public.medicine_stock_batches
  where id = nullif(input->>'batch_id', '')::uuid
  for update;
  if v_batch.id is null then
    raise exception 'Stock batch not found.' using errcode = 'P0002';
  end if;
  if not public.is_super_admin() and v_batch.clinic_id is distinct from v_staff.clinic_id then
    raise exception 'Stock batch is outside your clinic.' using errcode = '42501';
  end if;

  v_old_status := coalesce(v_batch.status, 'active');
  if v_action = 'block' then
    if v_old_status = 'blocked' then
      return v_batch;
    end if;
    v_new_status := 'blocked';
  else
    if v_old_status <> 'blocked' then
      return v_batch;
    end if;
    v_new_status := case
      when v_batch.expiry_date is not null and v_batch.expiry_date < v_today then 'expired'
      when v_batch.quantity_available <= 0 then 'depleted'
      else 'active'
    end;
  end if;

  update public.medicine_stock_batches set status = v_new_status where id = v_batch.id returning * into v_batch;

  select name into v_medicine_name from public.medicines where id = v_batch.medicine_id;

  insert into public.audit_logs (
    clinic_id, branch_id, actor_id, user_id, actor_role, event_type, action, entity_type, entity_id,
    status, severity, message, metadata
  )
  values (
    v_batch.clinic_id, v_batch.branch_id, v_staff.id, v_staff.id, v_staff.role_key,
    case when v_action = 'block' then 'pharmacy_batch_blocked' else 'pharmacy_batch_unblocked' end,
    v_action, 'medicine_stock_batches', v_batch.id, 'success', case when v_action = 'block' then 'warning' else 'info' end,
    format('Batch %s of %s %s.', v_batch.batch_no, coalesce(v_medicine_name, 'medicine'), case when v_action = 'block' then 'blocked' else 'unblocked' end),
    jsonb_build_object('reason', v_reason, 'old_status', v_old_status, 'new_status', v_new_status, 'quantity', v_batch.quantity_available)
  );

  perform public.refresh_low_stock_alerts(v_batch.clinic_id, v_batch.branch_id);
  return v_batch;
end;
$$;

revoke all on function public.set_medicine_batch_status(jsonb) from public, anon;
grant execute on function public.set_medicine_batch_status(jsonb) to authenticated;
