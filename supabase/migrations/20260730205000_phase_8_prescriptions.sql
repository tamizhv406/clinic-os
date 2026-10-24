create table if not exists public.prescriptions (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  branch_id uuid references public.branches(id) on delete set null,
  consultation_id uuid references public.consultations(id) on delete set null,
  appointment_id uuid references public.appointments(id) on delete set null,
  patient_id uuid not null references public.patients(id) on delete cascade,
  doctor_id uuid not null references public.doctor_profiles(id) on delete cascade,
  diagnosis_summary text,
  advice text,
  follow_up_date date,
  status text default 'draft' check (status in ('draft','finalized','cancelled')),
  delivery_status text default 'queued' check (delivery_status in ('queued','sent','delivered','read','failed')),
  delivery_channel text default 'none' check (delivery_channel in ('none','whatsapp','print','pharmacy')),
  send_to_pharmacy boolean default false,
  pharmacy_status text default 'not_sent' check (pharmacy_status in ('not_sent','sent_to_pharmacy','received','dispensed','cancelled')),
  created_by uuid references public.staff_profiles(id) on delete set null,
  finalized_at timestamptz,
  metadata jsonb default '{}',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.prescription_items (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  prescription_id uuid not null references public.prescriptions(id) on delete cascade,
  medicine_id uuid,
  medicine_name text not null,
  dosage text,
  frequency text,
  timing text,
  duration text,
  food_instruction text check (food_instruction in ('before_food','after_food','with_food','anytime')),
  quantity text,
  instructions text,
  sort_order int default 0,
  reminder_enabled boolean default false,
  reminder_frequency text,
  reminder_start_date date,
  reminder_end_date date,
  metadata jsonb default '{}',
  created_at timestamptz default now()
);

create table if not exists public.prescription_delivery_logs (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  prescription_id uuid not null references public.prescriptions(id) on delete cascade,
  channel text not null check (channel in ('whatsapp','print','pharmacy','manual')),
  old_status text,
  new_status text not null,
  message text,
  changed_by uuid references public.staff_profiles(id) on delete set null,
  created_at timestamptz default now()
);

create table if not exists public.medicine_reminders (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  patient_id uuid not null references public.patients(id) on delete cascade,
  prescription_id uuid not null references public.prescriptions(id) on delete cascade,
  prescription_item_id uuid references public.prescription_items(id) on delete cascade,
  medicine_name text not null,
  dosage text,
  frequency text,
  timing text,
  start_date date not null,
  end_date date,
  next_run_at timestamptz,
  status text default 'active' check (status in ('active','paused','completed','cancelled')),
  delivery_status text default 'queued' check (delivery_status in ('queued','sent','delivered','read','failed')),
  consent_confirmed boolean default false,
  metadata jsonb default '{}',
  created_by uuid references public.staff_profiles(id) on delete set null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_prescriptions_clinic_id on public.prescriptions(clinic_id);
create index if not exists idx_prescriptions_patient_id on public.prescriptions(patient_id);
create index if not exists idx_prescriptions_doctor_id on public.prescriptions(doctor_id);
create index if not exists idx_prescriptions_consultation_id on public.prescriptions(consultation_id);
create index if not exists idx_prescriptions_appointment_id on public.prescriptions(appointment_id);
create index if not exists idx_prescriptions_status on public.prescriptions(status);
create index if not exists idx_prescription_items_prescription_id on public.prescription_items(prescription_id);
create index if not exists idx_prescription_delivery_logs_prescription_id on public.prescription_delivery_logs(prescription_id);
create index if not exists idx_medicine_reminders_patient_id on public.medicine_reminders(patient_id);
create index if not exists idx_medicine_reminders_prescription_id on public.medicine_reminders(prescription_id);
create index if not exists idx_medicine_reminders_status on public.medicine_reminders(status);

drop trigger if exists set_prescriptions_updated_at on public.prescriptions;
create trigger set_prescriptions_updated_at before update on public.prescriptions
for each row execute function public.set_updated_at();

drop trigger if exists set_medicine_reminders_updated_at on public.medicine_reminders;
create trigger set_medicine_reminders_updated_at before update on public.medicine_reminders
for each row execute function public.set_updated_at();

alter table public.prescriptions enable row level security;
alter table public.prescription_items enable row level security;
alter table public.prescription_delivery_logs enable row level security;
alter table public.medicine_reminders enable row level security;

create policy "super_admin_manage_prescriptions" on public.prescriptions
for all to authenticated
using (public.is_super_admin())
with check (public.is_super_admin());

create policy "clinic_staff_view_prescriptions" on public.prescriptions
for select to authenticated
using (
  clinic_id = public.current_clinic_id()
  and (
    public.has_permission('prescriptions.view')
    or public.has_permission('prescriptions.manage')
    or doctor_id in (select id from public.doctor_profiles where staff_id = auth.uid())
    or (
      send_to_pharmacy
      and public.has_module('pharmacy')
      and (
        public.has_permission('pharmacy.view')
        or public.has_permission('pharmacy.dispense')
        or public.has_permission('pharmacy.manage')
      )
    )
  )
);

create policy "clinic_staff_create_prescriptions" on public.prescriptions
for insert to authenticated
with check (
  clinic_id = public.current_clinic_id()
  and (
    public.has_permission('prescriptions.create')
    or public.has_permission('prescriptions.manage')
    or doctor_id in (select id from public.doctor_profiles where staff_id = auth.uid())
  )
  and exists (
    select 1 from public.patients p
    where p.id = patient_id
      and p.clinic_id = clinic_id
  )
);

create policy "clinic_staff_update_prescriptions" on public.prescriptions
for update to authenticated
using (
  clinic_id = public.current_clinic_id()
  and (
    public.has_permission('prescriptions.edit')
    or public.has_permission('prescriptions.manage')
    or doctor_id in (select id from public.doctor_profiles where staff_id = auth.uid())
    or (
      send_to_pharmacy
      and public.has_module('pharmacy')
      and (
        public.has_permission('pharmacy.dispense')
        or public.has_permission('pharmacy.manage')
      )
    )
  )
)
with check (
  clinic_id = public.current_clinic_id()
  and (
    public.has_permission('prescriptions.edit')
    or public.has_permission('prescriptions.manage')
    or doctor_id in (select id from public.doctor_profiles where staff_id = auth.uid())
    or (
      send_to_pharmacy
      and public.has_module('pharmacy')
      and (
        public.has_permission('pharmacy.dispense')
        or public.has_permission('pharmacy.manage')
      )
    )
  )
);

create policy "super_admin_manage_prescription_items" on public.prescription_items
for all to authenticated
using (public.is_super_admin())
with check (public.is_super_admin());

create policy "clinic_staff_view_prescription_items" on public.prescription_items
for select to authenticated
using (
  clinic_id = public.current_clinic_id()
  and exists (
    select 1 from public.prescriptions p
    where p.id = prescription_id
      and (
        public.has_permission('prescriptions.view')
        or public.has_permission('prescriptions.manage')
        or p.doctor_id in (select id from public.doctor_profiles where staff_id = auth.uid())
        or (
          p.send_to_pharmacy
          and public.has_module('pharmacy')
          and (
            public.has_permission('pharmacy.view')
            or public.has_permission('pharmacy.dispense')
            or public.has_permission('pharmacy.manage')
          )
        )
      )
  )
);

create policy "clinic_staff_manage_prescription_items" on public.prescription_items
for all to authenticated
using (
  clinic_id = public.current_clinic_id()
  and exists (
    select 1 from public.prescriptions p
    where p.id = prescription_id
      and (
        public.has_permission('prescriptions.edit')
        or public.has_permission('prescriptions.manage')
        or p.doctor_id in (select id from public.doctor_profiles where staff_id = auth.uid())
      )
  )
)
with check (
  clinic_id = public.current_clinic_id()
  and exists (
    select 1 from public.prescriptions p
    where p.id = prescription_id
      and p.clinic_id = clinic_id
      and (
        public.has_permission('prescriptions.create')
        or public.has_permission('prescriptions.edit')
        or public.has_permission('prescriptions.manage')
        or p.doctor_id in (select id from public.doctor_profiles where staff_id = auth.uid())
      )
  )
);

create policy "super_admin_manage_prescription_delivery_logs" on public.prescription_delivery_logs
for all to authenticated
using (public.is_super_admin())
with check (public.is_super_admin());

create policy "clinic_staff_view_prescription_delivery_logs" on public.prescription_delivery_logs
for select to authenticated
using (
  clinic_id = public.current_clinic_id()
  and exists (
    select 1 from public.prescriptions p
    where p.id = prescription_id
      and (
        public.has_permission('prescriptions.view')
        or public.has_permission('prescriptions.manage')
        or p.doctor_id in (select id from public.doctor_profiles where staff_id = auth.uid())
        or (
          p.send_to_pharmacy
          and public.has_module('pharmacy')
          and (
            public.has_permission('pharmacy.view')
            or public.has_permission('pharmacy.dispense')
            or public.has_permission('pharmacy.manage')
          )
        )
      )
  )
);

create policy "clinic_staff_insert_prescription_delivery_logs" on public.prescription_delivery_logs
for insert to authenticated
with check (
  clinic_id = public.current_clinic_id()
  and exists (
    select 1 from public.prescriptions p
    where p.id = prescription_id
      and p.clinic_id = clinic_id
      and (
        public.has_permission('prescriptions.edit')
        or public.has_permission('prescriptions.manage')
        or p.doctor_id in (select id from public.doctor_profiles where staff_id = auth.uid())
        or (
          p.send_to_pharmacy
          and public.has_module('pharmacy')
          and (
            public.has_permission('pharmacy.dispense')
            or public.has_permission('pharmacy.manage')
          )
        )
      )
  )
);

create policy "super_admin_manage_medicine_reminders" on public.medicine_reminders
for all to authenticated
using (public.is_super_admin())
with check (public.is_super_admin());

create policy "clinic_staff_view_medicine_reminders" on public.medicine_reminders
for select to authenticated
using (
  clinic_id = public.current_clinic_id()
  and (
    public.has_permission('reminders.view')
    or public.has_permission('reminders.manage')
    or public.has_permission('prescriptions.view')
    or exists (
      select 1 from public.prescriptions p
      where p.id = prescription_id
        and p.doctor_id in (select id from public.doctor_profiles where staff_id = auth.uid())
    )
  )
);

create policy "clinic_staff_manage_medicine_reminders" on public.medicine_reminders
for all to authenticated
using (
  clinic_id = public.current_clinic_id()
  and (
    public.has_permission('reminders.configure')
    or public.has_permission('reminders.manage')
    or public.has_permission('prescriptions.edit')
    or public.has_permission('prescriptions.manage')
    or exists (
      select 1 from public.prescriptions p
      where p.id = prescription_id
        and p.doctor_id in (select id from public.doctor_profiles where staff_id = auth.uid())
    )
  )
)
with check (
  clinic_id = public.current_clinic_id()
  and (
    public.has_permission('reminders.configure')
    or public.has_permission('reminders.manage')
    or public.has_permission('prescriptions.edit')
    or public.has_permission('prescriptions.manage')
    or exists (
      select 1 from public.prescriptions p
      where p.id = prescription_id
        and p.doctor_id in (select id from public.doctor_profiles where staff_id = auth.uid())
    )
  )
);

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
    coalesce(input_prescription->>'delivery_channel', 'none'),
    coalesce((input_prescription->>'send_to_pharmacy')::boolean, false),
    coalesce(input_prescription->>'pharmacy_status', 'not_sent'),
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
      nullif(item->>'medicine_id', '')::uuid,
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

  return jsonb_build_object('prescription', to_jsonb(prescription_row), 'items', items_result);
end;
$$;

create or replace function public.update_prescription_delivery_status(prescription_id uuid, new_status text, message text default null)
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
  from public.prescriptions
  where id = prescription_id
  for update;

  if prescription_row.id is null then
    raise exception 'Prescription not found';
  end if;

  if not public.is_super_admin() and prescription_row.clinic_id <> staff_clinic then
    raise exception 'Prescription is outside current clinic';
  end if;

  if not (
    public.is_super_admin()
    or public.has_permission('prescriptions.edit')
    or public.has_permission('prescriptions.manage')
    or prescription_row.doctor_id in (select id from public.doctor_profiles where staff_id = auth.uid())
  ) then
    raise exception 'Prescription delivery update permission required';
  end if;

  old_status_value := prescription_row.delivery_status;

  update public.prescriptions
  set delivery_status = new_status,
      delivery_channel = 'whatsapp'
  where id = prescription_id
  returning * into prescription_row;

  insert into public.prescription_delivery_logs (clinic_id, prescription_id, channel, old_status, new_status, message, changed_by)
  values (prescription_row.clinic_id, prescription_row.id, 'whatsapp', old_status_value, new_status, message, auth.uid());

  return prescription_row;
end;
$$;

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
  from public.prescriptions
  where id = prescription_id
  for update;

  if prescription_row.id is null then
    raise exception 'Prescription not found';
  end if;

  if not public.is_super_admin() and prescription_row.clinic_id <> staff_clinic then
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

  old_status_value := prescription_row.pharmacy_status;

  update public.prescriptions
  set send_to_pharmacy = true,
      pharmacy_status = 'sent_to_pharmacy',
      delivery_channel = 'pharmacy'
  where id = prescription_id
  returning * into prescription_row;

  insert into public.prescription_delivery_logs (clinic_id, prescription_id, channel, old_status, new_status, message, changed_by)
  values (prescription_row.clinic_id, prescription_row.id, 'pharmacy', old_status_value, 'sent_to_pharmacy', 'Prescription routed to pharmacy placeholder', auth.uid());

  return prescription_row;
end;
$$;

revoke all on function public.create_prescription_with_items(jsonb) from public;
grant execute on function public.create_prescription_with_items(jsonb) to authenticated;
revoke all on function public.update_prescription_delivery_status(uuid, text, text) from public;
grant execute on function public.update_prescription_delivery_status(uuid, text, text) to authenticated;
revoke all on function public.route_prescription_to_pharmacy(uuid) from public;
grant execute on function public.route_prescription_to_pharmacy(uuid) to authenticated;
