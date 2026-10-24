create table if not exists public.doctor_profiles (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  branch_id uuid references public.branches(id) on delete set null,
  staff_id uuid not null references public.staff_profiles(id) on delete cascade,
  department text,
  specialization text,
  qualification text,
  consultation_fee numeric(10,2) default 0,
  slot_duration_minutes int default 15,
  max_appointments_per_slot int default 1,
  status text default 'active' check (status in ('active','inactive')),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(staff_id)
);

create table if not exists public.doctor_availability (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  branch_id uuid references public.branches(id) on delete set null,
  doctor_id uuid not null references public.doctor_profiles(id) on delete cascade,
  day_of_week int check(day_of_week between 0 and 6),
  start_time time not null,
  end_time time not null,
  break_start time,
  break_end time,
  is_active boolean default true,
  created_at timestamptz default now()
);

create table if not exists public.doctor_blocked_dates (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  doctor_id uuid not null references public.doctor_profiles(id) on delete cascade,
  blocked_date date not null,
  reason text,
  created_by uuid references public.staff_profiles(id) on delete set null,
  created_at timestamptz default now(),
  unique(doctor_id, blocked_date)
);

create table if not exists public.appointment_slots (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  branch_id uuid references public.branches(id) on delete set null,
  doctor_id uuid not null references public.doctor_profiles(id) on delete cascade,
  slot_date date not null,
  start_time time not null,
  end_time time not null,
  capacity int default 1,
  booked_count int default 0,
  status text default 'available' check (status in ('available','full','blocked','cancelled')),
  created_at timestamptz default now(),
  unique(doctor_id, slot_date, start_time)
);

create table if not exists public.appointments (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  branch_id uuid references public.branches(id) on delete set null,
  patient_id uuid not null references public.patients(id) on delete cascade,
  doctor_id uuid references public.doctor_profiles(id) on delete set null,
  slot_id uuid references public.appointment_slots(id) on delete set null,
  token_number text,
  appointment_date date not null,
  appointment_time time,
  department text,
  main_problem text,
  source text default 'reception' check (source in ('whatsapp','qr','website','phone','walk_in','reception')),
  status text default 'booked' check (status in ('requested','booked','confirmed','arrived','waiting','in_consultation','completed','cancelled','no_show')),
  is_new_patient boolean default false,
  created_by uuid references public.staff_profiles(id) on delete set null,
  assigned_by uuid references public.staff_profiles(id) on delete set null,
  cancelled_reason text,
  metadata jsonb default '{}',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.appointment_status_history (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  appointment_id uuid not null references public.appointments(id) on delete cascade,
  old_status text,
  new_status text not null,
  changed_by uuid references public.staff_profiles(id) on delete set null,
  reason text,
  created_at timestamptz default now()
);

create index if not exists idx_doctor_profiles_clinic_id on public.doctor_profiles(clinic_id);
create index if not exists idx_doctor_profiles_staff_id on public.doctor_profiles(staff_id);
create index if not exists idx_doctor_availability_clinic_doctor on public.doctor_availability(clinic_id, doctor_id);
create index if not exists idx_appointment_slots_clinic_doctor_date on public.appointment_slots(clinic_id, doctor_id, slot_date);
create index if not exists idx_appointments_clinic_id on public.appointments(clinic_id);
create index if not exists idx_appointments_branch_id on public.appointments(branch_id);
create index if not exists idx_appointments_patient_id on public.appointments(patient_id);
create index if not exists idx_appointments_doctor_id on public.appointments(doctor_id);
create index if not exists idx_appointments_appointment_date on public.appointments(appointment_date);
create index if not exists idx_appointments_status on public.appointments(status);
create index if not exists idx_appointment_status_history_appointment_id on public.appointment_status_history(appointment_id);

drop trigger if exists set_doctor_profiles_updated_at on public.doctor_profiles;
create trigger set_doctor_profiles_updated_at before update on public.doctor_profiles
for each row execute function public.set_updated_at();

drop trigger if exists set_appointments_updated_at on public.appointments;
create trigger set_appointments_updated_at before update on public.appointments
for each row execute function public.set_updated_at();

create or replace function public.create_appointment_with_slot(input jsonb)
returns public.appointments
language plpgsql
security definer
set search_path = public
as $$
declare
  slot_row public.appointment_slots;
  appointment_row public.appointments;
  staff_row public.staff_profiles;
begin
  select * into staff_row from public.staff_profiles where id = auth.uid() and status = 'active';
  if staff_row.id is null and not public.is_super_admin() then
    raise exception 'Active staff profile required';
  end if;

  select * into slot_row
  from public.appointment_slots
  where id = (input->>'slot_id')::uuid
  for update;

  if slot_row.id is null then
    raise exception 'Appointment slot not found';
  end if;

  if not public.is_super_admin() and slot_row.clinic_id <> staff_row.clinic_id then
    raise exception 'Slot is outside current clinic';
  end if;

  if slot_row.status <> 'available' or slot_row.booked_count >= slot_row.capacity then
    raise exception 'Appointment slot is not available';
  end if;

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
    input->>'token_number',
    slot_row.slot_date,
    slot_row.start_time,
    input->>'department',
    input->>'main_problem',
    coalesce(input->>'source', 'reception'),
    coalesce(input->>'status', 'booked'),
    coalesce((input->>'is_new_patient')::boolean, false),
    auth.uid(),
    auth.uid(),
    coalesce(input->'metadata', '{}')
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

create or replace function public.update_appointment_status(appointment_id uuid, new_status text, reason text default null)
returns public.appointments
language plpgsql
security definer
set search_path = public
as $$
declare
  appointment_row public.appointments;
  old_status_value text;
  staff_clinic uuid;
begin
  select clinic_id into staff_clinic from public.staff_profiles where id = auth.uid() and status = 'active';

  select * into appointment_row
  from public.appointments
  where id = appointment_id
  for update;

  if appointment_row.id is null then
    raise exception 'Appointment not found';
  end if;

  if not public.is_super_admin() and appointment_row.clinic_id <> staff_clinic then
    raise exception 'Appointment is outside current clinic';
  end if;

  old_status_value := appointment_row.status;

  update public.appointments
  set status = new_status,
      cancelled_reason = case when new_status = 'cancelled' then reason else cancelled_reason end
  where id = appointment_id
  returning * into appointment_row;

  insert into public.appointment_status_history (clinic_id, appointment_id, old_status, new_status, changed_by, reason)
  values (appointment_row.clinic_id, appointment_row.id, old_status_value, new_status, auth.uid(), reason);

  return appointment_row;
end;
$$;

alter table public.doctor_profiles enable row level security;
alter table public.doctor_availability enable row level security;
alter table public.doctor_blocked_dates enable row level security;
alter table public.appointment_slots enable row level security;
alter table public.appointments enable row level security;
alter table public.appointment_status_history enable row level security;

create policy "super_admin_manage_doctor_profiles" on public.doctor_profiles for all to authenticated using (public.is_super_admin()) with check (public.is_super_admin());
create policy "staff_view_own_clinic_doctor_profiles" on public.doctor_profiles for select to authenticated using (clinic_id = public.current_clinic_id());
create policy "staff_manage_own_clinic_doctor_profiles" on public.doctor_profiles for all to authenticated using (clinic_id = public.current_clinic_id() and public.has_permission('availability.configure')) with check (clinic_id = public.current_clinic_id() and public.has_permission('availability.configure'));

create policy "super_admin_manage_doctor_availability" on public.doctor_availability for all to authenticated using (public.is_super_admin()) with check (public.is_super_admin());
create policy "staff_view_own_clinic_doctor_availability" on public.doctor_availability for select to authenticated using (clinic_id = public.current_clinic_id());
create policy "staff_manage_own_clinic_doctor_availability" on public.doctor_availability for all to authenticated using (clinic_id = public.current_clinic_id() and public.has_permission('availability.configure')) with check (clinic_id = public.current_clinic_id() and public.has_permission('availability.configure'));

create policy "super_admin_manage_doctor_blocked_dates" on public.doctor_blocked_dates for all to authenticated using (public.is_super_admin()) with check (public.is_super_admin());
create policy "staff_view_own_clinic_doctor_blocked_dates" on public.doctor_blocked_dates for select to authenticated using (clinic_id = public.current_clinic_id());
create policy "staff_manage_own_clinic_doctor_blocked_dates" on public.doctor_blocked_dates for all to authenticated using (clinic_id = public.current_clinic_id() and public.has_permission('availability.configure')) with check (clinic_id = public.current_clinic_id() and public.has_permission('availability.configure'));

create policy "super_admin_manage_appointment_slots" on public.appointment_slots for all to authenticated using (public.is_super_admin()) with check (public.is_super_admin());
create policy "staff_view_own_clinic_appointment_slots" on public.appointment_slots for select to authenticated using (clinic_id = public.current_clinic_id());
create policy "staff_manage_own_clinic_appointment_slots" on public.appointment_slots for all to authenticated using (clinic_id = public.current_clinic_id() and (public.has_permission('appointments.create') or public.has_permission('appointments.manage') or public.has_permission('availability.configure'))) with check (clinic_id = public.current_clinic_id() and (public.has_permission('appointments.create') or public.has_permission('appointments.manage') or public.has_permission('availability.configure')));

create policy "super_admin_manage_appointments" on public.appointments for all to authenticated using (public.is_super_admin()) with check (public.is_super_admin());
create policy "staff_view_own_clinic_appointments" on public.appointments for select to authenticated using (clinic_id = public.current_clinic_id());
create policy "doctor_view_own_assigned_appointments" on public.appointments for select to authenticated using (doctor_id in (select id from public.doctor_profiles where staff_id = auth.uid()));
create policy "staff_create_own_clinic_appointments" on public.appointments for insert to authenticated with check (clinic_id = public.current_clinic_id() and (public.has_permission('appointments.create') or public.has_permission('appointments.assign')));
create policy "staff_update_own_clinic_appointments" on public.appointments for update to authenticated using (clinic_id = public.current_clinic_id() and (public.has_permission('appointments.edit') or public.has_permission('appointments.assign') or public.has_permission('appointments.cancel') or public.has_permission('appointments.manage'))) with check (clinic_id = public.current_clinic_id() and (public.has_permission('appointments.edit') or public.has_permission('appointments.assign') or public.has_permission('appointments.cancel') or public.has_permission('appointments.manage')));

create policy "super_admin_manage_appointment_status_history" on public.appointment_status_history for all to authenticated using (public.is_super_admin()) with check (public.is_super_admin());
create policy "staff_view_own_clinic_appointment_status_history" on public.appointment_status_history for select to authenticated using (clinic_id = public.current_clinic_id());
create policy "staff_insert_own_clinic_appointment_status_history" on public.appointment_status_history for insert to authenticated with check (clinic_id = public.current_clinic_id());

revoke all on function public.create_appointment_with_slot(jsonb) from public;
grant execute on function public.create_appointment_with_slot(jsonb) to authenticated;
revoke all on function public.update_appointment_status(uuid, text, text) from public;
grant execute on function public.update_appointment_status(uuid, text, text) to authenticated;
