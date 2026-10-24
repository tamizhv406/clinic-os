-- =====================================================================
-- Atomic counter sale (Phase 16, Task 8 - Counter Billing check)
-- =====================================================================
-- The Counter Billing page used to create a pharmacy invoice from the browser
-- with prices typed by the user and never reduced stock. This RPC does the
-- whole sale in one transaction:
--   * prices come from the batches being sold (never from the client);
--   * stock is allocated FEFO (earliest non-expired batch first, across batches
--     when needed), or from one requested batch; expired, blocked or empty
--     batches are never sold; a shortage rejects the whole sale;
--   * invoice + items + payment record + status history, one 'dispense' stock
--     movement per batch used, low-stock refresh and an audit row.
-- Selling prices are treated as GST-inclusive (tax 0 on the invoice), as the
-- existing pharmacy invoices already do. Safe to re-run.
-- =====================================================================

create or replace function public.create_pharmacy_counter_sale(input jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  c_max_lines constant int := 100;
  v_staff public.staff_profiles;
  v_patient public.patients;
  v_today date := (now() at time zone 'Asia/Kolkata')::date;
  v_items jsonb := input->'items';
  v_mode text := lower(coalesce(nullif(btrim(input->>'payment_mode'), ''), 'cash'));
  v_notes text := nullif(btrim(coalesce(input->>'notes', '')), '');
  v_discount numeric := coalesce(public._jsonb_to_numeric(input->'discount_amount'), 0);
  v_paid_input numeric := public._jsonb_to_numeric(input->'paid_amount');
  v_errors text[] := '{}';
  v_idx int;
  v_item jsonb;
  v_medicine public.medicines;
  v_qty numeric;
  v_need int;
  v_take int;
  v_batch public.medicine_stock_batches;
  v_requested_batch uuid;
  -- One entry per batch used: medicine, batch, quantity, unit price, description.
  v_lines jsonb := '[]'::jsonb;
  v_line jsonb;
  v_subtotal numeric := 0;
  v_total numeric;
  v_paid numeric;
  v_line_count int;
  v_line_gross numeric;
  v_line_discount numeric;
  v_discount_left numeric;
  v_invoice public.invoices;
  v_invoice_number text;
begin
  select * into v_staff from public.staff_profiles where id = auth.uid() and status = 'active';
  if v_staff.id is null or v_staff.clinic_id is null then
    raise exception 'A clinic staff profile is required for counter sales.' using errcode = '42501';
  end if;
  if not (public.is_super_admin() or (public.has_module('pharmacy') and (public.has_permission('pharmacy.bill') or public.has_permission('pharmacy.manage')))) then
    raise exception 'You do not have permission to bill at the pharmacy counter.' using errcode = '42501';
  end if;

  select * into v_patient from public.patients where id = nullif(input->>'patient_id', '')::uuid and clinic_id = v_staff.clinic_id;
  if v_patient.id is null then
    v_errors := array_append(v_errors, 'Select a patient of this clinic.');
  end if;
  if v_mode not in ('cash', 'upi', 'card', 'online_link') then
    v_errors := array_append(v_errors, 'Payment mode must be cash, upi, card or online_link.');
  end if;
  if v_discount = 'NaN' or v_discount < 0 then
    v_errors := array_append(v_errors, 'Discount must be a number of 0 or more.');
  end if;
  if v_paid_input = 'NaN' or v_paid_input < 0 then
    v_errors := array_append(v_errors, 'Paid amount must be a number of 0 or more.');
  end if;
  if v_notes is not null and length(v_notes) > 1000 then
    v_errors := array_append(v_errors, 'Notes are too long (max 1000 characters).');
  end if;
  if v_items is null or jsonb_typeof(v_items) <> 'array' or jsonb_array_length(v_items) = 0 then
    v_errors := array_append(v_errors, 'Add at least one medicine.');
  elsif jsonb_array_length(v_items) > c_max_lines then
    v_errors := array_append(v_errors, format('A counter sale can have at most %s medicines.', c_max_lines));
  end if;
  if coalesce(array_length(v_errors, 1), 0) > 0 then
    raise exception using errcode = '22023', message = 'Sale was not saved. ' || array_to_string(v_errors, ' ');
  end if;

  -- Serialises invoice numbering for this clinic (next_invoice_number reads max()).
  perform pg_advisory_xact_lock(hashtextextended('invoice_number:' || v_staff.clinic_id::text, 0));

  for v_idx in 0 .. jsonb_array_length(v_items) - 1 loop
    v_item := v_items -> v_idx;
    v_qty := public._jsonb_to_numeric(v_item->'quantity');
    v_requested_batch := nullif(v_item->>'batch_id', '')::uuid;

    select * into v_medicine from public.medicines
    where id = nullif(v_item->>'medicine_id', '')::uuid and clinic_id = v_staff.clinic_id and status = 'active';
    if v_medicine.id is null then
      raise exception 'Sale was not saved. Line %: medicine not found in this clinic.', v_idx + 1 using errcode = '22023';
    end if;
    if v_qty is null or v_qty = 'NaN' or v_qty <> trunc(v_qty) or v_qty <= 0 or v_qty > 10000 then
      raise exception 'Sale was not saved. Line % (%): quantity must be a whole number from 1 to 10000.', v_idx + 1, v_medicine.name using errcode = '22023';
    end if;
    v_need := v_qty::int;

    for v_batch in
      select b.* from public.medicine_stock_batches b
      where b.medicine_id = v_medicine.id
        and b.clinic_id = v_staff.clinic_id
        and coalesce(b.status, 'active') = 'active'
        and b.quantity_available > 0
        and (b.expiry_date is null or b.expiry_date >= v_today)
        and (v_requested_batch is null or b.id = v_requested_batch)
      order by b.expiry_date nulls last, b.created_at
      for update
    loop
      exit when v_need = 0;
      v_take := least(v_need, v_batch.quantity_available);

      update public.medicine_stock_batches
      set quantity_available = quantity_available - v_take,
          status = case when quantity_available - v_take = 0 then 'depleted' else status end
      where id = v_batch.id;

      v_lines := v_lines || jsonb_build_array(jsonb_build_object(
        'medicine_id', v_medicine.id,
        'batch_id', v_batch.id,
        'quantity', v_take,
        'unit_price', coalesce(v_batch.selling_price, 0),
        'description', format('%s (batch %s)', v_medicine.name, v_batch.batch_no)
      ));
      v_subtotal := v_subtotal + v_take * coalesce(v_batch.selling_price, 0);
      v_need := v_need - v_take;
    end loop;

    if v_need > 0 then
      raise exception 'Sale was not saved. Line % (%): only % unit(s) in usable stock%.', v_idx + 1, v_medicine.name, v_qty::int - v_need,
        case when v_requested_batch is not null then ' in the chosen batch' else '' end
        using errcode = '22023';
    end if;
  end loop;

  v_subtotal := round(v_subtotal, 2);
  v_discount := round(v_discount, 2);
  if v_discount > v_subtotal then
    raise exception 'Sale was not saved. Discount (%) is more than the bill amount (%).', v_discount, v_subtotal using errcode = '22023';
  end if;
  v_total := v_subtotal - v_discount;
  v_paid := round(coalesce(v_paid_input, v_total), 2);
  if v_paid > v_total then
    raise exception 'Sale was not saved. Paid amount (%) is more than the bill total (%).', v_paid, v_total using errcode = '22023';
  end if;

  v_invoice_number := public.next_invoice_number(v_staff.clinic_id);
  insert into public.invoices (
    clinic_id, branch_id, patient_id, invoice_number, invoice_type, subtotal, discount_amount, tax_amount,
    total_amount, paid_amount, balance_amount, payment_status, invoice_status, notes, created_by, metadata
  )
  values (
    v_staff.clinic_id, v_staff.branch_id, v_patient.id, v_invoice_number, 'pharmacy', v_subtotal, v_discount, 0,
    v_total, v_paid, v_total - v_paid,
    case when v_paid <= 0 then 'unpaid' when v_paid >= v_total then 'paid' else 'partial' end,
    'issued', v_notes, v_staff.id,
    jsonb_build_object('source', 'pharmacy_counter', 'payment_mode', v_mode)
  )
  returning * into v_invoice;

  -- Spread the bill discount over the lines so line totals add up to the invoice total.
  v_line_count := jsonb_array_length(v_lines);
  v_discount_left := v_discount;
  for v_idx in 0 .. v_line_count - 1 loop
    v_line := v_lines -> v_idx;
    v_line_gross := round((v_line->>'quantity')::numeric * (v_line->>'unit_price')::numeric, 2);
    v_line_discount := case
      when v_idx = v_line_count - 1 then v_discount_left
      when v_subtotal > 0 then least(v_discount_left, round(v_discount * v_line_gross / v_subtotal, 2))
      else 0
    end;
    v_discount_left := v_discount_left - v_line_discount;

    insert into public.invoice_items (clinic_id, invoice_id, item_type, reference_id, description, quantity, unit_price, discount_amount, tax_rate, tax_amount, line_total)
    values (v_staff.clinic_id, v_invoice.id, 'pharmacy', (v_line->>'batch_id')::uuid, v_line->>'description',
            (v_line->>'quantity')::numeric, (v_line->>'unit_price')::numeric, v_line_discount, 0, 0, greatest(v_line_gross - v_line_discount, 0));

    insert into public.stock_movements (clinic_id, branch_id, medicine_id, batch_id, movement_type, quantity, reason, reference_type, reference_id, created_by)
    values (v_staff.clinic_id, v_staff.branch_id, (v_line->>'medicine_id')::uuid, (v_line->>'batch_id')::uuid, 'dispense', (v_line->>'quantity')::int,
            format('Counter sale %s', v_invoice_number), 'pharmacy_counter_sale', v_invoice.id, v_staff.id);
  end loop;

  if v_paid > 0 then
    insert into public.manual_payment_records (clinic_id, branch_id, invoice_id, patient_id, amount, payment_mode, payment_note, received_by, received_at)
    values (v_staff.clinic_id, v_staff.branch_id, v_invoice.id, v_patient.id, v_paid, v_mode, 'Pharmacy counter sale', v_staff.id, now());
  end if;

  insert into public.invoice_status_history (clinic_id, invoice_id, old_status, new_status, old_payment_status, new_payment_status, reason, changed_by)
  values (v_staff.clinic_id, v_invoice.id, null, v_invoice.invoice_status, null, v_invoice.payment_status, 'pharmacy_counter_sale', v_staff.id);

  insert into public.audit_logs (clinic_id, branch_id, actor_id, user_id, actor_role, event_type, action, entity_type, entity_id, status, severity, message, metadata)
  values (v_staff.clinic_id, v_staff.branch_id, v_staff.id, v_staff.id, v_staff.role_key, 'pharmacy_counter_sale', 'create', 'invoices', v_invoice.id,
          'success', 'info', format('Counter sale %s recorded.', v_invoice_number),
          jsonb_build_object('lines', v_line_count, 'total_amount', v_total, 'paid_amount', v_paid, 'payment_mode', v_mode));

  perform public.refresh_low_stock_alerts(v_staff.clinic_id, v_staff.branch_id);

  return jsonb_build_object(
    'invoice_id', v_invoice.id,
    'invoice_number', v_invoice_number,
    'subtotal', v_subtotal,
    'discount_amount', v_discount,
    'total_amount', v_total,
    'paid_amount', v_paid,
    'payment_status', v_invoice.payment_status,
    'lines', v_line_count
  );
end;
$$;

revoke all on function public.create_pharmacy_counter_sale(jsonb) from public, anon;
grant execute on function public.create_pharmacy_counter_sale(jsonb) to authenticated;
