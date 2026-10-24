-- Phase 15: Feature completion.
-- Adds the tables and anon-facing RPCs that the frontend needs so that every
-- screen can be served from Supabase instead of local mock modules:
--   * clinic_services            -> bookable services (booking flow, billing, reports)
--   * prescription_templates(+items), lab_tests, doctor_favorite_medicines
--                                -> doctor prescription builder
--   * stock_purchases            -> pharmacy purchase entry history
--   * invoice_refunds            -> billing refunds screen
--   * public_* RPCs              -> the public /book/:slug patient booking flow,
--                                   which runs unauthenticated (anon role)
--   * clinic settings update policy -> owner-editable clinic + WhatsApp settings

-- ---------------------------------------------------------------------------
-- 1. Clinic services catalogue
-- ---------------------------------------------------------------------------

create table if not exists public.clinic_services (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  branch_id uuid references public.branches(id) on delete set null,
  name text not null,
  description text,
  department text,
  duration_minutes int not null default 15 check (duration_minutes > 0),
  price numeric(12,2) not null default 0 check (price >= 0),
  tax_rate numeric(5,2) not null default 0 check (tax_rate >= 0),
  is_bookable boolean not null default true,
  sort_order int not null default 0,
  status text not null default 'active' check (status in ('active','inactive','archived')),
  metadata jsonb not null default '{}',
  created_by uuid references public.staff_profiles(id) on delete set null,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (clinic_id, name)
);

create index if not exists idx_clinic_services_clinic_id on public.clinic_services(clinic_id);
create index if not exists idx_clinic_services_status on public.clinic_services(status);

drop trigger if exists set_clinic_services_updated_at on public.clinic_services;
create trigger set_clinic_services_updated_at before update on public.clinic_services
for each row execute function public.set_updated_at();

alter table public.clinic_services enable row level security;

drop policy if exists "super_admin_manage_clinic_services" on public.clinic_services;
create policy "super_admin_manage_clinic_services" on public.clinic_services
for all to authenticated using (public.is_super_admin()) with check (public.is_super_admin());

drop policy if exists "staff_view_clinic_services" on public.clinic_services;
create policy "staff_view_clinic_services" on public.clinic_services
for select to authenticated using (clinic_id = public.current_clinic_id());

drop policy if exists "staff_manage_clinic_services" on public.clinic_services;
create policy "staff_manage_clinic_services" on public.clinic_services
for all to authenticated
using (
  clinic_id = public.current_clinic_id()
  and (public.has_permission('settings.manage') or public.has_permission('settings.configure') or public.has_permission('billing.manage'))
)
with check (
  clinic_id = public.current_clinic_id()
  and (public.has_permission('settings.manage') or public.has_permission('settings.configure') or public.has_permission('billing.manage'))
);

-- ---------------------------------------------------------------------------
-- 2. Doctor prescription authoring aids
-- ---------------------------------------------------------------------------

create table if not exists public.prescription_templates (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  doctor_id uuid references public.doctor_profiles(id) on delete cascade,
  name text not null,
  description text,
  advice text,
  status text not null default 'active' check (status in ('active','inactive')),
  created_by uuid references public.staff_profiles(id) on delete set null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.prescription_template_items (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  template_id uuid not null references public.prescription_templates(id) on delete cascade,
  medicine_id uuid references public.medicines(id) on delete set null,
  medicine_name text not null,
  dosage text,
  frequency text,
  timing text,
  duration text,
  quantity text,
  instructions text,
  sort_order int not null default 0,
  created_at timestamptz default now()
);

create table if not exists public.lab_tests (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  name text not null,
  category text,
  price numeric(12,2) not null default 0 check (price >= 0),
  status text not null default 'active' check (status in ('active','inactive')),
  sort_order int not null default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (clinic_id, name)
);

create table if not exists public.doctor_favorite_medicines (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  doctor_id uuid references public.doctor_profiles(id) on delete cascade,
  medicine_id uuid references public.medicines(id) on delete set null,
  medicine_name text not null,
  default_dosage text,
  default_frequency text,
  default_timing text,
  default_duration text,
  usage_count int not null default 0,
  sort_order int not null default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create unique index if not exists idx_doctor_favorite_medicines_unique
  on public.doctor_favorite_medicines(clinic_id, coalesce(doctor_id, '00000000-0000-0000-0000-000000000000'::uuid), medicine_name);

create index if not exists idx_prescription_templates_clinic_id on public.prescription_templates(clinic_id);
create index if not exists idx_prescription_templates_doctor_id on public.prescription_templates(doctor_id);
create index if not exists idx_prescription_template_items_template_id on public.prescription_template_items(template_id);
create index if not exists idx_lab_tests_clinic_id on public.lab_tests(clinic_id);
create index if not exists idx_doctor_favorite_medicines_clinic_id on public.doctor_favorite_medicines(clinic_id);

drop trigger if exists set_prescription_templates_updated_at on public.prescription_templates;
create trigger set_prescription_templates_updated_at before update on public.prescription_templates
for each row execute function public.set_updated_at();

drop trigger if exists set_lab_tests_updated_at on public.lab_tests;
create trigger set_lab_tests_updated_at before update on public.lab_tests
for each row execute function public.set_updated_at();

drop trigger if exists set_doctor_favorite_medicines_updated_at on public.doctor_favorite_medicines;
create trigger set_doctor_favorite_medicines_updated_at before update on public.doctor_favorite_medicines
for each row execute function public.set_updated_at();

alter table public.prescription_templates enable row level security;
alter table public.prescription_template_items enable row level security;
alter table public.lab_tests enable row level security;
alter table public.doctor_favorite_medicines enable row level security;

drop policy if exists "super_admin_manage_prescription_templates" on public.prescription_templates;
create policy "super_admin_manage_prescription_templates" on public.prescription_templates
for all to authenticated using (public.is_super_admin()) with check (public.is_super_admin());
drop policy if exists "clinic_staff_view_prescription_templates" on public.prescription_templates;
create policy "clinic_staff_view_prescription_templates" on public.prescription_templates
for select to authenticated using (clinic_id = public.current_clinic_id());
drop policy if exists "clinic_staff_manage_prescription_templates" on public.prescription_templates;
create policy "clinic_staff_manage_prescription_templates" on public.prescription_templates
for all to authenticated
using (clinic_id = public.current_clinic_id() and (public.has_permission('prescriptions.create') or public.has_permission('prescriptions.edit') or public.has_permission('prescriptions.manage')))
with check (clinic_id = public.current_clinic_id() and (public.has_permission('prescriptions.create') or public.has_permission('prescriptions.edit') or public.has_permission('prescriptions.manage')));

drop policy if exists "super_admin_manage_prescription_template_items" on public.prescription_template_items;
create policy "super_admin_manage_prescription_template_items" on public.prescription_template_items
for all to authenticated using (public.is_super_admin()) with check (public.is_super_admin());
drop policy if exists "clinic_staff_view_prescription_template_items" on public.prescription_template_items;
create policy "clinic_staff_view_prescription_template_items" on public.prescription_template_items
for select to authenticated using (clinic_id = public.current_clinic_id());
drop policy if exists "clinic_staff_manage_prescription_template_items" on public.prescription_template_items;
create policy "clinic_staff_manage_prescription_template_items" on public.prescription_template_items
for all to authenticated
using (clinic_id = public.current_clinic_id() and (public.has_permission('prescriptions.create') or public.has_permission('prescriptions.edit') or public.has_permission('prescriptions.manage')))
with check (clinic_id = public.current_clinic_id() and (public.has_permission('prescriptions.create') or public.has_permission('prescriptions.edit') or public.has_permission('prescriptions.manage')));

drop policy if exists "super_admin_manage_lab_tests" on public.lab_tests;
create policy "super_admin_manage_lab_tests" on public.lab_tests
for all to authenticated using (public.is_super_admin()) with check (public.is_super_admin());
drop policy if exists "clinic_staff_view_lab_tests" on public.lab_tests;
create policy "clinic_staff_view_lab_tests" on public.lab_tests
for select to authenticated using (clinic_id = public.current_clinic_id());
drop policy if exists "clinic_staff_manage_lab_tests" on public.lab_tests;
create policy "clinic_staff_manage_lab_tests" on public.lab_tests
for all to authenticated
using (clinic_id = public.current_clinic_id() and (public.has_permission('consultation.manage') or public.has_permission('prescriptions.manage') or public.has_permission('settings.manage')))
with check (clinic_id = public.current_clinic_id() and (public.has_permission('consultation.manage') or public.has_permission('prescriptions.manage') or public.has_permission('settings.manage')));

drop policy if exists "super_admin_manage_doctor_favorite_medicines" on public.doctor_favorite_medicines;
create policy "super_admin_manage_doctor_favorite_medicines" on public.doctor_favorite_medicines
for all to authenticated using (public.is_super_admin()) with check (public.is_super_admin());
drop policy if exists "clinic_staff_view_doctor_favorite_medicines" on public.doctor_favorite_medicines;
create policy "clinic_staff_view_doctor_favorite_medicines" on public.doctor_favorite_medicines
for select to authenticated using (clinic_id = public.current_clinic_id());
drop policy if exists "clinic_staff_manage_doctor_favorite_medicines" on public.doctor_favorite_medicines;
create policy "clinic_staff_manage_doctor_favorite_medicines" on public.doctor_favorite_medicines
for all to authenticated
using (clinic_id = public.current_clinic_id() and (public.has_permission('prescriptions.create') or public.has_permission('prescriptions.edit') or public.has_permission('prescriptions.manage')))
with check (clinic_id = public.current_clinic_id() and (public.has_permission('prescriptions.create') or public.has_permission('prescriptions.edit') or public.has_permission('prescriptions.manage')));

-- ---------------------------------------------------------------------------
-- 3. Pharmacy purchase entries
-- ---------------------------------------------------------------------------

create table if not exists public.stock_purchases (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  branch_id uuid references public.branches(id) on delete set null,
  supplier_name text not null,
  supplier_phone text,
  invoice_number text not null,
  purchase_date date not null default current_date,
  total_amount numeric(12,2) not null default 0 check (total_amount >= 0),
  notes text,
  status text not null default 'saved' check (status in ('draft','saved','cancelled')),
  created_by uuid references public.staff_profiles(id) on delete set null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_stock_purchases_clinic_id on public.stock_purchases(clinic_id);
create index if not exists idx_stock_purchases_purchase_date on public.stock_purchases(purchase_date);

alter table public.medicine_stock_batches
  add column if not exists purchase_id uuid references public.stock_purchases(id) on delete set null;
alter table public.medicine_stock_batches
  add column if not exists mrp numeric(12,2) default 0;

create index if not exists idx_medicine_stock_batches_purchase_id on public.medicine_stock_batches(purchase_id);

drop trigger if exists set_stock_purchases_updated_at on public.stock_purchases;
create trigger set_stock_purchases_updated_at before update on public.stock_purchases
for each row execute function public.set_updated_at();

alter table public.stock_purchases enable row level security;

drop policy if exists "super_admin_manage_stock_purchases" on public.stock_purchases;
create policy "super_admin_manage_stock_purchases" on public.stock_purchases
for all to authenticated using (public.is_super_admin()) with check (public.is_super_admin());
drop policy if exists "pharmacy_staff_view_stock_purchases" on public.stock_purchases;
create policy "pharmacy_staff_view_stock_purchases" on public.stock_purchases
for select to authenticated using (clinic_id = public.current_clinic_id() and public.has_module('pharmacy'));
drop policy if exists "pharmacy_staff_manage_stock_purchases" on public.stock_purchases;
create policy "pharmacy_staff_manage_stock_purchases" on public.stock_purchases
for all to authenticated
using (clinic_id = public.current_clinic_id() and public.has_module('pharmacy') and (public.has_permission('pharmacy.create') or public.has_permission('pharmacy.edit') or public.has_permission('pharmacy.manage')))
with check (clinic_id = public.current_clinic_id() and public.has_module('pharmacy') and (public.has_permission('pharmacy.create') or public.has_permission('pharmacy.edit') or public.has_permission('pharmacy.manage')));

-- ---------------------------------------------------------------------------
-- 4. Invoice refunds
-- ---------------------------------------------------------------------------

create table if not exists public.invoice_refunds (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  branch_id uuid references public.branches(id) on delete set null,
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  patient_id uuid not null references public.patients(id) on delete cascade,
  original_amount numeric(12,2) not null default 0 check (original_amount >= 0),
  refund_amount numeric(12,2) not null default 0 check (refund_amount >= 0),
  refund_mode text not null default 'cash' check (refund_mode in ('cash','upi','card','online_link')),
  reason text not null,
  status text not null default 'requested' check (status in ('requested','approved','processed','rejected')),
  requested_by uuid references public.staff_profiles(id) on delete set null,
  approved_by uuid references public.staff_profiles(id) on delete set null,
  processed_at timestamptz,
  metadata jsonb not null default '{}',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_invoice_refunds_clinic_id on public.invoice_refunds(clinic_id);
create index if not exists idx_invoice_refunds_invoice_id on public.invoice_refunds(invoice_id);
create index if not exists idx_invoice_refunds_status on public.invoice_refunds(status);

drop trigger if exists set_invoice_refunds_updated_at on public.invoice_refunds;
create trigger set_invoice_refunds_updated_at before update on public.invoice_refunds
for each row execute function public.set_updated_at();

alter table public.invoice_refunds enable row level security;

drop policy if exists "super_admin_manage_invoice_refunds" on public.invoice_refunds;
create policy "super_admin_manage_invoice_refunds" on public.invoice_refunds
for all to authenticated using (public.is_super_admin()) with check (public.is_super_admin());
drop policy if exists "billing_staff_view_invoice_refunds" on public.invoice_refunds;
create policy "billing_staff_view_invoice_refunds" on public.invoice_refunds
for select to authenticated using (clinic_id = public.current_clinic_id() and (public.has_permission('billing.view') or public.has_permission('billing.manage')));
drop policy if exists "billing_staff_manage_invoice_refunds" on public.invoice_refunds;
create policy "billing_staff_manage_invoice_refunds" on public.invoice_refunds
for all to authenticated
using (clinic_id = public.current_clinic_id() and (public.has_permission('billing.edit') or public.has_permission('billing.manage') or public.has_permission('billing.approve')))
with check (clinic_id = public.current_clinic_id() and (public.has_permission('billing.edit') or public.has_permission('billing.manage') or public.has_permission('billing.approve')));

-- ---------------------------------------------------------------------------
-- 4b. Support tickets (platform "support" module)
-- ---------------------------------------------------------------------------

create table if not exists public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid references public.clinics(id) on delete cascade,
  subject text not null,
  description text,
  category text not null default 'general',
  priority text not null default 'normal' check (priority in ('low','normal','high','urgent')),
  status text not null default 'open' check (status in ('open','in_progress','resolved','closed')),
  raised_by uuid references public.staff_profiles(id) on delete set null,
  assigned_to uuid references public.staff_profiles(id) on delete set null,
  resolved_at timestamptz,
  metadata jsonb not null default '{}',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_support_tickets_clinic_id on public.support_tickets(clinic_id);
create index if not exists idx_support_tickets_status on public.support_tickets(status);

drop trigger if exists set_support_tickets_updated_at on public.support_tickets;
create trigger set_support_tickets_updated_at before update on public.support_tickets
for each row execute function public.set_updated_at();

alter table public.support_tickets enable row level security;

drop policy if exists "super_admin_manage_support_tickets" on public.support_tickets;
create policy "super_admin_manage_support_tickets" on public.support_tickets
for all to authenticated using (public.is_super_admin()) with check (public.is_super_admin());
drop policy if exists "clinic_staff_view_support_tickets" on public.support_tickets;
create policy "clinic_staff_view_support_tickets" on public.support_tickets
for select to authenticated using (clinic_id = public.current_clinic_id());
drop policy if exists "clinic_staff_create_support_tickets" on public.support_tickets;
create policy "clinic_staff_create_support_tickets" on public.support_tickets
for insert to authenticated with check (clinic_id = public.current_clinic_id() and coalesce(raised_by, auth.uid()) = auth.uid());

-- ---------------------------------------------------------------------------
-- 5. Owner-editable clinic record (clinic profile + WhatsApp settings)
-- ---------------------------------------------------------------------------

drop policy if exists "clinic_admin_update_own_clinic" on public.clinics;
create policy "clinic_admin_update_own_clinic" on public.clinics
for update to authenticated
using (id = public.current_clinic_id() and (public.has_permission('settings.configure') or public.has_permission('settings.manage')))
with check (id = public.current_clinic_id() and (public.has_permission('settings.configure') or public.has_permission('settings.manage')));

-- ---------------------------------------------------------------------------
-- 6. Token numbers
-- ---------------------------------------------------------------------------

create or replace function public.next_token_number(target_clinic_id uuid, target_date date)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  next_value int;
begin
  select coalesce(max(nullif(regexp_replace(token_number, '^[A-Z]', ''), '')::int), 0) + 1
  into next_value
  from public.appointments
  where clinic_id = target_clinic_id
    and appointment_date = target_date
    and token_number ~ '^[A-Z][0-9]+$';

  return 'A' || lpad(next_value::text, 3, '0');
end;
$$;

revoke all on function public.next_token_number(uuid, date) from public;
grant execute on function public.next_token_number(uuid, date) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 7. Slot materialisation shared by staff and public booking
-- ---------------------------------------------------------------------------

create or replace function public.ensure_doctor_slots(p_doctor_id uuid, p_date date)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  profile public.doctor_profiles;
  availability public.doctor_availability;
  slot_minutes int;
  cursor_minutes int;
  finish_minutes int;
  break_start_minutes int;
  break_end_minutes int;
begin
  select * into profile from public.doctor_profiles where id = p_doctor_id and status = 'active';
  if profile.id is null then
    return;
  end if;

  if exists (select 1 from public.doctor_blocked_dates where doctor_id = p_doctor_id and blocked_date = p_date) then
    return;
  end if;

  slot_minutes := coalesce(profile.slot_duration_minutes, 15);

  for availability in
    select * from public.doctor_availability
    where doctor_id = p_doctor_id
      and is_active
      and day_of_week = extract(dow from p_date)::int
  loop
    cursor_minutes := extract(epoch from availability.start_time)::int / 60;
    finish_minutes := extract(epoch from availability.end_time)::int / 60;
    break_start_minutes := case when availability.break_start is null then null else extract(epoch from availability.break_start)::int / 60 end;
    break_end_minutes := case when availability.break_end is null then null else extract(epoch from availability.break_end)::int / 60 end;

    while cursor_minutes + slot_minutes <= finish_minutes loop
      if break_start_minutes is null
         or break_end_minutes is null
         or cursor_minutes < break_start_minutes
         or cursor_minutes >= break_end_minutes then
        insert into public.appointment_slots (clinic_id, branch_id, doctor_id, slot_date, start_time, end_time, capacity, booked_count, status)
        values (
          profile.clinic_id,
          coalesce(availability.branch_id, profile.branch_id),
          p_doctor_id,
          p_date,
          make_interval(mins => cursor_minutes)::time,
          make_interval(mins => cursor_minutes + slot_minutes)::time,
          coalesce(profile.max_appointments_per_slot, 1),
          0,
          'available'
        )
        on conflict (doctor_id, slot_date, start_time) do nothing;
      end if;
      cursor_minutes := cursor_minutes + slot_minutes;
    end loop;
  end loop;
end;
$$;

revoke all on function public.ensure_doctor_slots(uuid, date) from public;
grant execute on function public.ensure_doctor_slots(uuid, date) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 8. Public (anon) booking API
--    Every function below is security definer and deliberately returns only
--    the fields a prospective patient is allowed to see.
-- ---------------------------------------------------------------------------

create or replace function public.public_clinic_booking_profile(clinic_slug text)
returns jsonb
language sql
security definer
set search_path = public
stable
as $$
  select jsonb_build_object(
    'id', c.id,
    'slug', c.slug,
    'name', c.name,
    'specialization', coalesce(c.specialty, ''),
    'address', coalesce(c.address, ''),
    'phone', coalesce(c.phone, ''),
    'whatsapp', coalesce(c.whatsapp_number, c.phone, ''),
    'logoUrl', coalesce(c.logo_url, ''),
    'hours', coalesce(c.settings->>'booking_hours', ''),
    'mapUrl', coalesce(c.settings->>'map_url', ''),
    'bookingUrl', 'vernex.in/book/' || c.slug
  )
  from public.clinics c
  where c.slug = btrim(clinic_slug)
    and c.status in ('trial', 'active')
  limit 1
$$;

create or replace function public.public_clinic_doctors(clinic_slug text)
returns jsonb
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(jsonb_agg(doctor order by doctor->>'name'), '[]'::jsonb)
  from (
    select jsonb_build_object(
      'id', dp.id,
      'name', sp.full_name,
      'specialization', coalesce(nullif(dp.specialization, ''), dp.department, 'General'),
      'department', coalesce(dp.department, 'general_medicine'),
      'qualification', coalesce(dp.qualification, ''),
      'experience', coalesce((sp.metadata->>'experience_years')::int, 0),
      'consultationFee', coalesce(dp.consultation_fee, 0),
      'availableToday', exists (
        select 1 from public.doctor_availability da
        where da.doctor_id = dp.id
          and da.is_active
          and da.day_of_week = extract(dow from current_date)::int
      ) and not exists (
        select 1 from public.doctor_blocked_dates bd
        where bd.doctor_id = dp.id and bd.blocked_date = current_date
      )
    ) as doctor
    from public.doctor_profiles dp
    join public.clinics c on c.id = dp.clinic_id
    join public.staff_profiles sp on sp.id = dp.staff_id
    where c.slug = btrim(clinic_slug)
      and c.status in ('trial', 'active')
      and dp.status = 'active'
      and sp.status = 'active'
  ) doctors
$$;

create or replace function public.public_clinic_services(clinic_slug text)
returns jsonb
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(jsonb_agg(service order by (service->>'sortOrder')::int, service->>'name'), '[]'::jsonb)
  from (
    select jsonb_build_object(
      'id', s.id,
      'name', s.name,
      'description', coalesce(s.description, ''),
      'department', coalesce(s.department, ''),
      'duration', s.duration_minutes || ' min',
      'durationMinutes', s.duration_minutes,
      'price', s.price,
      'sortOrder', s.sort_order
    ) as service
    from public.clinic_services s
    join public.clinics c on c.id = s.clinic_id
    where c.slug = btrim(clinic_slug)
      and c.status in ('trial', 'active')
      and s.status = 'active'
      and s.is_bookable
  ) services
$$;

create or replace function public.public_doctor_available_dates(p_doctor_id uuid, p_days int default 14)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  result jsonb := '[]'::jsonb;
  day_offset int;
  target date;
  has_availability boolean;
  is_blocked boolean;
begin
  for day_offset in 0 .. greatest(coalesce(p_days, 14), 1) - 1 loop
    target := current_date + day_offset;

    select exists (
      select 1 from public.doctor_availability da
      where da.doctor_id = p_doctor_id
        and da.is_active
        and da.day_of_week = extract(dow from target)::int
    ) into has_availability;

    if not has_availability then
      continue;
    end if;

    select exists (
      select 1 from public.doctor_blocked_dates bd
      where bd.doctor_id = p_doctor_id and bd.blocked_date = target
    ) into is_blocked;

    result := result || jsonb_build_array(jsonb_build_object(
      'id', target::text,
      'date', target::text,
      'label', to_char(target, 'Dy, DD Mon'),
      'available', not is_blocked
    ));
  end loop;

  return result;
end;
$$;

create or replace function public.public_doctor_available_slots(p_doctor_id uuid, p_date date)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  result jsonb;
begin
  perform public.ensure_doctor_slots(p_doctor_id, p_date);

  select coalesce(jsonb_agg(slot order by slot->>'startTime'), '[]'::jsonb)
  into result
  from (
    select jsonb_build_object(
      'id', s.id,
      'startTime', s.start_time::text,
      'label', to_char(s.start_time, 'HH12:MI AM'),
      'period', case
        when s.start_time < time '12:00' then 'morning'
        when s.start_time < time '17:00' then 'afternoon'
        else 'evening'
      end,
      'status', case
        when s.status <> 'available' or s.booked_count >= s.capacity then 'booked'
        when s.capacity - s.booked_count = 1 and s.capacity > 1 then 'limited'
        else 'available'
      end
    ) as slot
    from public.appointment_slots s
    where s.doctor_id = p_doctor_id
      and s.slot_date = p_date
  ) slots;

  return result;
end;
$$;

create or replace function public.public_create_booking(input jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  clinic_row public.clinics;
  slot_row public.appointment_slots;
  doctor_row public.doctor_profiles;
  doctor_name text;
  service_row public.clinic_services;
  patient_row public.patients;
  appointment_row public.appointments;
  patient_input jsonb := coalesce(input->'patient', '{}'::jsonb);
  patient_phone text := btrim(coalesce(patient_input->>'phone', ''));
  patient_name text := btrim(coalesce(patient_input->>'full_name', ''));
  token text;
begin
  if patient_phone = '' or patient_name = '' then
    raise exception 'Patient name and phone are required';
  end if;

  select * into clinic_row
  from public.clinics
  where slug = btrim(coalesce(input->>'clinic_slug', ''))
    and status in ('trial', 'active');
  if clinic_row.id is null then
    raise exception 'Clinic not found or not accepting bookings';
  end if;

  select * into slot_row
  from public.appointment_slots
  where id = nullif(input->>'slot_id', '')::uuid
  for update;

  if slot_row.id is null then
    raise exception 'Selected time slot is no longer available';
  end if;
  if slot_row.clinic_id <> clinic_row.id then
    raise exception 'Selected slot does not belong to this clinic';
  end if;
  if slot_row.status <> 'available' or slot_row.booked_count >= slot_row.capacity then
    raise exception 'Selected time slot is already booked';
  end if;

  select * into doctor_row from public.doctor_profiles where id = slot_row.doctor_id;
  select full_name into doctor_name from public.staff_profiles where id = doctor_row.staff_id;

  if nullif(input->>'service_id', '') is not null then
    select * into service_row
    from public.clinic_services
    where id = (input->>'service_id')::uuid and clinic_id = clinic_row.id;
  end if;

  select * into patient_row
  from public.patients
  where clinic_id = clinic_row.id
    and phone = patient_phone
  order by created_at asc
  limit 1;

  if patient_row.id is null then
    insert into public.patients (
      clinic_id, branch_id, full_name, phone, whatsapp_number, age, gender,
      source, whatsapp_consent, status, metadata
    )
    values (
      clinic_row.id,
      slot_row.branch_id,
      patient_name,
      patient_phone,
      patient_phone,
      nullif(patient_input->>'age', '')::int,
      nullif(patient_input->>'gender', ''),
      coalesce(nullif(input->>'source', ''), 'website'),
      true,
      'active',
      jsonb_build_object('created_via', 'public_booking')
    )
    returning * into patient_row;
  end if;

  token := public.next_token_number(clinic_row.id, slot_row.slot_date);

  insert into public.appointments (
    clinic_id, branch_id, patient_id, doctor_id, slot_id, token_number,
    appointment_date, appointment_time, department, main_problem, source,
    status, is_new_patient, metadata
  )
  values (
    clinic_row.id,
    slot_row.branch_id,
    patient_row.id,
    slot_row.doctor_id,
    slot_row.id,
    token,
    slot_row.slot_date,
    slot_row.start_time,
    coalesce(service_row.department, doctor_row.department),
    nullif(patient_input->>'reason', ''),
    coalesce(nullif(input->>'source', ''), 'website'),
    'booked',
    patient_row.created_at > now() - interval '1 minute',
    jsonb_build_object(
      'service_id', input->>'service_id',
      'service_name', service_row.name,
      'payment_option', coalesce(input->>'payment_option', 'pay_at_clinic'),
      'notes', patient_input->>'notes'
    )
  )
  returning * into appointment_row;

  update public.appointment_slots
  set booked_count = booked_count + 1,
      status = case when booked_count + 1 >= capacity then 'full' else status end
  where id = slot_row.id;

  insert into public.appointment_status_history (clinic_id, appointment_id, old_status, new_status, reason)
  values (clinic_row.id, appointment_row.id, null, 'booked', 'public_booking_created');

  return jsonb_build_object(
    'bookingId', appointment_row.id,
    'token', appointment_row.token_number,
    'status', appointment_row.status,
    'clinicName', clinic_row.name,
    'clinicSlug', clinic_row.slug,
    'doctorName', coalesce(doctor_name, 'Doctor'),
    'serviceName', coalesce(service_row.name, ''),
    'patientName', patient_row.full_name,
    'appointmentDate', appointment_row.appointment_date::text,
    'appointmentTime', to_char(appointment_row.appointment_time, 'HH12:MI AM'),
    'dateTime', to_char(appointment_row.appointment_date, 'DD Mon YYYY') || ' - ' || to_char(appointment_row.appointment_time, 'HH12:MI AM')
  );
end;
$$;

create or replace function public.public_booking_status(p_phone text, p_reference text)
returns jsonb
language sql
security definer
set search_path = public
stable
as $$
  select jsonb_build_object(
    'bookingId', a.id,
    'token', coalesce(a.token_number, ''),
    'status', case when a.status in ('booked','confirmed') then 'confirmed'
                   when a.status = 'cancelled' then 'cancelled'
                   when a.status = 'completed' then 'completed'
                   else 'pending' end,
    'clinicName', c.name,
    'doctorName', coalesce(sp.full_name, 'To be assigned'),
    'patientName', p.full_name,
    'dateTime', to_char(a.appointment_date, 'DD Mon YYYY') || ' - ' || coalesce(to_char(a.appointment_time, 'HH12:MI AM'), 'Time to be confirmed')
  )
  from public.appointments a
  join public.clinics c on c.id = a.clinic_id
  join public.patients p on p.id = a.patient_id
  left join public.doctor_profiles dp on dp.id = a.doctor_id
  left join public.staff_profiles sp on sp.id = dp.staff_id
  where p.phone = btrim(p_phone)
    and (a.token_number = btrim(p_reference) or a.id::text = btrim(p_reference))
  order by a.created_at desc
  limit 1
$$;

revoke all on function public.public_clinic_booking_profile(text) from public;
revoke all on function public.public_clinic_doctors(text) from public;
revoke all on function public.public_clinic_services(text) from public;
revoke all on function public.public_doctor_available_dates(uuid, int) from public;
revoke all on function public.public_doctor_available_slots(uuid, date) from public;
revoke all on function public.public_create_booking(jsonb) from public;
revoke all on function public.public_booking_status(text, text) from public;

grant execute on function public.public_clinic_booking_profile(text) to anon, authenticated;
grant execute on function public.public_clinic_doctors(text) to anon, authenticated;
grant execute on function public.public_clinic_services(text) to anon, authenticated;
grant execute on function public.public_doctor_available_dates(uuid, int) to anon, authenticated;
grant execute on function public.public_doctor_available_slots(uuid, date) to anon, authenticated;
grant execute on function public.public_create_booking(jsonb) to anon, authenticated;
grant execute on function public.public_booking_status(text, text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 9. Staff-side helper: book an appointment straight from a date/time
--    (reception + WhatsApp booking screens) without pre-selecting a slot id.
-- ---------------------------------------------------------------------------

create or replace function public.book_appointment_for_patient(input jsonb)
returns public.appointments
language plpgsql
security definer
set search_path = public
as $$
declare
  staff_row public.staff_profiles;
  slot_row public.appointment_slots;
  appointment_row public.appointments;
  target_date date := (input->>'appointment_date')::date;
  target_doctor uuid := (input->>'doctor_id')::uuid;
  token text;
begin
  select * into staff_row from public.staff_profiles where id = auth.uid() and status = 'active';
  if staff_row.id is null and not public.is_super_admin() then
    raise exception 'Active staff profile required';
  end if;

  if nullif(input->>'slot_id', '') is not null then
    select * into slot_row from public.appointment_slots where id = (input->>'slot_id')::uuid for update;
  elsif target_doctor is not null then
    perform public.ensure_doctor_slots(target_doctor, target_date);
    select * into slot_row
    from public.appointment_slots
    where doctor_id = target_doctor
      and slot_date = target_date
      and status = 'available'
      and booked_count < capacity
      and (nullif(input->>'appointment_time', '') is null or start_time = (input->>'appointment_time')::time)
    order by start_time
    limit 1
    for update;
  end if;

  if slot_row.id is null then
    raise exception 'No available slot found for the selected doctor and time';
  end if;

  if not public.is_super_admin() and slot_row.clinic_id <> staff_row.clinic_id then
    raise exception 'Slot is outside current clinic';
  end if;

  token := coalesce(nullif(input->>'token_number', ''), public.next_token_number(slot_row.clinic_id, slot_row.slot_date));

  insert into public.appointments (
    clinic_id, branch_id, patient_id, doctor_id, slot_id, token_number,
    appointment_date, appointment_time, department, main_problem, source,
    status, is_new_patient, created_by, assigned_by, metadata
  )
  values (
    slot_row.clinic_id,
    coalesce(nullif(input->>'branch_id', '')::uuid, slot_row.branch_id),
    (input->>'patient_id')::uuid,
    slot_row.doctor_id,
    slot_row.id,
    token,
    slot_row.slot_date,
    slot_row.start_time,
    input->>'department',
    input->>'main_problem',
    coalesce(nullif(input->>'source', ''), 'reception'),
    coalesce(nullif(input->>'status', ''), 'booked'),
    coalesce((input->>'is_new_patient')::boolean, false),
    auth.uid(),
    auth.uid(),
    coalesce(input->'metadata', '{}'::jsonb)
  )
  returning * into appointment_row;

  update public.appointment_slots
  set booked_count = booked_count + 1,
      status = case when booked_count + 1 >= capacity then 'full' else status end
  where id = slot_row.id;

  insert into public.appointment_status_history (clinic_id, appointment_id, old_status, new_status, changed_by, reason)
  values (appointment_row.clinic_id, appointment_row.id, null, appointment_row.status, auth.uid(), 'appointment_created');

  return appointment_row;
end;
$$;

revoke all on function public.book_appointment_for_patient(jsonb) from public;
grant execute on function public.book_appointment_for_patient(jsonb) to authenticated;
