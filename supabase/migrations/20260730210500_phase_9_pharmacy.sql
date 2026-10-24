create table if not exists public.medicines (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  branch_id uuid references public.branches(id) on delete set null,
  name text not null,
  generic_name text,
  category text,
  manufacturer text,
  strength text,
  unit text,
  hsn_code text,
  gst_rate numeric(5,2) default 0,
  reorder_level int default 0,
  status text default 'active' check (status in ('active','inactive','archived')),
  metadata jsonb default '{}',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.medicine_stock_batches (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  branch_id uuid references public.branches(id) on delete set null,
  medicine_id uuid not null references public.medicines(id) on delete cascade,
  batch_no text not null,
  expiry_date date,
  quantity_available int not null default 0 check (quantity_available >= 0),
  purchase_price numeric(12,2) default 0,
  selling_price numeric(12,2) default 0,
  supplier_name text,
  status text default 'active' check (status in ('active','expired','depleted','blocked')),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(medicine_id, batch_no)
);

create table if not exists public.stock_movements (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  branch_id uuid references public.branches(id) on delete set null,
  medicine_id uuid not null references public.medicines(id) on delete cascade,
  batch_id uuid references public.medicine_stock_batches(id) on delete set null,
  movement_type text not null check (movement_type in ('add_stock','remove_stock','damage','expired','correction','dispense')),
  quantity int not null check (quantity > 0),
  reason text,
  reference_type text,
  reference_id uuid,
  created_by uuid references public.staff_profiles(id) on delete set null,
  created_at timestamptz default now()
);

create table if not exists public.pharmacy_orders (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  branch_id uuid references public.branches(id) on delete set null,
  prescription_id uuid not null references public.prescriptions(id) on delete cascade,
  patient_id uuid not null references public.patients(id) on delete cascade,
  doctor_id uuid references public.doctor_profiles(id) on delete set null,
  status text default 'pending' check (status in ('pending','partially_dispensed','dispensed','cancelled')),
  total_items int default 0,
  notes text,
  created_by uuid references public.staff_profiles(id) on delete set null,
  dispensed_by uuid references public.staff_profiles(id) on delete set null,
  dispensed_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(prescription_id)
);

create table if not exists public.pharmacy_order_items (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  pharmacy_order_id uuid not null references public.pharmacy_orders(id) on delete cascade,
  prescription_item_id uuid references public.prescription_items(id) on delete set null,
  medicine_id uuid references public.medicines(id) on delete set null,
  batch_id uuid references public.medicine_stock_batches(id) on delete set null,
  medicine_name text not null,
  requested_quantity int default 1 check (requested_quantity >= 0),
  dispensed_quantity int default 0 check (dispensed_quantity >= 0),
  status text default 'pending' check (status in ('pending','partial','dispensed','unavailable','cancelled')),
  notes text,
  created_at timestamptz default now()
);

create table if not exists public.low_stock_alerts (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  branch_id uuid references public.branches(id) on delete set null,
  medicine_id uuid not null references public.medicines(id) on delete cascade,
  current_stock int not null default 0,
  reorder_level int not null default 0,
  status text default 'active' check (status in ('active','resolved')),
  created_at timestamptz default now(),
  resolved_at timestamptz,
  unique(medicine_id, branch_id, status)
);

create index if not exists idx_medicines_clinic_id on public.medicines(clinic_id);
create index if not exists idx_medicines_branch_id on public.medicines(branch_id);
create index if not exists idx_medicines_name on public.medicines(name);
create index if not exists idx_medicine_stock_batches_medicine_id on public.medicine_stock_batches(medicine_id);
create index if not exists idx_medicine_stock_batches_clinic_branch on public.medicine_stock_batches(clinic_id, branch_id);
create index if not exists idx_medicine_stock_batches_expiry_date on public.medicine_stock_batches(expiry_date);
create index if not exists idx_stock_movements_medicine_id on public.stock_movements(medicine_id);
create index if not exists idx_stock_movements_batch_id on public.stock_movements(batch_id);
create index if not exists idx_stock_movements_created_at on public.stock_movements(created_at);
create index if not exists idx_pharmacy_orders_clinic_id on public.pharmacy_orders(clinic_id);
create index if not exists idx_pharmacy_orders_prescription_id on public.pharmacy_orders(prescription_id);
create index if not exists idx_pharmacy_orders_status on public.pharmacy_orders(status);
create index if not exists idx_pharmacy_order_items_order_id on public.pharmacy_order_items(pharmacy_order_id);
create index if not exists idx_low_stock_alerts_clinic_branch on public.low_stock_alerts(clinic_id, branch_id);
create index if not exists idx_low_stock_alerts_status on public.low_stock_alerts(status);

drop trigger if exists set_medicines_updated_at on public.medicines;
create trigger set_medicines_updated_at before update on public.medicines
for each row execute function public.set_updated_at();

drop trigger if exists set_medicine_stock_batches_updated_at on public.medicine_stock_batches;
create trigger set_medicine_stock_batches_updated_at before update on public.medicine_stock_batches
for each row execute function public.set_updated_at();

drop trigger if exists set_pharmacy_orders_updated_at on public.pharmacy_orders;
create trigger set_pharmacy_orders_updated_at before update on public.pharmacy_orders
for each row execute function public.set_updated_at();

alter table public.medicines enable row level security;
alter table public.medicine_stock_batches enable row level security;
alter table public.stock_movements enable row level security;
alter table public.pharmacy_orders enable row level security;
alter table public.pharmacy_order_items enable row level security;
alter table public.low_stock_alerts enable row level security;

create policy "super_admin_manage_medicines" on public.medicines for all to authenticated using (public.is_super_admin()) with check (public.is_super_admin());
create policy "staff_view_own_clinic_medicines" on public.medicines for select to authenticated using (clinic_id = public.current_clinic_id() and (public.has_module('pharmacy') or public.has_permission('prescriptions.view')));
create policy "pharmacy_staff_manage_medicines" on public.medicines for all to authenticated using (clinic_id = public.current_clinic_id() and public.has_module('pharmacy') and (public.has_permission('pharmacy.create') or public.has_permission('pharmacy.edit') or public.has_permission('pharmacy.manage'))) with check (clinic_id = public.current_clinic_id() and public.has_module('pharmacy') and (public.has_permission('pharmacy.create') or public.has_permission('pharmacy.edit') or public.has_permission('pharmacy.manage')));

create policy "super_admin_manage_medicine_stock_batches" on public.medicine_stock_batches for all to authenticated using (public.is_super_admin()) with check (public.is_super_admin());
create policy "staff_view_own_clinic_medicine_stock_batches" on public.medicine_stock_batches for select to authenticated using (clinic_id = public.current_clinic_id() and (public.has_module('pharmacy') or public.has_permission('prescriptions.view')));
create policy "pharmacy_staff_manage_medicine_stock_batches" on public.medicine_stock_batches for all to authenticated using (clinic_id = public.current_clinic_id() and public.has_module('pharmacy') and (public.has_permission('pharmacy.create') or public.has_permission('pharmacy.edit') or public.has_permission('pharmacy.manage'))) with check (clinic_id = public.current_clinic_id() and public.has_module('pharmacy') and (public.has_permission('pharmacy.create') or public.has_permission('pharmacy.edit') or public.has_permission('pharmacy.manage')));

create policy "super_admin_manage_stock_movements" on public.stock_movements for all to authenticated using (public.is_super_admin()) with check (public.is_super_admin());
create policy "staff_view_own_clinic_stock_movements" on public.stock_movements for select to authenticated using (clinic_id = public.current_clinic_id() and public.has_module('pharmacy'));
create policy "pharmacy_staff_insert_stock_movements" on public.stock_movements for insert to authenticated with check (clinic_id = public.current_clinic_id() and public.has_module('pharmacy') and (public.has_permission('pharmacy.edit') or public.has_permission('pharmacy.manage') or public.has_permission('pharmacy.dispense')));

create policy "super_admin_manage_pharmacy_orders" on public.pharmacy_orders for all to authenticated using (public.is_super_admin()) with check (public.is_super_admin());
create policy "staff_view_own_clinic_pharmacy_orders" on public.pharmacy_orders for select to authenticated using (clinic_id = public.current_clinic_id() and (public.has_module('pharmacy') or public.has_permission('prescriptions.view') or public.has_permission('prescriptions.manage')));
create policy "pharmacy_staff_manage_pharmacy_orders" on public.pharmacy_orders for all to authenticated using (clinic_id = public.current_clinic_id() and public.has_module('pharmacy') and (public.has_permission('pharmacy.dispense') or public.has_permission('pharmacy.manage'))) with check (clinic_id = public.current_clinic_id() and public.has_module('pharmacy') and (public.has_permission('pharmacy.dispense') or public.has_permission('pharmacy.manage')));

create policy "super_admin_manage_pharmacy_order_items" on public.pharmacy_order_items for all to authenticated using (public.is_super_admin()) with check (public.is_super_admin());
create policy "staff_view_own_clinic_pharmacy_order_items" on public.pharmacy_order_items for select to authenticated using (clinic_id = public.current_clinic_id() and (public.has_module('pharmacy') or public.has_permission('prescriptions.view') or public.has_permission('prescriptions.manage')));
create policy "pharmacy_staff_manage_pharmacy_order_items" on public.pharmacy_order_items for all to authenticated using (clinic_id = public.current_clinic_id() and public.has_module('pharmacy') and (public.has_permission('pharmacy.dispense') or public.has_permission('pharmacy.manage'))) with check (clinic_id = public.current_clinic_id() and public.has_module('pharmacy') and (public.has_permission('pharmacy.dispense') or public.has_permission('pharmacy.manage')));

create policy "super_admin_manage_low_stock_alerts" on public.low_stock_alerts for all to authenticated using (public.is_super_admin()) with check (public.is_super_admin());
create policy "staff_view_own_clinic_low_stock_alerts" on public.low_stock_alerts for select to authenticated using (clinic_id = public.current_clinic_id() and public.has_module('pharmacy'));
create policy "pharmacy_staff_manage_low_stock_alerts" on public.low_stock_alerts for all to authenticated using (clinic_id = public.current_clinic_id() and public.has_module('pharmacy') and (public.has_permission('pharmacy.edit') or public.has_permission('pharmacy.manage'))) with check (clinic_id = public.current_clinic_id() and public.has_module('pharmacy') and (public.has_permission('pharmacy.edit') or public.has_permission('pharmacy.manage')));

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

  select * into prescription_row from public.prescriptions where id = prescription_id;
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
    or (
      public.has_module('pharmacy')
      and (
        public.has_permission('pharmacy.dispense')
        or public.has_permission('pharmacy.manage')
        or public.has_permission('pharmacy.create')
      )
    )
  ) then
    raise exception 'Pharmacy order permission required';
  end if;

  select * into order_row from public.pharmacy_orders where pharmacy_orders.prescription_id = create_pharmacy_order_from_prescription.prescription_id;
  if order_row.id is not null then
    return order_row;
  end if;

  insert into public.pharmacy_orders (
    clinic_id, branch_id, prescription_id, patient_id, doctor_id, status, total_items, created_by
  )
  values (
    prescription_row.clinic_id,
    prescription_row.branch_id,
    prescription_row.id,
    prescription_row.patient_id,
    prescription_row.doctor_id,
    'pending',
    (select count(*)::int from public.prescription_items where prescription_items.prescription_id = prescription_row.id),
    auth.uid()
  )
  returning * into order_row;

  insert into public.pharmacy_order_items (
    clinic_id, pharmacy_order_id, prescription_item_id, medicine_id, medicine_name,
    requested_quantity, dispensed_quantity, status, notes
  )
  select
    prescription_row.clinic_id,
    order_row.id,
    pi.id,
    m.id,
    pi.medicine_name,
    greatest(coalesce(nullif(regexp_replace(coalesce(pi.quantity, ''), '[^0-9]', '', 'g'), '')::int, 1), 1),
    0,
    case when m.id is null then 'unavailable' else 'pending' end,
    case when m.id is null then 'No matching medicine inventory row' else null end
  from public.prescription_items pi
  left join lateral (
    select med.id
    from public.medicines med
    where med.clinic_id = prescription_row.clinic_id
      and med.status = 'active'
      and lower(med.name) = lower(pi.medicine_name)
    order by med.created_at desc
    limit 1
  ) m on true
  where pi.prescription_id = prescription_row.id;

  update public.prescriptions
  set pharmacy_status = 'received'
  where id = prescription_row.id;

  insert into public.prescription_delivery_logs (clinic_id, prescription_id, channel, old_status, new_status, message, changed_by)
  values (prescription_row.clinic_id, prescription_row.id, 'pharmacy', prescription_row.pharmacy_status, 'received', 'Pharmacy order created', auth.uid());

  return order_row;
end;
$$;

create or replace function public.refresh_low_stock_alerts(clinic_id uuid, branch_id uuid default null)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  staff_row public.staff_profiles;
  affected_count int := 0;
begin
  select * into staff_row from public.staff_profiles where id = auth.uid() and status = 'active';
  if staff_row.id is null and not public.is_super_admin() then
    raise exception 'Active staff profile required';
  end if;
  if not public.is_super_admin() and refresh_low_stock_alerts.clinic_id <> staff_row.clinic_id then
    raise exception 'Clinic is outside current scope';
  end if;

  insert into public.low_stock_alerts (clinic_id, branch_id, medicine_id, current_stock, reorder_level, status)
  select
    m.clinic_id,
    coalesce(refresh_low_stock_alerts.branch_id, m.branch_id),
    m.id,
    coalesce(sum(b.quantity_available) filter (where b.status = 'active'), 0)::int,
    coalesce(m.reorder_level, 0),
    'active'
  from public.medicines m
  left join public.medicine_stock_batches b on b.medicine_id = m.id
    and b.clinic_id = m.clinic_id
    and (refresh_low_stock_alerts.branch_id is null or b.branch_id = refresh_low_stock_alerts.branch_id)
  where m.clinic_id = refresh_low_stock_alerts.clinic_id
    and (refresh_low_stock_alerts.branch_id is null or m.branch_id is null or m.branch_id = refresh_low_stock_alerts.branch_id)
    and m.status = 'active'
  group by m.id, m.clinic_id, m.branch_id, m.reorder_level
  having coalesce(sum(b.quantity_available) filter (where b.status = 'active'), 0)::int <= coalesce(m.reorder_level, 0)
     and coalesce(m.reorder_level, 0) > 0
  on conflict (medicine_id, branch_id, status) do update set
    current_stock = excluded.current_stock,
    reorder_level = excluded.reorder_level,
    resolved_at = null;

  get diagnostics affected_count = row_count;

  update public.low_stock_alerts alert
  set status = 'resolved',
      resolved_at = now()
  where alert.clinic_id = refresh_low_stock_alerts.clinic_id
    and alert.status = 'active'
    and (refresh_low_stock_alerts.branch_id is null or alert.branch_id = refresh_low_stock_alerts.branch_id)
    and exists (
      select 1
      from public.medicines m
      left join public.medicine_stock_batches b on b.medicine_id = m.id
        and b.status = 'active'
        and (alert.branch_id is null or b.branch_id = alert.branch_id)
      where m.id = alert.medicine_id
      group by m.id, m.reorder_level
      having coalesce(sum(b.quantity_available), 0)::int > coalesce(m.reorder_level, 0)
    );

  return affected_count;
end;
$$;

create or replace function public.adjust_medicine_stock(input jsonb)
returns public.medicine_stock_batches
language plpgsql
security definer
set search_path = public
as $$
declare
  staff_row public.staff_profiles;
  batch_row public.medicine_stock_batches;
  medicine_row public.medicines;
  movement text := coalesce(input->>'movement_type', 'correction');
  qty int := coalesce((input->>'quantity')::int, 0);
  next_qty int;
begin
  select * into staff_row from public.staff_profiles where id = auth.uid() and status = 'active';
  if staff_row.id is null and not public.is_super_admin() then
    raise exception 'Active staff profile required';
  end if;
  if qty <= 0 then
    raise exception 'Stock quantity must be greater than zero';
  end if;

  select * into batch_row from public.medicine_stock_batches where id = (input->>'batch_id')::uuid for update;
  if batch_row.id is null then
    raise exception 'Stock batch not found';
  end if;

  if not public.is_super_admin() and batch_row.clinic_id <> staff_row.clinic_id then
    raise exception 'Stock batch is outside current clinic';
  end if;
  if not (
    public.is_super_admin()
    or (
      public.has_module('pharmacy')
      and (public.has_permission('pharmacy.edit') or public.has_permission('pharmacy.manage') or public.has_permission('pharmacy.dispense'))
    )
  ) then
    raise exception 'Stock adjustment permission required';
  end if;

  select * into medicine_row from public.medicines where id = batch_row.medicine_id;
  next_qty := case when movement = 'add_stock' then batch_row.quantity_available + qty else batch_row.quantity_available - qty end;
  if next_qty < 0 then
    raise exception 'Stock cannot go negative';
  end if;

  update public.medicine_stock_batches
  set quantity_available = next_qty,
      status = case when next_qty = 0 then 'depleted' else status end
  where id = batch_row.id
  returning * into batch_row;

  insert into public.stock_movements (clinic_id, branch_id, medicine_id, batch_id, movement_type, quantity, reason, reference_type, reference_id, created_by)
  values (batch_row.clinic_id, batch_row.branch_id, batch_row.medicine_id, batch_row.id, movement, qty, input->>'reason', input->>'reference_type', nullif(input->>'reference_id', '')::uuid, auth.uid());

  perform public.refresh_low_stock_alerts(batch_row.clinic_id, batch_row.branch_id);
  return batch_row;
end;
$$;

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
  all_done boolean;
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
    or (
      public.has_module('pharmacy')
      and (public.has_permission('pharmacy.dispense') or public.has_permission('pharmacy.manage'))
    )
  ) then
    raise exception 'Dispense permission required';
  end if;

  for item_input in select * from jsonb_array_elements(coalesce(input->'items', '[]'::jsonb))
  loop
    select * into order_item
    from public.pharmacy_order_items
    where id = (item_input->>'order_item_id')::uuid
      and pharmacy_order_id = order_row.id
    for update;
    if order_item.id is null then
      raise exception 'Pharmacy order item not found';
    end if;

    dispense_qty := coalesce((item_input->>'quantity')::int, order_item.requested_quantity - order_item.dispensed_quantity);
    if dispense_qty <= 0 then
      raise exception 'Dispense quantity must be greater than zero';
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
    if batch_row.status <> 'active' then
      raise exception 'Stock batch is not active';
    end if;
    if batch_row.expiry_date is not null and batch_row.expiry_date < current_date then
      raise exception 'Expired stock batch cannot be dispensed';
    end if;
    if batch_row.quantity_available < dispense_qty then
      raise exception 'Stock cannot go negative';
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
  ) into all_done;

  update public.pharmacy_orders
  set status = case when all_done then 'dispensed' else 'partially_dispensed' end,
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

revoke all on function public.create_pharmacy_order_from_prescription(uuid) from public;
grant execute on function public.create_pharmacy_order_from_prescription(uuid) to authenticated;
revoke all on function public.dispense_pharmacy_order(jsonb) from public;
grant execute on function public.dispense_pharmacy_order(jsonb) to authenticated;
revoke all on function public.adjust_medicine_stock(jsonb) from public;
grant execute on function public.adjust_medicine_stock(jsonb) to authenticated;
revoke all on function public.refresh_low_stock_alerts(uuid, uuid) from public;
grant execute on function public.refresh_low_stock_alerts(uuid, uuid) to authenticated;
