create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  branch_id uuid references public.branches(id) on delete set null,
  patient_id uuid not null references public.patients(id) on delete cascade,
  appointment_id uuid references public.appointments(id) on delete set null,
  consultation_id uuid references public.consultations(id) on delete set null,
  prescription_id uuid references public.prescriptions(id) on delete set null,
  pharmacy_order_id uuid references public.pharmacy_orders(id) on delete set null,
  invoice_number text not null,
  invoice_type text default 'consultation' check (invoice_type in ('consultation','procedure','pharmacy','package','other')),
  subtotal numeric(12,2) not null default 0,
  discount_amount numeric(12,2) not null default 0,
  tax_amount numeric(12,2) not null default 0,
  total_amount numeric(12,2) not null default 0,
  paid_amount numeric(12,2) not null default 0,
  balance_amount numeric(12,2) not null default 0,
  payment_status text not null default 'unpaid' check (payment_status in ('unpaid','partial','paid')),
  invoice_status text not null default 'issued' check (invoice_status in ('draft','issued','cancelled')),
  notes text,
  created_by uuid references public.staff_profiles(id) on delete set null,
  cancelled_by uuid references public.staff_profiles(id) on delete set null,
  cancelled_at timestamptz,
  cancellation_reason text,
  metadata jsonb default '{}',
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(clinic_id, invoice_number),
  check (subtotal >= 0 and discount_amount >= 0 and tax_amount >= 0 and total_amount >= 0 and paid_amount >= 0 and balance_amount >= 0)
);

create table if not exists public.invoice_items (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  item_type text not null default 'other' check (item_type in ('consultation','procedure','pharmacy','package','other')),
  reference_id uuid,
  description text not null,
  quantity numeric(12,2) not null default 1,
  unit_price numeric(12,2) not null default 0,
  discount_amount numeric(12,2) not null default 0,
  tax_rate numeric(5,2) not null default 0,
  tax_amount numeric(12,2) not null default 0,
  line_total numeric(12,2) not null default 0,
  created_at timestamptz default now(),
  check (quantity >= 0 and unit_price >= 0 and discount_amount >= 0 and tax_rate >= 0 and tax_amount >= 0 and line_total >= 0)
);

create table if not exists public.manual_payment_records (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  branch_id uuid references public.branches(id) on delete set null,
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  patient_id uuid not null references public.patients(id) on delete cascade,
  amount numeric(12,2) not null check (amount > 0),
  payment_mode text not null check (payment_mode in ('cash','upi','card','online_link')),
  reference_number text,
  payment_note text,
  received_by uuid references public.staff_profiles(id) on delete set null,
  received_at timestamptz default now(),
  created_at timestamptz default now()
);

create table if not exists public.invoice_status_history (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  old_status text,
  new_status text,
  old_payment_status text,
  new_payment_status text,
  reason text,
  changed_by uuid references public.staff_profiles(id) on delete set null,
  created_at timestamptz default now()
);

create index if not exists idx_invoices_clinic_id on public.invoices(clinic_id);
create index if not exists idx_invoices_branch_id on public.invoices(branch_id);
create index if not exists idx_invoices_patient_id on public.invoices(patient_id);
create index if not exists idx_invoices_invoice_number on public.invoices(invoice_number);
create index if not exists idx_invoices_payment_status on public.invoices(payment_status);
create index if not exists idx_invoices_invoice_status on public.invoices(invoice_status);
create index if not exists idx_invoices_pharmacy_order_id on public.invoices(pharmacy_order_id);
create index if not exists idx_invoice_items_invoice_id on public.invoice_items(invoice_id);
create index if not exists idx_manual_payment_records_invoice_id on public.manual_payment_records(invoice_id);
create index if not exists idx_manual_payment_records_patient_id on public.manual_payment_records(patient_id);
create index if not exists idx_invoice_status_history_invoice_id on public.invoice_status_history(invoice_id);

drop trigger if exists set_invoices_updated_at on public.invoices;
create trigger set_invoices_updated_at before update on public.invoices
for each row execute function public.set_updated_at();

alter table public.invoices enable row level security;
alter table public.invoice_items enable row level security;
alter table public.manual_payment_records enable row level security;
alter table public.invoice_status_history enable row level security;

create policy "super_admin_manage_invoices" on public.invoices for all to authenticated using (public.is_super_admin()) with check (public.is_super_admin());
create policy "clinic_staff_view_invoices" on public.invoices for select to authenticated using (clinic_id = public.current_clinic_id() and (public.has_permission('billing.view') or public.has_permission('billing.manage') or public.has_permission('pharmacy.view') or public.has_permission('prescriptions.view')));
create policy "billing_staff_create_invoices" on public.invoices for insert to authenticated with check (clinic_id = public.current_clinic_id() and (public.has_permission('billing.create') or public.has_permission('billing.manage') or (invoice_type = 'pharmacy' and (public.has_permission('pharmacy.bill') or public.has_permission('pharmacy.manage')))));
create policy "billing_staff_update_invoices" on public.invoices for update to authenticated using (clinic_id = public.current_clinic_id() and (public.has_permission('billing.edit') or public.has_permission('billing.manage') or (invoice_type = 'pharmacy' and (public.has_permission('pharmacy.bill') or public.has_permission('pharmacy.manage'))))) with check (clinic_id = public.current_clinic_id() and (public.has_permission('billing.edit') or public.has_permission('billing.manage') or (invoice_type = 'pharmacy' and (public.has_permission('pharmacy.bill') or public.has_permission('pharmacy.manage')))));

create policy "super_admin_manage_invoice_items" on public.invoice_items for all to authenticated using (public.is_super_admin()) with check (public.is_super_admin());
create policy "clinic_staff_view_invoice_items" on public.invoice_items for select to authenticated using (clinic_id = public.current_clinic_id() and exists (select 1 from public.invoices i where i.id = invoice_id));
create policy "billing_staff_manage_invoice_items" on public.invoice_items for all to authenticated using (clinic_id = public.current_clinic_id() and (public.has_permission('billing.edit') or public.has_permission('billing.manage') or public.has_permission('billing.create') or public.has_permission('pharmacy.bill') or public.has_permission('pharmacy.manage'))) with check (clinic_id = public.current_clinic_id() and (public.has_permission('billing.edit') or public.has_permission('billing.manage') or public.has_permission('billing.create') or public.has_permission('pharmacy.bill') or public.has_permission('pharmacy.manage')));

create policy "super_admin_manage_manual_payment_records" on public.manual_payment_records for all to authenticated using (public.is_super_admin()) with check (public.is_super_admin());
create policy "clinic_staff_view_manual_payment_records" on public.manual_payment_records for select to authenticated using (clinic_id = public.current_clinic_id() and public.has_permission('billing.view'));
create policy "billing_staff_insert_manual_payment_records" on public.manual_payment_records for insert to authenticated with check (clinic_id = public.current_clinic_id() and (public.has_permission('billing.bill') or public.has_permission('billing.edit') or public.has_permission('billing.manage') or public.has_permission('pharmacy.bill') or public.has_permission('pharmacy.manage')));

create policy "super_admin_manage_invoice_status_history" on public.invoice_status_history for all to authenticated using (public.is_super_admin()) with check (public.is_super_admin());
create policy "clinic_staff_view_invoice_status_history" on public.invoice_status_history for select to authenticated using (clinic_id = public.current_clinic_id() and public.has_permission('billing.view'));
create policy "billing_staff_insert_invoice_status_history" on public.invoice_status_history for insert to authenticated with check (clinic_id = public.current_clinic_id() and (public.has_permission('billing.edit') or public.has_permission('billing.manage') or public.has_permission('billing.bill') or public.has_permission('pharmacy.bill') or public.has_permission('pharmacy.manage')));

create or replace function public.next_invoice_number(target_clinic_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  prefix text := 'INV-' || to_char(now(), 'YYYYMMDD') || '-';
  next_value int;
begin
  select coalesce(max(nullif(regexp_replace(invoice_number, '^' || prefix, ''), '')::int), 0) + 1
  into next_value
  from public.invoices
  where clinic_id = target_clinic_id
    and invoice_number like prefix || '%';

  return prefix || lpad(next_value::text, 4, '0');
end;
$$;

create or replace function public.create_invoice_with_items(input jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  staff_row public.staff_profiles;
  patient_row public.patients;
  invoice_row public.invoices;
  item jsonb;
  inserted_item public.invoice_items;
  items_result jsonb := '[]'::jsonb;
  input_invoice jsonb := coalesce(input->'invoice', '{}'::jsonb);
  input_items jsonb := coalesce(input->'items', '[]'::jsonb);
  target_clinic_id uuid;
  subtotal_value numeric(12,2) := 0;
  discount_value numeric(12,2) := 0;
  tax_value numeric(12,2) := 0;
  total_value numeric(12,2) := 0;
  paid_value numeric(12,2) := 0;
  balance_value numeric(12,2) := 0;
  payment_value text;
  quantity_value numeric(12,2);
  unit_value numeric(12,2);
  item_discount numeric(12,2);
  tax_rate_value numeric(5,2);
  item_tax numeric(12,2);
  line_value numeric(12,2);
begin
  select * into staff_row from public.staff_profiles where id = auth.uid() and status = 'active';
  if staff_row.id is null and not public.is_super_admin() then
    raise exception 'Active staff profile required';
  end if;

  target_clinic_id := coalesce(nullif(input_invoice->>'clinic_id', '')::uuid, staff_row.clinic_id);
  if target_clinic_id is null then
    raise exception 'Invoice clinic_id is required';
  end if;
  if not public.is_super_admin() and target_clinic_id <> staff_row.clinic_id then
    raise exception 'Invoice is outside current clinic';
  end if;

  select * into patient_row from public.patients where id = (input_invoice->>'patient_id')::uuid and clinic_id = target_clinic_id;
  if patient_row.id is null then
    raise exception 'Patient not found in clinic';
  end if;

  if not (
    public.is_super_admin()
    or public.has_permission('billing.create')
    or public.has_permission('billing.manage')
    or (coalesce(input_invoice->>'invoice_type', 'consultation') = 'pharmacy' and (public.has_permission('pharmacy.bill') or public.has_permission('pharmacy.manage')))
  ) then
    raise exception 'Invoice create permission required';
  end if;

  for item in select * from jsonb_array_elements(input_items)
  loop
    quantity_value := coalesce((item->>'quantity')::numeric, 1);
    unit_value := coalesce((item->>'unit_price')::numeric, 0);
    item_discount := coalesce((item->>'discount_amount')::numeric, 0);
    tax_rate_value := coalesce((item->>'tax_rate')::numeric, 0);
    item_tax := coalesce(nullif(item->>'tax_amount', '')::numeric, round(((quantity_value * unit_value - item_discount) * tax_rate_value / 100), 2));
    line_value := greatest(quantity_value * unit_value - item_discount + item_tax, 0);
    subtotal_value := subtotal_value + (quantity_value * unit_value);
    discount_value := discount_value + item_discount;
    tax_value := tax_value + item_tax;
    total_value := total_value + line_value;
  end loop;

  paid_value := coalesce((input_invoice->>'paid_amount')::numeric, 0);
  if paid_value > total_value then
    raise exception 'Paid amount cannot exceed invoice total';
  end if;
  balance_value := total_value - paid_value;
  payment_value := case when paid_value <= 0 then 'unpaid' when balance_value <= 0 then 'paid' else 'partial' end;

  insert into public.invoices (
    clinic_id, branch_id, patient_id, appointment_id, consultation_id, prescription_id, pharmacy_order_id,
    invoice_number, invoice_type, subtotal, discount_amount, tax_amount, total_amount, paid_amount,
    balance_amount, payment_status, invoice_status, notes, created_by, metadata
  )
  values (
    target_clinic_id,
    coalesce(nullif(input_invoice->>'branch_id', '')::uuid, staff_row.branch_id),
    patient_row.id,
    nullif(input_invoice->>'appointment_id', '')::uuid,
    nullif(input_invoice->>'consultation_id', '')::uuid,
    nullif(input_invoice->>'prescription_id', '')::uuid,
    nullif(input_invoice->>'pharmacy_order_id', '')::uuid,
    coalesce(nullif(input_invoice->>'invoice_number', ''), public.next_invoice_number(target_clinic_id)),
    coalesce(input_invoice->>'invoice_type', 'consultation'),
    subtotal_value,
    discount_value,
    tax_value,
    total_value,
    paid_value,
    balance_value,
    payment_value,
    coalesce(input_invoice->>'invoice_status', 'issued'),
    input_invoice->>'notes',
    auth.uid(),
    coalesce(input_invoice->'metadata', '{}'::jsonb)
  )
  returning * into invoice_row;

  for item in select * from jsonb_array_elements(input_items)
  loop
    quantity_value := coalesce((item->>'quantity')::numeric, 1);
    unit_value := coalesce((item->>'unit_price')::numeric, 0);
    item_discount := coalesce((item->>'discount_amount')::numeric, 0);
    tax_rate_value := coalesce((item->>'tax_rate')::numeric, 0);
    item_tax := coalesce(nullif(item->>'tax_amount', '')::numeric, round(((quantity_value * unit_value - item_discount) * tax_rate_value / 100), 2));
    line_value := greatest(quantity_value * unit_value - item_discount + item_tax, 0);

    insert into public.invoice_items (
      clinic_id, invoice_id, item_type, reference_id, description, quantity, unit_price,
      discount_amount, tax_rate, tax_amount, line_total
    )
    values (
      invoice_row.clinic_id,
      invoice_row.id,
      coalesce(item->>'item_type', invoice_row.invoice_type),
      nullif(item->>'reference_id', '')::uuid,
      item->>'description',
      quantity_value,
      unit_value,
      item_discount,
      tax_rate_value,
      item_tax,
      line_value
    )
    returning * into inserted_item;

    items_result := items_result || jsonb_build_array(to_jsonb(inserted_item));
  end loop;

  if paid_value > 0 then
    insert into public.manual_payment_records (clinic_id, branch_id, invoice_id, patient_id, amount, payment_mode, reference_number, payment_note, received_by, received_at)
    values (invoice_row.clinic_id, invoice_row.branch_id, invoice_row.id, invoice_row.patient_id, paid_value, coalesce(input_invoice->>'payment_mode', 'cash'), input_invoice->>'reference_number', 'Initial manual payment', auth.uid(), now());
  end if;

  insert into public.invoice_status_history (clinic_id, invoice_id, old_status, new_status, old_payment_status, new_payment_status, reason, changed_by)
  values (invoice_row.clinic_id, invoice_row.id, null, invoice_row.invoice_status, null, invoice_row.payment_status, 'invoice_created', auth.uid());

  return jsonb_build_object('invoice', to_jsonb(invoice_row), 'items', items_result);
end;
$$;

create or replace function public.record_manual_payment(input jsonb)
returns public.invoices
language plpgsql
security definer
set search_path = public
as $$
declare
  invoice_row public.invoices;
  old_payment text;
  new_payment text;
  amount_value numeric(12,2) := coalesce((input->>'amount')::numeric, 0);
begin
  select * into invoice_row from public.invoices where id = (input->>'invoice_id')::uuid for update;
  if invoice_row.id is null then
    raise exception 'Invoice not found';
  end if;
  if not public.is_super_admin() and invoice_row.clinic_id <> public.current_clinic_id() then
    raise exception 'Invoice is outside current clinic';
  end if;
  if invoice_row.invoice_status = 'cancelled' then
    raise exception 'Cancelled invoice cannot receive payment';
  end if;
  if amount_value <= 0 then
    raise exception 'Payment amount must be greater than zero';
  end if;
  if amount_value > invoice_row.balance_amount then
    raise exception 'Manual payment cannot exceed invoice balance';
  end if;
  if not (public.is_super_admin() or public.has_permission('billing.bill') or public.has_permission('billing.edit') or public.has_permission('billing.manage') or public.has_permission('pharmacy.bill') or public.has_permission('pharmacy.manage')) then
    raise exception 'Manual payment permission required';
  end if;

  old_payment := invoice_row.payment_status;
  new_payment := case when invoice_row.balance_amount - amount_value <= 0 then 'paid' else 'partial' end;

  insert into public.manual_payment_records (clinic_id, branch_id, invoice_id, patient_id, amount, payment_mode, reference_number, payment_note, received_by, received_at)
  values (invoice_row.clinic_id, invoice_row.branch_id, invoice_row.id, invoice_row.patient_id, amount_value, coalesce(input->>'payment_mode', 'cash'), input->>'reference_number', input->>'payment_note', auth.uid(), coalesce(nullif(input->>'received_at', '')::timestamptz, now()));

  update public.invoices
  set paid_amount = paid_amount + amount_value,
      balance_amount = balance_amount - amount_value,
      payment_status = new_payment
  where id = invoice_row.id
  returning * into invoice_row;

  insert into public.invoice_status_history (clinic_id, invoice_id, old_status, new_status, old_payment_status, new_payment_status, reason, changed_by)
  values (invoice_row.clinic_id, invoice_row.id, invoice_row.invoice_status, invoice_row.invoice_status, old_payment, invoice_row.payment_status, coalesce(input->>'payment_note', 'manual_payment_recorded'), auth.uid());

  return invoice_row;
end;
$$;

create or replace function public.cancel_invoice(invoice_id uuid, reason text)
returns public.invoices
language plpgsql
security definer
set search_path = public
as $$
declare
  invoice_row public.invoices;
begin
  select * into invoice_row from public.invoices where id = invoice_id for update;
  if invoice_row.id is null then
    raise exception 'Invoice not found';
  end if;
  if not public.is_super_admin() and invoice_row.clinic_id <> public.current_clinic_id() then
    raise exception 'Invoice is outside current clinic';
  end if;
  if not (public.is_super_admin() or public.has_permission('billing.cancel') or public.has_permission('billing.manage')) then
    raise exception 'Invoice cancel permission required';
  end if;
  if invoice_row.invoice_status = 'cancelled' then
    return invoice_row;
  end if;

  update public.invoices
  set invoice_status = 'cancelled',
      cancelled_by = auth.uid(),
      cancelled_at = now(),
      cancellation_reason = reason
  where id = invoice_row.id
  returning * into invoice_row;

  insert into public.invoice_status_history (clinic_id, invoice_id, old_status, new_status, old_payment_status, new_payment_status, reason, changed_by)
  values (invoice_row.clinic_id, invoice_row.id, 'issued', 'cancelled', invoice_row.payment_status, invoice_row.payment_status, reason, auth.uid());

  return invoice_row;
end;
$$;

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
  select * into order_row from public.pharmacy_orders where id = pharmacy_order_id;
  if order_row.id is null then
    raise exception 'Pharmacy order not found';
  end if;
  if not public.is_super_admin() and order_row.clinic_id <> public.current_clinic_id() then
    raise exception 'Pharmacy order is outside current clinic';
  end if;

  select * into existing_invoice from public.invoices where invoices.pharmacy_order_id = create_invoice_from_pharmacy_order.pharmacy_order_id and invoice_status <> 'cancelled';
  if existing_invoice.id is not null then
    return existing_invoice;
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'item_type', 'pharmacy',
    'reference_id', poi.id,
    'description', poi.medicine_name,
    'quantity', greatest(coalesce(poi.dispensed_quantity, poi.requested_quantity, 1), 1),
    'unit_price', coalesce(msb.selling_price, 0),
    'discount_amount', 0,
    'tax_rate', 0
  )), '[]'::jsonb)
  into items_payload
  from public.pharmacy_order_items poi
  left join public.medicine_stock_batches msb on msb.id = poi.batch_id
  where poi.pharmacy_order_id = order_row.id;

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

revoke all on function public.next_invoice_number(uuid) from public;
grant execute on function public.next_invoice_number(uuid) to authenticated;
revoke all on function public.create_invoice_with_items(jsonb) from public;
grant execute on function public.create_invoice_with_items(jsonb) to authenticated;
revoke all on function public.record_manual_payment(jsonb) from public;
grant execute on function public.record_manual_payment(jsonb) to authenticated;
revoke all on function public.cancel_invoice(uuid, text) from public;
grant execute on function public.cancel_invoice(uuid, text) to authenticated;
revoke all on function public.create_invoice_from_pharmacy_order(uuid) from public;
grant execute on function public.create_invoice_from_pharmacy_order(uuid) to authenticated;
