-- =====================================================================
-- Doctor prescriptions reliably reach the pharmacist (Phase 16, Task 7)
-- =====================================================================
-- Before: a routed prescription became a pharmacy order only when a
-- pharmacist opened the Prescription Queue page, and medicines matched only
-- by exact name.
--
-- Now the database creates the order itself:
--   * public._ensure_pharmacy_order(prescription_id) - internal, idempotent,
--     creates the order and adds any prescription items it does not have yet.
--   * a trigger on prescriptions (insert / send_to_pharmacy turned on);
--   * create_prescription_with_items and route_prescription_to_pharmacy call it
--     at the end (items are inserted after the header, so the trigger alone
--     would see an empty prescription);
--   * existing routed prescriptions without an order are back-filled;
--   * pharmacy_orders is added to the supabase_realtime publication.
--
-- Also fixed here, because the new queue depends on them:
--   * route_prescription_to_pharmacy no longer moves a received/dispensed
--     prescription back to "sent_to_pharmacy";
--   * dispense_pharmacy_order uses the clinic's date (IST) for expiry, refuses
--     cancelled orders and refuses more than was prescribed;
--   * create_invoice_from_pharmacy_order bills only what was dispensed;
--   * new: mark_pharmacy_order_item_unavailable, acknowledge_pharmacy_order.
-- Safe to re-run.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------

create or replace function public._normalize_medicine_name(value text)
returns text
language sql
immutable
set search_path = public
as $$
  select regexp_replace(lower(coalesce(value, '')), '[[:space:].\-]', '', 'g')
$$;

-- Units that can be dispensed today: active batch, stock left, not past expiry (IST).
create or replace function public._usable_stock(p_medicine_id uuid)
returns int
language sql
stable
set search_path = public
as $$
  select coalesce(sum(b.quantity_available), 0)::int
  from public.medicine_stock_batches b
  where b.medicine_id = p_medicine_id
    and coalesce(b.status, 'active') = 'active'
    and b.quantity_available > 0
    and (b.expiry_date is null or b.expiry_date >= (now() at time zone 'Asia/Kolkata')::date)
$$;

-- Best catalogue match for a prescribed medicine, in priority order:
-- medicine_id -> exact name -> normalised name -> name starting with the
-- prescribed text -> generic name. Within a tier, a medicine with stock wins.
create or replace function public._match_prescribed_medicine(p_clinic_id uuid, p_medicine_id uuid, p_name text)
returns uuid
language plpgsql
stable
set search_path = public
as $$
declare
  v_name text := lower(btrim(coalesce(p_name, '')));
  v_norm text := public._normalize_medicine_name(p_name);
  v_match uuid;
begin
  if p_medicine_id is not null then
    select m.id into v_match from public.medicines m
    where m.id = p_medicine_id and m.clinic_id = p_clinic_id and m.status = 'active';
    if v_match is not null then return v_match; end if;
  end if;
  if v_name = '' then return null; end if;

  select m.id into v_match from public.medicines m
  where m.clinic_id = p_clinic_id and m.status = 'active' and lower(btrim(m.name)) = v_name
  order by public._usable_stock(m.id) > 0 desc, m.created_at
  limit 1;
  if v_match is not null then return v_match; end if;

  select m.id into v_match from public.medicines m
  where m.clinic_id = p_clinic_id and m.status = 'active' and public._normalize_medicine_name(m.name) = v_norm
  order by public._usable_stock(m.id) > 0 desc, m.created_at
  limit 1;
  if v_match is not null then return v_match; end if;

  -- Very short text ("p") would match half the catalogue, so prefix matching needs 4+ characters.
  if length(v_norm) >= 4 then
    select m.id into v_match from public.medicines m
    where m.clinic_id = p_clinic_id and m.status = 'active' and public._normalize_medicine_name(m.name) like v_norm || '%'
    order by public._usable_stock(m.id) > 0 desc, length(m.name), m.created_at
    limit 1;
    if v_match is not null then return v_match; end if;
  end if;

  select m.id into v_match from public.medicines m
  where m.clinic_id = p_clinic_id and m.status = 'active' and m.generic_name is not null
    and public._normalize_medicine_name(m.generic_name) = v_norm
  order by public._usable_stock(m.id) > 0 desc, m.created_at
  limit 1;
  return v_match;
end;
$$;

-- "10 tablets" -> 10; anything without a leading whole number -> 1.
create or replace function public._prescribed_quantity(value text)
returns int
language sql
immutable
set search_path = public
as $$
  select least(greatest(coalesce(substring(coalesce(value, '') from '^\s*(\d{1,6})')::int, 1), 1), 100000)
$$;

-- ---------------------------------------------------------------------
-- Internal: create the order / add missing items. No permission checks.
-- ---------------------------------------------------------------------
create or replace function public._ensure_pharmacy_order(p_prescription_id uuid)
returns public.pharmacy_orders
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rx public.prescriptions;
  v_order public.pharmacy_orders;
  v_item record;
  v_medicine_id uuid;
  v_medicine_name text;
  v_stock int;
begin
  select * into v_rx from public.prescriptions where id = p_prescription_id for update;
  if v_rx.id is null or not coalesce(v_rx.send_to_pharmacy, false) or v_rx.status = 'cancelled' then
    return null;
  end if;

  select * into v_order from public.pharmacy_orders where prescription_id = v_rx.id for update;
  if v_order.id is null then
    insert into public.pharmacy_orders (clinic_id, branch_id, prescription_id, patient_id, doctor_id, status, total_items, created_by)
    values (v_rx.clinic_id, v_rx.branch_id, v_rx.id, v_rx.patient_id, v_rx.doctor_id, 'pending', 0,
            (select sp.id from public.staff_profiles sp where sp.id = auth.uid()))
    on conflict (prescription_id) do nothing
    returning * into v_order;
    if v_order.id is null then
      select * into v_order from public.pharmacy_orders where prescription_id = v_rx.id for update;
    end if;
  end if;

  -- Items are only added while the order is still open.
  if v_order.status in ('pending', 'partially_dispensed') then
    for v_item in
      select pi.* from public.prescription_items pi
      where pi.prescription_id = v_rx.id
        and not exists (select 1 from public.pharmacy_order_items poi where poi.pharmacy_order_id = v_order.id and poi.prescription_item_id = pi.id)
      order by pi.sort_order, pi.created_at
    loop
      v_medicine_id := public._match_prescribed_medicine(v_rx.clinic_id, v_item.medicine_id, v_item.medicine_name);
      v_stock := case when v_medicine_id is null then 0 else public._usable_stock(v_medicine_id) end;
      select name into v_medicine_name from public.medicines where id = v_medicine_id;

      insert into public.pharmacy_order_items (
        clinic_id, pharmacy_order_id, prescription_item_id, medicine_id, medicine_name,
        requested_quantity, dispensed_quantity, status, notes
      )
      values (
        v_rx.clinic_id, v_order.id, v_item.id, v_medicine_id, v_item.medicine_name,
        public._prescribed_quantity(v_item.quantity), 0,
        case when v_medicine_id is null or v_stock = 0 then 'unavailable' else 'pending' end,
        case
          when v_medicine_id is null then 'No matching medicine in the pharmacy catalogue'
          when v_stock = 0 then format('Out of stock (matched %s)', v_medicine_name)
          when lower(btrim(v_medicine_name)) <> lower(btrim(v_item.medicine_name)) then format('Matched to %s', v_medicine_name)
          else null
        end
      );
    end loop;

    update public.pharmacy_orders o
    set total_items = (select count(*) from public.pharmacy_order_items poi where poi.pharmacy_order_id = o.id)
    where o.id = v_order.id
    returning * into v_order;
  end if;

  return v_order;
end;
$$;

revoke all on function public._ensure_pharmacy_order(uuid) from public, anon, authenticated;
revoke all on function public._match_prescribed_medicine(uuid, uuid, text) from public, anon, authenticated;
revoke all on function public._usable_stock(uuid) from public, anon, authenticated;
revoke all on function public._prescribed_quantity(text) from public, anon, authenticated;
revoke all on function public._normalize_medicine_name(text) from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- Public wrapper: same signature as before, permission-checked.
-- ---------------------------------------------------------------------
create or replace function public.create_pharmacy_order_from_prescription(prescription_id uuid)
returns public.pharmacy_orders
language plpgsql
security definer
set search_path = public
as $$
declare
  staff_row public.staff_profiles;
  prescription_row public.prescriptions;
  order_row public.pharmacy_orders;
begin
  select * into staff_row from public.staff_profiles where id = auth.uid() and status = 'active';
  if staff_row.id is null and not public.is_super_admin() then
    raise exception 'Active staff profile required';
  end if;

  select * into prescription_row from public.prescriptions p where p.id = create_pharmacy_order_from_prescription.prescription_id;
  if prescription_row.id is null then
    raise exception 'Prescription not found';
  end if;
  if not public.is_super_admin() and prescription_row.clinic_id <> staff_row.clinic_id then
    raise exception 'Prescription is outside current clinic';
  end if;
  if not coalesce(prescription_row.send_to_pharmacy, false) then
    raise exception 'Prescription is not routed to pharmacy';
  end if;
  if not (
    public.is_super_admin()
    or (public.has_module('pharmacy') and (public.has_permission('pharmacy.dispense') or public.has_permission('pharmacy.manage') or public.has_permission('pharmacy.create')))
  ) then
    raise exception 'Pharmacy order permission required';
  end if;

  order_row := public._ensure_pharmacy_order(prescription_row.id);
  if order_row.id is null then
    raise exception 'Prescription cannot be sent to pharmacy (cancelled)';
  end if;
  return order_row;
end;
$$;

revoke all on function public.create_pharmacy_order_from_prescription(uuid) from public, anon;
grant execute on function public.create_pharmacy_order_from_prescription(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- Trigger
-- ---------------------------------------------------------------------
create or replace function public._prescriptions_sync_pharmacy_order()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(new.send_to_pharmacy, false)
     and (tg_op = 'INSERT' or not coalesce(old.send_to_pharmacy, false)) then
    perform public._ensure_pharmacy_order(new.id);
  end if;
  return null;
end;
$$;

revoke all on function public._prescriptions_sync_pharmacy_order() from public, anon, authenticated;

drop trigger if exists prescriptions_sync_pharmacy_order on public.prescriptions;
create trigger prescriptions_sync_pharmacy_order
after insert or update of send_to_pharmacy on public.prescriptions
for each row execute function public._prescriptions_sync_pharmacy_order();

-- ---------------------------------------------------------------------
-- create_prescription_with_items: unchanged behaviour, plus the pharmacy
-- order (with its items) when the prescription is sent to pharmacy.
-- ---------------------------------------------------------------------
create or replace function public.create_prescription_with_items(input jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  staff_row public.staff_profiles;
  patient_row public.patients;
  prescription_row public.prescriptions;
  item jsonb;
  inserted_item public.prescription_items;
  items_result jsonb := '[]'::jsonb;
  input_prescription jsonb := coalesce(input->'prescription', '{}'::jsonb);
  input_items jsonb := coalesce(input->'items', '[]'::jsonb);
  target_clinic_id uuid;
  reminder_consent_confirmed boolean := coalesce((input->>'reminder_consent_confirmed')::boolean, false);
  send_now boolean := coalesce((input_prescription->>'send_to_pharmacy')::boolean, false);
begin
  select * into staff_row from public.staff_profiles where id = auth.uid() and status = 'active';
  if staff_row.id is null and not public.is_super_admin() then
    raise exception 'Active staff profile required';
  end if;

  target_clinic_id := coalesce(nullif(input_prescription->>'clinic_id', '')::uuid, staff_row.clinic_id);
  if target_clinic_id is null then
    raise exception 'Prescription clinic_id is required';
  end if;

  if not public.is_super_admin() and target_clinic_id <> staff_row.clinic_id then
    raise exception 'Prescription is outside current clinic';
  end if;

  select * into patient_row
  from public.patients
  where id = (input_prescription->>'patient_id')::uuid
    and clinic_id = target_clinic_id;

  if patient_row.id is null then
    raise exception 'Patient not found in clinic';
  end if;

  if not (
    public.is_super_admin()
    or public.has_permission('prescriptions.create')
    or public.has_permission('prescriptions.manage')
    or exists (
      select 1 from public.doctor_profiles dp
      where dp.id = (input_prescription->>'doctor_id')::uuid
        and dp.staff_id = auth.uid()
        and dp.clinic_id = target_clinic_id
    )
  ) then
    raise exception 'Prescription create permission required';
  end if;

  insert into public.prescriptions (
    clinic_id, branch_id, consultation_id, appointment_id, patient_id, doctor_id,
    diagnosis_summary, advice, follow_up_date, status, delivery_status, delivery_channel,
    send_to_pharmacy, pharmacy_status, created_by, finalized_at, metadata
  )
  values (
    target_clinic_id,
    coalesce(nullif(input_prescription->>'branch_id', '')::uuid, staff_row.branch_id),
    nullif(input_prescription->>'consultation_id', '')::uuid,
    nullif(input_prescription->>'appointment_id', '')::uuid,
    (input_prescription->>'patient_id')::uuid,
    (input_prescription->>'doctor_id')::uuid,
    input_prescription->>'diagnosis_summary',
    input_prescription->>'advice',
    nullif(input_prescription->>'follow_up_date', '')::date,
    coalesce(input_prescription->>'status', 'draft'),
    coalesce(input_prescription->>'delivery_status', 'queued'),
    case when send_now then 'pharmacy' else coalesce(input_prescription->>'delivery_channel', 'none') end,
    send_now,
    case when send_now then 'sent_to_pharmacy' else coalesce(input_prescription->>'pharmacy_status', 'not_sent') end,
    auth.uid(),
    nullif(input_prescription->>'finalized_at', '')::timestamptz,
    coalesce(input_prescription->'metadata', '{}'::jsonb)
  )
  returning * into prescription_row;

  for item in select * from jsonb_array_elements(input_items)
  loop
    insert into public.prescription_items (
      clinic_id, prescription_id, medicine_id, medicine_name, dosage, frequency, timing,
      duration, food_instruction, quantity, instructions, sort_order, reminder_enabled,
      reminder_frequency, reminder_start_date, reminder_end_date, metadata
    )
    values (
      prescription_row.clinic_id,
      prescription_row.id,
      -- Only a medicine of this clinic may be linked.
      (select m.id from public.medicines m where m.id = nullif(item->>'medicine_id', '')::uuid and m.clinic_id = prescription_row.clinic_id),
      item->>'medicine_name',
      item->>'dosage',
      item->>'frequency',
      item->>'timing',
      item->>'duration',
      coalesce(item->>'food_instruction', 'anytime'),
      item->>'quantity',
      item->>'instructions',
      coalesce((item->>'sort_order')::int, 0),
      coalesce((item->>'reminder_enabled')::boolean, false),
      item->>'reminder_frequency',
      nullif(item->>'reminder_start_date', '')::date,
      nullif(item->>'reminder_end_date', '')::date,
      coalesce(item->'metadata', '{}'::jsonb)
    )
    returning * into inserted_item;

    items_result := items_result || jsonb_build_array(to_jsonb(inserted_item));

    if inserted_item.reminder_enabled and reminder_consent_confirmed and coalesce(patient_row.reminder_consent, false) then
      insert into public.medicine_reminders (
        clinic_id, patient_id, prescription_id, prescription_item_id, medicine_name, dosage,
        frequency, timing, start_date, end_date, next_run_at, status, delivery_status,
        consent_confirmed, created_by, metadata
      )
      values (
        prescription_row.clinic_id,
        prescription_row.patient_id,
        prescription_row.id,
        inserted_item.id,
        inserted_item.medicine_name,
        inserted_item.dosage,
        coalesce(inserted_item.reminder_frequency, inserted_item.frequency),
        inserted_item.timing,
        coalesce(inserted_item.reminder_start_date, current_date),
        inserted_item.reminder_end_date,
        (coalesce(inserted_item.reminder_start_date, current_date)::text || ' 09:00:00+00')::timestamptz,
        'active',
        'queued',
        true,
        auth.uid(),
        jsonb_build_object('source', 'prescription')
      );
    end if;
  end loop;

  insert into public.prescription_delivery_logs (clinic_id, prescription_id, channel, old_status, new_status, message, changed_by)
  values (prescription_row.clinic_id, prescription_row.id, 'manual', null, prescription_row.status, 'Prescription saved', auth.uid());

  if send_now then
    perform public._ensure_pharmacy_order(prescription_row.id);
    insert into public.prescription_delivery_logs (clinic_id, prescription_id, channel, old_status, new_status, message, changed_by)
    values (prescription_row.clinic_id, prescription_row.id, 'pharmacy', 'not_sent', 'sent_to_pharmacy', 'Prescription sent to pharmacy', auth.uid());
  end if;

  return jsonb_build_object('prescription', to_jsonb(prescription_row), 'items', items_result);
end;
$$;

revoke all on function public.create_prescription_with_items(jsonb) from public, anon;
grant execute on function public.create_prescription_with_items(jsonb) to authenticated;

-- ---------------------------------------------------------------------
-- route_prescription_to_pharmacy: never moves the status backwards.
-- ---------------------------------------------------------------------
create or replace function public.route_prescription_to_pharmacy(prescription_id uuid)
returns public.prescriptions
language plpgsql
security definer
set search_path = public
as $$
declare
  prescription_row public.prescriptions;
  old_status_value text;
  staff_clinic uuid;
begin
  select clinic_id into staff_clinic from public.staff_profiles where id = auth.uid() and status = 'active';

  select * into prescription_row
  from public.prescriptions p
  where p.id = route_prescription_to_pharmacy.prescription_id
  for update;

  if prescription_row.id is null then
    raise exception 'Prescription not found';
  end if;

  if not public.is_super_admin() and prescription_row.clinic_id is distinct from staff_clinic then
    raise exception 'Prescription is outside current clinic';
  end if;

  if not (
    public.is_super_admin()
    or public.has_permission('prescriptions.edit')
    or public.has_permission('prescriptions.manage')
    or public.has_permission('pharmacy.create')
    or public.has_permission('pharmacy.manage')
    or prescription_row.doctor_id in (select id from public.doctor_profiles where staff_id = auth.uid())
  ) then
    raise exception 'Pharmacy routing permission required';
  end if;

  if prescription_row.status = 'cancelled' then
    raise exception 'A cancelled prescription cannot be sent to pharmacy';
  end if;

  old_status_value := prescription_row.pharmacy_status;

  update public.prescriptions p
  set send_to_pharmacy = true,
      pharmacy_status = case when coalesce(p.pharmacy_status, 'not_sent') in ('not_sent', 'cancelled') then 'sent_to_pharmacy' else p.pharmacy_status end,
      delivery_channel = 'pharmacy'
  where p.id = prescription_row.id
  returning * into prescription_row;

  if prescription_row.pharmacy_status is distinct from old_status_value then
    insert into public.prescription_delivery_logs (clinic_id, prescription_id, channel, old_status, new_status, message, changed_by)
    values (prescription_row.clinic_id, prescription_row.id, 'pharmacy', old_status_value, prescription_row.pharmacy_status, 'Prescription sent to pharmacy', auth.uid());
  end if;

  perform public._ensure_pharmacy_order(prescription_row.id);
  return prescription_row;
end;
$$;

revoke all on function public.route_prescription_to_pharmacy(uuid) from public, anon;
grant execute on function public.route_prescription_to_pharmacy(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- dispense_pharmacy_order: same input/output; IST expiry, no dispensing of
-- cancelled orders, no dispensing beyond what was prescribed.
-- ---------------------------------------------------------------------
create or replace function public.dispense_pharmacy_order(input jsonb)
returns public.pharmacy_orders
language plpgsql
security definer
set search_path = public
as $$
declare
  staff_row public.staff_profiles;
  order_row public.pharmacy_orders;
  item_input jsonb;
  order_item public.pharmacy_order_items;
  batch_row public.medicine_stock_batches;
  dispense_qty int;
  remaining int;
  all_done boolean;
  any_dispensed boolean;
  v_today date := (now() at time zone 'Asia/Kolkata')::date;
begin
  select * into staff_row from public.staff_profiles where id = auth.uid() and status = 'active';
  if staff_row.id is null and not public.is_super_admin() then
    raise exception 'Active staff profile required';
  end if;

  select * into order_row from public.pharmacy_orders where id = (input->>'order_id')::uuid for update;
  if order_row.id is null then
    raise exception 'Pharmacy order not found';
  end if;
  if not public.is_super_admin() and order_row.clinic_id <> staff_row.clinic_id then
    raise exception 'Pharmacy order is outside current clinic';
  end if;
  if not (
    public.is_super_admin()
    or (public.has_module('pharmacy') and (public.has_permission('pharmacy.dispense') or public.has_permission('pharmacy.manage')))
  ) then
    raise exception 'Dispense permission required';
  end if;
  if order_row.status = 'cancelled' then
    raise exception 'This pharmacy order is cancelled';
  end if;
  if jsonb_typeof(input->'items') is distinct from 'array' or jsonb_array_length(input->'items') = 0 then
    raise exception 'Select at least one medicine to dispense';
  end if;

  for item_input in select * from jsonb_array_elements(input->'items')
  loop
    select * into order_item
    from public.pharmacy_order_items
    where id = (item_input->>'order_item_id')::uuid
      and pharmacy_order_id = order_row.id
    for update;
    if order_item.id is null then
      raise exception 'Pharmacy order item not found';
    end if;
    if order_item.status = 'cancelled' then
      raise exception '% is cancelled on this order', order_item.medicine_name;
    end if;

    remaining := greatest(coalesce(order_item.requested_quantity, 0) - coalesce(order_item.dispensed_quantity, 0), 0);
    dispense_qty := coalesce((item_input->>'quantity')::int, remaining);
    if dispense_qty <= 0 then
      raise exception 'Dispense quantity for % must be greater than zero', order_item.medicine_name;
    end if;
    if dispense_qty > remaining then
      raise exception 'Only % more of % can be dispensed on this prescription', remaining, order_item.medicine_name;
    end if;

    select * into batch_row
    from public.medicine_stock_batches
    where id = (item_input->>'batch_id')::uuid
    for update;
    if batch_row.id is null then
      raise exception 'Stock batch not found';
    end if;
    if batch_row.clinic_id <> order_row.clinic_id then
      raise exception 'Stock batch is outside order clinic';
    end if;
    if order_item.medicine_id is not null and batch_row.medicine_id <> order_item.medicine_id then
      raise exception 'Batch % is not %', batch_row.batch_no, order_item.medicine_name;
    end if;
    if coalesce(batch_row.status, 'active') <> 'active' then
      raise exception 'Stock batch % is not active', batch_row.batch_no;
    end if;
    if batch_row.expiry_date is not null and batch_row.expiry_date < v_today then
      raise exception 'Expired stock batch % cannot be dispensed', batch_row.batch_no;
    end if;
    if batch_row.quantity_available < dispense_qty then
      raise exception 'Batch % has only % units', batch_row.batch_no, batch_row.quantity_available;
    end if;

    update public.medicine_stock_batches
    set quantity_available = quantity_available - dispense_qty,
        status = case when quantity_available - dispense_qty = 0 then 'depleted' else status end
    where id = batch_row.id
    returning * into batch_row;

    update public.pharmacy_order_items
    set batch_id = batch_row.id,
        medicine_id = batch_row.medicine_id,
        dispensed_quantity = dispensed_quantity + dispense_qty,
        status = case
          when dispensed_quantity + dispense_qty >= requested_quantity then 'dispensed'
          else 'partial'
        end
    where id = order_item.id;

    insert into public.stock_movements (clinic_id, branch_id, medicine_id, batch_id, movement_type, quantity, reason, reference_type, reference_id, created_by)
    values (order_row.clinic_id, order_row.branch_id, batch_row.medicine_id, batch_row.id, 'dispense', dispense_qty, 'Pharmacy order dispense', 'pharmacy_order', order_row.id, auth.uid());
  end loop;

  select not exists (
    select 1 from public.pharmacy_order_items
    where pharmacy_order_id = order_row.id
      and status not in ('dispensed','cancelled','unavailable')
  ), exists (
    select 1 from public.pharmacy_order_items
    where pharmacy_order_id = order_row.id and dispensed_quantity > 0
  ) into all_done, any_dispensed;

  update public.pharmacy_orders
  set status = case when all_done then 'dispensed' when any_dispensed then 'partially_dispensed' else status end,
      dispensed_by = auth.uid(),
      dispensed_at = case when all_done then now() else dispensed_at end
  where id = order_row.id
  returning * into order_row;

  update public.prescriptions
  set pharmacy_status = case when all_done then 'dispensed' else 'received' end
  where id = order_row.prescription_id;

  insert into public.prescription_delivery_logs (clinic_id, prescription_id, channel, old_status, new_status, message, changed_by)
  values (order_row.clinic_id, order_row.prescription_id, 'pharmacy', null, case when all_done then 'dispensed' else 'partially_dispensed' end, 'Pharmacy order dispensed', auth.uid());

  perform public.refresh_low_stock_alerts(order_row.clinic_id, order_row.branch_id);
  return order_row;
end;
$$;

revoke all on function public.dispense_pharmacy_order(jsonb) from public, anon;
grant execute on function public.dispense_pharmacy_order(jsonb) to authenticated;

-- ---------------------------------------------------------------------
-- Mark an order item unavailable (pharmacist decision), then settle the order.
-- ---------------------------------------------------------------------
create or replace function public.mark_pharmacy_order_item_unavailable(input jsonb)
returns public.pharmacy_orders
language plpgsql
security definer
set search_path = public
as $$
declare
  staff_row public.staff_profiles;
  order_item public.pharmacy_order_items;
  order_row public.pharmacy_orders;
  v_reason text := nullif(btrim(coalesce(input->>'reason', '')), '');
  all_done boolean;
  any_dispensed boolean;
  new_rx_status text;
begin
  select * into staff_row from public.staff_profiles where id = auth.uid() and status = 'active';
  if staff_row.id is null and not public.is_super_admin() then
    raise exception 'Active staff profile required';
  end if;
  if not (
    public.is_super_admin()
    or (public.has_module('pharmacy') and (public.has_permission('pharmacy.dispense') or public.has_permission('pharmacy.manage')))
  ) then
    raise exception 'Dispense permission required';
  end if;
  if v_reason is not null and length(v_reason) > 500 then
    raise exception 'Reason is too long (max 500 characters)';
  end if;

  select * into order_item from public.pharmacy_order_items where id = nullif(input->>'order_item_id', '')::uuid for update;
  if order_item.id is null then
    raise exception 'Pharmacy order item not found';
  end if;
  select * into order_row from public.pharmacy_orders where id = order_item.pharmacy_order_id for update;
  if not public.is_super_admin() and order_row.clinic_id <> staff_row.clinic_id then
    raise exception 'Pharmacy order is outside current clinic';
  end if;
  if order_row.status = 'cancelled' then
    raise exception 'This pharmacy order is cancelled';
  end if;
  if order_item.status = 'dispensed' then
    raise exception '% is already fully dispensed', order_item.medicine_name;
  end if;

  update public.pharmacy_order_items
  set status = 'unavailable',
      notes = coalesce(v_reason, 'Marked unavailable by pharmacist')
  where id = order_item.id;

  select not exists (
    select 1 from public.pharmacy_order_items where pharmacy_order_id = order_row.id and status not in ('dispensed','cancelled','unavailable')
  ), exists (
    select 1 from public.pharmacy_order_items where pharmacy_order_id = order_row.id and dispensed_quantity > 0
  ) into all_done, any_dispensed;

  if all_done then
    -- Everything is settled: dispensed if anything was handed over, otherwise
    -- the pharmacy could not supply this prescription at all.
    update public.pharmacy_orders
    set status = case when any_dispensed then 'dispensed' else 'cancelled' end,
        dispensed_by = case when any_dispensed then auth.uid() else dispensed_by end,
        dispensed_at = case when any_dispensed then now() else dispensed_at end,
        notes = case when any_dispensed then notes else 'No prescribed medicine could be supplied' end
    where id = order_row.id
    returning * into order_row;
    new_rx_status := case when any_dispensed then 'dispensed' else 'cancelled' end;
    update public.prescriptions set pharmacy_status = new_rx_status where id = order_row.prescription_id;
    insert into public.prescription_delivery_logs (clinic_id, prescription_id, channel, old_status, new_status, message, changed_by)
    values (order_row.clinic_id, order_row.prescription_id, 'pharmacy', null, new_rx_status,
            case when any_dispensed then 'Pharmacy order completed' else 'Pharmacy could not supply any prescribed medicine' end, auth.uid());
  end if;

  return order_row;
end;
$$;

revoke all on function public.mark_pharmacy_order_item_unavailable(jsonb) from public, anon;
grant execute on function public.mark_pharmacy_order_item_unavailable(jsonb) to authenticated;

-- ---------------------------------------------------------------------
-- The pharmacist has opened the order: the doctor sees "Received".
-- ---------------------------------------------------------------------
create or replace function public.acknowledge_pharmacy_order(order_id uuid)
returns public.prescriptions
language plpgsql
security definer
set search_path = public
as $$
declare
  staff_row public.staff_profiles;
  order_row public.pharmacy_orders;
  rx public.prescriptions;
begin
  select * into staff_row from public.staff_profiles where id = auth.uid() and status = 'active';
  if staff_row.id is null and not public.is_super_admin() then
    raise exception 'Active staff profile required';
  end if;
  if not (public.is_super_admin() or (public.has_module('pharmacy') and (public.has_permission('pharmacy.dispense') or public.has_permission('pharmacy.manage')))) then
    raise exception 'Dispense permission required';
  end if;
  select * into order_row from public.pharmacy_orders o where o.id = acknowledge_pharmacy_order.order_id;
  if order_row.id is null then
    raise exception 'Pharmacy order not found';
  end if;
  if not public.is_super_admin() and order_row.clinic_id <> staff_row.clinic_id then
    raise exception 'Pharmacy order is outside current clinic';
  end if;

  update public.prescriptions p set pharmacy_status = 'received'
  where p.id = order_row.prescription_id and p.pharmacy_status = 'sent_to_pharmacy'
  returning * into rx;
  if rx.id is not null then
    insert into public.prescription_delivery_logs (clinic_id, prescription_id, channel, old_status, new_status, message, changed_by)
    values (rx.clinic_id, rx.id, 'pharmacy', 'sent_to_pharmacy', 'received', 'Pharmacy opened the prescription', auth.uid());
  else
    select * into rx from public.prescriptions where id = order_row.prescription_id;
  end if;
  return rx;
end;
$$;

revoke all on function public.acknowledge_pharmacy_order(uuid) from public, anon;
grant execute on function public.acknowledge_pharmacy_order(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- create_invoice_from_pharmacy_order: bill only what was dispensed.
-- ---------------------------------------------------------------------
create or replace function public.create_invoice_from_pharmacy_order(pharmacy_order_id uuid)
returns public.invoices
language plpgsql
security definer
set search_path = public
as $$
declare
  order_row public.pharmacy_orders;
  invoice_result jsonb;
  existing_invoice public.invoices;
  items_payload jsonb;
begin
  select * into order_row from public.pharmacy_orders o where o.id = create_invoice_from_pharmacy_order.pharmacy_order_id;
  if order_row.id is null then
    raise exception 'Pharmacy order not found';
  end if;
  if not public.is_super_admin() and order_row.clinic_id <> public.current_clinic_id() then
    raise exception 'Pharmacy order is outside current clinic';
  end if;

  select * into existing_invoice from public.invoices i where i.pharmacy_order_id = create_invoice_from_pharmacy_order.pharmacy_order_id and i.invoice_status <> 'cancelled';
  if existing_invoice.id is not null then
    return existing_invoice;
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'item_type', 'pharmacy',
    'reference_id', poi.id,
    'description', poi.medicine_name,
    'quantity', poi.dispensed_quantity,
    'unit_price', coalesce(msb.selling_price, 0),
    'discount_amount', 0,
    'tax_rate', 0
  ) order by poi.created_at), '[]'::jsonb)
  into items_payload
  from public.pharmacy_order_items poi
  left join public.medicine_stock_batches msb on msb.id = poi.batch_id
  where poi.pharmacy_order_id = order_row.id
    and poi.dispensed_quantity > 0;

  if jsonb_array_length(items_payload) = 0 then
    raise exception 'Nothing has been dispensed on this order yet, so there is nothing to bill';
  end if;

  invoice_result := public.create_invoice_with_items(jsonb_build_object(
    'invoice', jsonb_build_object(
      'clinic_id', order_row.clinic_id,
      'branch_id', order_row.branch_id,
      'patient_id', order_row.patient_id,
      'prescription_id', order_row.prescription_id,
      'pharmacy_order_id', order_row.id,
      'invoice_type', 'pharmacy',
      'paid_amount', 0,
      'payment_mode', 'cash',
      'metadata', jsonb_build_object('source', 'pharmacy_order')
    ),
    'items', items_payload
  ));

  select * into existing_invoice
  from public.invoices
  where id = (invoice_result->'invoice'->>'id')::uuid;

  return existing_invoice;
end;
$$;

revoke all on function public.create_invoice_from_pharmacy_order(uuid) from public, anon;
grant execute on function public.create_invoice_from_pharmacy_order(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- Back-fill: routed prescriptions that never got an order.
-- ---------------------------------------------------------------------
do $$
declare
  v_id uuid;
begin
  for v_id in
    select p.id from public.prescriptions p
    where coalesce(p.send_to_pharmacy, false)
      and p.status is distinct from 'cancelled'
      and not exists (select 1 from public.pharmacy_orders o where o.prescription_id = p.id)
  loop
    perform public._ensure_pharmacy_order(v_id);
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- Realtime: live queue updates for pharmacists.
-- ---------------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables
       where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'pharmacy_orders'
     ) then
    alter publication supabase_realtime add table public.pharmacy_orders;
  end if;
end $$;
