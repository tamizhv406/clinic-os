-- =====================================================================
-- Atomic stock intake (Phase 16, Task 4)
-- =====================================================================
-- Replaces the client-side purchase entry (many separate writes, no
-- transaction, and an upsert that REPLACED batch quantities) with one
-- security definer RPC: public.create_stock_purchase(input jsonb).
--
-- Everything happens in one transaction: validation of every row first,
-- duplicate-invoice check, medicine lookup/creation, batch insert or top-up
-- (quantities are ADDED), one stock movement per item, low-stock alert
-- refresh and an audit log row. Any failure rolls the whole purchase back.
--
-- Clinic and branch always come from the caller's staff profile, never from
-- the input. Safe to re-run.
--
-- Deliberate differences from the brief (see docs/PHASE_16_PHARMACIST_MODULE.md):
--   * A batch with status 'blocked' (e.g. recalled) is never reactivated by a
--     delivery; the purchase is rejected instead.
--   * Purchase date may not be in the future, and selling price/purchase
--     price are required (the Excel template marks them required too).
--   * "Today" is the clinic's local date (Asia/Kolkata), not the server's UTC date.
-- =====================================================================

alter table public.stock_purchases
  add column if not exists metadata jsonb not null default '{}';

create index if not exists idx_stock_purchases_supplier_invoice
  on public.stock_purchases (clinic_id, lower(btrim(supplier_name)), lower(btrim(invoice_number)));
create index if not exists idx_stock_movements_reference
  on public.stock_movements (reference_type, reference_id);

-- ---------------------------------------------------------------------
-- Parsing helpers that never raise, so validation can report every row.
-- ---------------------------------------------------------------------

-- null when the value is absent; 'NaN' when present but not a number.
create or replace function public._jsonb_to_numeric(value jsonb)
returns numeric
language plpgsql
immutable
set search_path = public
as $$
declare
  v_text text;
begin
  if value is null or jsonb_typeof(value) = 'null' then
    return null;
  end if;
  if jsonb_typeof(value) = 'number' then
    return (value #>> '{}')::numeric;
  end if;
  if jsonb_typeof(value) = 'string' then
    v_text := btrim(value #>> '{}');
    if v_text = '' then
      return null;
    end if;
    if v_text ~ '^-?[0-9]+(\.[0-9]+)?$' then
      return v_text::numeric;
    end if;
  end if;
  return 'NaN'::numeric;
end;
$$;

-- null for anything that is not a real calendar date written as YYYY-MM-DD.
create or replace function public._text_to_date(value text)
returns date
language plpgsql
immutable
set search_path = public
as $$
begin
  if value is null or btrim(value) !~ '^\d{4}-\d{2}-\d{2}$' then
    return null;
  end if;
  return btrim(value)::date;
exception when others then
  return null;
end;
$$;

revoke all on function public._jsonb_to_numeric(jsonb) from public, anon, authenticated;
revoke all on function public._text_to_date(text) from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- create_stock_purchase
-- ---------------------------------------------------------------------
create or replace function public.create_stock_purchase(input jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  c_categories constant text[] := array['general', 'antibiotic', 'dental', 'skin', 'pediatric', 'physiotherapy', 'supplement'];
  c_max_items constant int := 1000;
  c_max_reported_errors constant int := 50;

  v_staff public.staff_profiles;
  v_today date := (now() at time zone 'Asia/Kolkata')::date;

  v_supplier text := nullif(btrim(coalesce(input->>'supplier_name', '')), '');
  v_supplier_phone text := nullif(btrim(coalesce(input->>'supplier_phone', '')), '');
  v_invoice text := nullif(btrim(coalesce(input->>'invoice_number', '')), '');
  v_purchase_date_text text := nullif(btrim(coalesce(input->>'purchase_date', '')), '');
  v_purchase_date date := public._text_to_date(input->>'purchase_date');
  v_notes text := nullif(btrim(coalesce(input->>'notes', '')), '');
  v_source text := lower(coalesce(nullif(btrim(input->>'source'), ''), 'manual'));
  v_items jsonb := input->'items';
  v_item_count int := 0;

  v_errors text[] := '{}';
  v_row_errors text[];
  v_seen text[] := '{}';
  v_key text;
  v_idx int;
  v_item jsonb;

  v_name text;
  v_batch text;
  v_expiry_text text;
  v_expiry date;
  v_qty numeric;
  v_purchase_price numeric;
  v_selling_price numeric;
  v_mrp numeric;
  v_gst numeric;
  v_reorder numeric;
  v_category text;
  v_generic text;
  v_manufacturer text;
  v_strength text;
  v_unit text;
  v_hsn text;

  v_purchase_id uuid;
  v_total numeric := 0;
  v_medicine public.medicines;
  v_existing_batch public.medicine_stock_batches;
  v_batch_id uuid;
  v_batch_status text;
  v_batch_mrp numeric;
  v_batch_selling numeric;
  v_inserted boolean;
  v_medicines_created int := 0;
  v_batches_created int := 0;
  v_batches_topped_up int := 0;
begin
  -- 1. Caller and permission ------------------------------------------------
  select * into v_staff from public.staff_profiles where id = auth.uid() and status = 'active';
  if v_staff.id is null then
    raise exception 'An active staff profile is required to record a stock purchase.' using errcode = '42501';
  end if;
  if not (
    public.is_super_admin()
    or (public.has_module('pharmacy') and (public.has_permission('pharmacy.manage') or public.has_permission('pharmacy.create')))
  ) then
    raise exception 'You do not have permission to add stock.' using errcode = '42501';
  end if;
  if v_staff.clinic_id is null then
    raise exception 'Stock purchases must be recorded by a staff member of a clinic.' using errcode = '42501';
  end if;

  -- 2. Validate the header --------------------------------------------------
  if v_supplier is null then
    v_errors := array_append(v_errors, 'Supplier name is required.');
  elsif length(v_supplier) > 200 then
    v_errors := array_append(v_errors, 'Supplier name is too long (max 200 characters).');
  end if;
  if v_supplier_phone is not null and length(v_supplier_phone) > 30 then
    v_errors := array_append(v_errors, 'Supplier phone is too long (max 30 characters).');
  end if;
  if v_invoice is null then
    v_errors := array_append(v_errors, 'Invoice number is required.');
  elsif length(v_invoice) > 100 then
    v_errors := array_append(v_errors, 'Invoice number is too long (max 100 characters).');
  end if;
  if v_purchase_date_text is null then
    v_errors := array_append(v_errors, 'Purchase date is required.');
  elsif v_purchase_date is null then
    v_errors := array_append(v_errors, 'Purchase date must be a valid date (YYYY-MM-DD).');
  elsif v_purchase_date > v_today then
    v_errors := array_append(v_errors, 'Purchase date cannot be in the future.');
  end if;
  if v_notes is not null and length(v_notes) > 2000 then
    v_errors := array_append(v_errors, 'Notes are too long (max 2000 characters).');
  end if;
  if v_source not in ('manual', 'excel') then
    v_errors := array_append(v_errors, 'Source must be "manual" or "excel".');
  end if;
  if v_items is null or jsonb_typeof(v_items) <> 'array' or jsonb_array_length(v_items) = 0 then
    v_errors := array_append(v_errors, 'At least one item is required.');
  elsif jsonb_array_length(v_items) > c_max_items then
    v_errors := array_append(v_errors, format('A purchase can contain at most %s items.', c_max_items));
  else
    v_item_count := jsonb_array_length(v_items);
  end if;

  -- 3. Validate every item before writing anything --------------------------
  for v_idx in 0 .. v_item_count - 1 loop
    v_item := v_items -> v_idx;
    v_row_errors := '{}';

    if jsonb_typeof(v_item) <> 'object' then
      v_errors := array_append(v_errors, format('Row %s: not a valid item.', v_idx + 1));
      continue;
    end if;

    v_name := nullif(btrim(coalesce(v_item->>'medicine_name', '')), '');
    v_batch := nullif(btrim(coalesce(v_item->>'batch_no', '')), '');
    v_expiry_text := nullif(btrim(coalesce(v_item->>'expiry_date', '')), '');
    v_expiry := public._text_to_date(v_item->>'expiry_date');
    v_qty := public._jsonb_to_numeric(v_item->'quantity');
    v_purchase_price := public._jsonb_to_numeric(v_item->'purchase_price');
    v_selling_price := public._jsonb_to_numeric(v_item->'selling_price');
    v_mrp := public._jsonb_to_numeric(v_item->'mrp');
    v_gst := public._jsonb_to_numeric(v_item->'gst_rate');
    v_reorder := public._jsonb_to_numeric(v_item->'reorder_level');
    v_category := lower(nullif(btrim(coalesce(v_item->>'category', '')), ''));

    if v_name is null then
      v_row_errors := array_append(v_row_errors, 'medicine name is required');
    elsif length(v_name) > 200 then
      v_row_errors := array_append(v_row_errors, 'medicine name is too long (max 200 characters)');
    end if;

    if v_batch is null then
      v_row_errors := array_append(v_row_errors, 'batch number is required');
    elsif length(v_batch) > 100 then
      v_row_errors := array_append(v_row_errors, 'batch number is too long (max 100 characters)');
    end if;

    if v_expiry_text is null then
      v_row_errors := array_append(v_row_errors, 'expiry date is required');
    elsif v_expiry is null then
      v_row_errors := array_append(v_row_errors, 'expiry date must be a valid date (YYYY-MM-DD)');
    elsif v_expiry <= v_today then
      v_row_errors := array_append(v_row_errors, format('expiry date %s is not in the future', v_expiry));
    end if;

    if v_qty is null then
      v_row_errors := array_append(v_row_errors, 'quantity is required');
    elsif v_qty = 'NaN' or v_qty <> trunc(v_qty) or v_qty <= 0 then
      v_row_errors := array_append(v_row_errors, 'quantity must be a whole number greater than 0');
    elsif v_qty > 1000000 then
      v_row_errors := array_append(v_row_errors, 'quantity is too large (max 1,000,000)');
    end if;

    if v_purchase_price is null then
      v_row_errors := array_append(v_row_errors, 'purchase price is required');
    elsif v_purchase_price = 'NaN' then
      v_row_errors := array_append(v_row_errors, 'purchase price must be a number');
    elsif v_purchase_price < 0 then
      v_row_errors := array_append(v_row_errors, 'purchase price cannot be negative');
    end if;

    if v_selling_price is null then
      v_row_errors := array_append(v_row_errors, 'selling price is required');
    elsif v_selling_price = 'NaN' then
      v_row_errors := array_append(v_row_errors, 'selling price must be a number');
    elsif v_selling_price < 0 then
      v_row_errors := array_append(v_row_errors, 'selling price cannot be negative');
    end if;

    if v_mrp = 'NaN' then
      v_row_errors := array_append(v_row_errors, 'MRP must be a number');
    elsif v_mrp < 0 then
      v_row_errors := array_append(v_row_errors, 'MRP cannot be negative');
    elsif v_mrp > 0 and v_selling_price is not null and v_selling_price <> 'NaN' and v_selling_price > v_mrp then
      v_row_errors := array_append(v_row_errors, 'selling price cannot be more than MRP');
    end if;

    if v_gst = 'NaN' or v_gst < 0 or v_gst > 28 then
      v_row_errors := array_append(v_row_errors, 'GST % must be a number between 0 and 28');
    end if;

    if v_reorder = 'NaN' or v_reorder < 0 or v_reorder <> trunc(v_reorder) then
      v_row_errors := array_append(v_row_errors, 'reorder level must be a whole number of 0 or more');
    end if;

    if v_category is not null and not (v_category = any (c_categories)) then
      v_row_errors := array_append(v_row_errors, format('category "%s" is not one of: %s', v_category, array_to_string(c_categories, ', ')));
    end if;

    if v_name is not null and v_batch is not null then
      v_key := lower(v_name) || chr(31) || lower(v_batch);
      if v_key = any (v_seen) then
        v_row_errors := array_append(v_row_errors, 'same medicine and batch as an earlier row');
      else
        v_seen := array_append(v_seen, v_key);
      end if;
    end if;

    if coalesce(array_length(v_row_errors, 1), 0) > 0 then
      v_errors := array_append(v_errors, format('Row %s: %s.', v_idx + 1, array_to_string(v_row_errors, '; ')));
    elsif v_qty is not null and v_purchase_price is not null then
      v_total := v_total + v_qty * v_purchase_price;
    end if;
  end loop;

  if coalesce(array_length(v_errors, 1), 0) > 0 then
    raise exception using
      errcode = '22023',
      message = 'Stock purchase was not saved. ' || array_to_string(v_errors[1:c_max_reported_errors], ' ')
        || case when array_length(v_errors, 1) > c_max_reported_errors
                then format(' (and %s more problems)', array_length(v_errors, 1) - c_max_reported_errors)
                else '' end;
  end if;

  -- 4. One stock purchase at a time per clinic: closes the race between the
  --    duplicate-invoice check and the insert, and between two purchases that
  --    both create the same new medicine. Released at commit/rollback.
  perform pg_advisory_xact_lock(hashtextextended('create_stock_purchase:' || v_staff.clinic_id::text, 0));

  if exists (
    select 1
    from public.stock_purchases sp
    where sp.clinic_id = v_staff.clinic_id
      and lower(btrim(sp.supplier_name)) = lower(v_supplier)
      and lower(btrim(sp.invoice_number)) = lower(v_invoice)
      and sp.status <> 'cancelled'
  ) then
    raise exception 'Invoice % from % is already recorded.', v_invoice, v_supplier using errcode = '23505';
  end if;

  -- 5. Purchase header ------------------------------------------------------
  insert into public.stock_purchases (
    clinic_id, branch_id, supplier_name, supplier_phone, invoice_number, purchase_date,
    total_amount, notes, status, created_by, metadata
  )
  values (
    v_staff.clinic_id, v_staff.branch_id, v_supplier, v_supplier_phone, v_invoice, v_purchase_date,
    round(v_total, 2), v_notes, 'saved', v_staff.id,
    jsonb_build_object('source', v_source, 'item_count', v_item_count)
  )
  returning id into v_purchase_id;

  -- 6. Items ----------------------------------------------------------------
  for v_idx in 0 .. v_item_count - 1 loop
    v_item := v_items -> v_idx;
    v_name := btrim(v_item->>'medicine_name');
    v_batch := btrim(v_item->>'batch_no');
    v_expiry := public._text_to_date(v_item->>'expiry_date');
    v_qty := public._jsonb_to_numeric(v_item->'quantity');
    v_purchase_price := public._jsonb_to_numeric(v_item->'purchase_price');
    v_selling_price := public._jsonb_to_numeric(v_item->'selling_price');
    v_mrp := public._jsonb_to_numeric(v_item->'mrp');
    v_gst := public._jsonb_to_numeric(v_item->'gst_rate');
    v_reorder := public._jsonb_to_numeric(v_item->'reorder_level');
    v_category := lower(nullif(btrim(coalesce(v_item->>'category', '')), ''));
    v_generic := nullif(btrim(coalesce(v_item->>'generic_name', '')), '');
    v_manufacturer := nullif(btrim(coalesce(v_item->>'manufacturer', '')), '');
    v_strength := nullif(btrim(coalesce(v_item->>'strength', '')), '');
    v_unit := nullif(btrim(coalesce(v_item->>'unit', '')), '');
    v_hsn := nullif(btrim(coalesce(v_item->>'hsn_code', '')), '');

    -- Medicine: same clinic, active, same trimmed name (case-insensitive).
    -- SELECT INTO leaves the row variable all-NULL when nothing matches.
    select * into v_medicine
    from public.medicines m
    where m.clinic_id = v_staff.clinic_id
      and m.status = 'active'
      and lower(btrim(m.name)) = lower(v_name)
    order by m.created_at
    limit 1;

    if v_medicine.id is null then
      insert into public.medicines (
        clinic_id, branch_id, name, generic_name, category, manufacturer, strength, unit,
        hsn_code, gst_rate, reorder_level, status
      )
      values (
        v_staff.clinic_id, v_staff.branch_id, v_name, v_generic, coalesce(v_category, 'general'), v_manufacturer,
        v_strength, coalesce(v_unit, 'unit'), v_hsn, coalesce(v_gst, 0), coalesce(v_reorder, 0)::int, 'active'
      )
      returning * into v_medicine;
      v_medicines_created := v_medicines_created + 1;
    else
      -- Fill only master fields that are still empty; never overwrite pharmacist edits.
      -- gst_rate is filled only when NULL, because 0 is a legitimate (exempt) rate.
      -- reorder_level 0 means "not set" (it is the column default).
      update public.medicines m set
        generic_name = coalesce(nullif(btrim(m.generic_name), ''), v_generic),
        category = coalesce(nullif(btrim(m.category), ''), v_category),
        manufacturer = coalesce(nullif(btrim(m.manufacturer), ''), v_manufacturer),
        strength = coalesce(nullif(btrim(m.strength), ''), v_strength),
        unit = coalesce(nullif(btrim(m.unit), ''), v_unit),
        hsn_code = coalesce(nullif(btrim(m.hsn_code), ''), v_hsn),
        gst_rate = coalesce(m.gst_rate, v_gst),
        reorder_level = case when coalesce(m.reorder_level, 0) = 0 and v_reorder is not null then v_reorder::int else m.reorder_level end
      where m.id = v_medicine.id
        and (
          (nullif(btrim(m.generic_name), '') is null and v_generic is not null)
          or (nullif(btrim(m.category), '') is null and v_category is not null)
          or (nullif(btrim(m.manufacturer), '') is null and v_manufacturer is not null)
          or (nullif(btrim(m.strength), '') is null and v_strength is not null)
          or (nullif(btrim(m.unit), '') is null and v_unit is not null)
          or (nullif(btrim(m.hsn_code), '') is null and v_hsn is not null)
          or (m.gst_rate is null and v_gst is not null)
          or (coalesce(m.reorder_level, 0) = 0 and coalesce(v_reorder, 0) > 0)
        );
    end if;

    -- Reuse the existing batch's exact spelling when the batch number only
    -- differs by case or spacing, so "pcm-a22" tops up "PCM-A22".
    select * into v_existing_batch
    from public.medicine_stock_batches b
    where b.medicine_id = v_medicine.id
      and lower(btrim(b.batch_no)) = lower(v_batch)
    order by b.created_at
    limit 1;

    if v_existing_batch.id is not null then
      if coalesce(v_existing_batch.status, 'active') = 'blocked' then
        raise exception 'Stock purchase was not saved. Row %: batch % of % is blocked and cannot receive stock.', v_idx + 1, v_existing_batch.batch_no, v_medicine.name
          using errcode = '22023';
      end if;
      v_batch := v_existing_batch.batch_no;
    end if;

    insert into public.medicine_stock_batches (
      clinic_id, branch_id, medicine_id, purchase_id, batch_no, expiry_date, quantity_available,
      purchase_price, selling_price, mrp, supplier_name, status
    )
    values (
      v_staff.clinic_id, v_staff.branch_id, v_medicine.id, v_purchase_id, v_batch, v_expiry, v_qty::int,
      v_purchase_price, v_selling_price, coalesce(v_mrp, 0), v_supplier, 'active'
    )
    on conflict (medicine_id, batch_no) do update set
      quantity_available = public.medicine_stock_batches.quantity_available + excluded.quantity_available,
      purchase_price = excluded.purchase_price,
      selling_price = excluded.selling_price,
      mrp = case when excluded.mrp > 0 then excluded.mrp else public.medicine_stock_batches.mrp end,
      expiry_date = excluded.expiry_date,
      supplier_name = excluded.supplier_name,
      purchase_id = excluded.purchase_id,
      status = 'active'
    where coalesce(public.medicine_stock_batches.status, 'active') <> 'blocked'
    returning id, (xmax = 0), status, mrp, selling_price
      into v_batch_id, v_inserted, v_batch_status, v_batch_mrp, v_batch_selling;

    if v_batch_id is null then
      -- Only reachable if the batch was blocked by someone else after the check above.
      raise exception 'Stock purchase was not saved. Row %: batch % of % is blocked and cannot receive stock.', v_idx + 1, v_batch, v_medicine.name
        using errcode = '22023';
    end if;

    -- A top-up without an MRP keeps the batch's existing MRP; the new selling
    -- price must still respect it.
    if coalesce(v_batch_mrp, 0) > 0 and v_batch_selling > v_batch_mrp then
      raise exception 'Stock purchase was not saved. Row %: selling price % is more than the batch MRP %.', v_idx + 1, v_batch_selling, v_batch_mrp
        using errcode = '22023';
    end if;

    if v_inserted then
      v_batches_created := v_batches_created + 1;
    else
      v_batches_topped_up := v_batches_topped_up + 1;
    end if;

    insert into public.stock_movements (
      clinic_id, branch_id, medicine_id, batch_id, movement_type, quantity, reason,
      reference_type, reference_id, created_by
    )
    values (
      v_staff.clinic_id, v_staff.branch_id, v_medicine.id, v_batch_id, 'add_stock', v_qty::int,
      format('Purchase %s from %s', v_invoice, v_supplier),
      'stock_purchase', v_purchase_id, v_staff.id
    );

    v_batch_id := null;
  end loop;

  -- 7. Alerts and audit -----------------------------------------------------
  perform public.refresh_low_stock_alerts(v_staff.clinic_id, v_staff.branch_id);

  insert into public.audit_logs (
    clinic_id, branch_id, actor_id, user_id, actor_role, event_type, action, entity_type, entity_id,
    status, severity, message, metadata
  )
  values (
    v_staff.clinic_id, v_staff.branch_id, v_staff.id, v_staff.id, v_staff.role_key, 'pharmacy_stock_purchase_created',
    'create', 'stock_purchases', v_purchase_id, 'success', 'info',
    format('Stock purchase %s from %s recorded.', v_invoice, v_supplier),
    jsonb_build_object(
      'source', v_source, 'items', v_item_count, 'total_amount', round(v_total, 2),
      'medicines_created', v_medicines_created, 'batches_created', v_batches_created,
      'batches_topped_up', v_batches_topped_up
    )
  );

  return jsonb_build_object(
    'purchase_id', v_purchase_id,
    'items', v_item_count,
    'medicines_created', v_medicines_created,
    'batches_created', v_batches_created,
    'batches_topped_up', v_batches_topped_up,
    'total_amount', round(v_total, 2)
  );
end;
$$;

revoke all on function public.create_stock_purchase(jsonb) from public, anon;
grant execute on function public.create_stock_purchase(jsonb) to authenticated;
