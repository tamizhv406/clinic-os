-- ---------------------------------------------------------------------------
-- Migration: 20261028184000_my_appointments_lookup.sql
-- Description:
--   Task 6 - Find My Appointments with Mobile Number & Privacy Protection:
--   1. Rate limiting table appointment_lookup_rate_limits per clinic and phone.
--   2. Name masking helper function mask_patient_name (first name + initials).
--   3. RPC public_lookup_appointments(p_clinic_slug text, p_phone text):
--      - Curated, anonymous security-definer RPC.
--      - Enforces phone number normalization (last 10 digits).
--      - Enforces server-side rolling-window rate limiting.
--      - Returns upcoming (soonest first) + past 90 days (newest first).
--      - Returns strictly safe patient-facing fields; NO clinical or billing data.
-- ---------------------------------------------------------------------------

-- 1. Rate limiting table
create table if not exists public.appointment_lookup_rate_limits (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  phone text not null,
  attempts int not null default 1,
  window_start timestamptz not null default now(),
  created_at timestamptz default now()
);

create index if not exists idx_lookup_rate_limits_clinic_phone
on public.appointment_lookup_rate_limits(clinic_id, phone);

-- 2. Name masking function
create or replace function public.mask_patient_name(p_name text)
returns text
language plpgsql
immutable
as $$
declare
  parts text[];
  result text;
  i int;
begin
  if p_name is null or btrim(p_name) = '' then
    return 'Patient';
  end if;
  parts := regexp_split_to_array(btrim(p_name), '\s+');
  if array_length(parts, 1) is null or array_length(parts, 1) <= 1 then
    return parts[1];
  end if;
  result := parts[1];
  for i in 2 .. array_length(parts, 1) loop
    result := result || ' ' || upper(substring(parts[i] from 1 for 1)) || '.';
  end loop;
  return result;
end;
$$;

-- 3. Anonymous appointments lookup RPC
create or replace function public.public_lookup_appointments(p_clinic_slug text, p_phone text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  clinic_row public.clinics;
  clean_phone text;
  rate_row public.appointment_lookup_rate_limits;
  today_ist date;
  ninety_days_ago date;
  result jsonb;
begin
  -- Normalize phone to last 10 digits
  clean_phone := right(regexp_replace(coalesce(p_phone, ''), '\D', '', 'g'), 10);
  if clean_phone is null or length(clean_phone) < 10 then
    return '[]'::jsonb;
  end if;

  select * into clinic_row
  from public.clinics
  where slug = btrim(coalesce(p_clinic_slug, ''))
    and status in ('trial', 'active');

  if clinic_row.id is null then
    return '[]'::jsonb;
  end if;

  -- Server-side rate limiting: 5 attempts per 5 minutes per phone & clinic
  select * into rate_row
  from public.appointment_lookup_rate_limits
  where clinic_id = clinic_row.id
    and phone = clean_phone
    and window_start > now() - interval '5 minutes'
  order by window_start desc
  limit 1
  for update;

  if rate_row.id is not null then
    if rate_row.attempts >= 5 then
      raise exception 'Too many tries, please try again in a few minutes';
    end if;
    update public.appointment_lookup_rate_limits
    set attempts = attempts + 1
    where id = rate_row.id;
  else
    insert into public.appointment_lookup_rate_limits (clinic_id, phone, attempts, window_start)
    values (clinic_row.id, clean_phone, 1, now());
  end if;

  today_ist := (now() at time zone 'Asia/Kolkata')::date;
  ninety_days_ago := today_ist - 90;

  -- Select upcoming first (soonest first), then past 90 days (newest first)
  select coalesce(jsonb_agg(item), '[]'::jsonb)
  into result
  from (
    select jsonb_build_object(
      'bookingId', a.id,
      'token', coalesce(a.token_number, ''),
      'date', a.appointment_date::text,
      'time', to_char(a.appointment_time, 'HH12:MI AM'),
      'doctorName', coalesce(sp.full_name, 'Doctor'),
      'doctorSpecialty', coalesce(dp.department, dp.qualification, 'General Medicine'),
      'clinicName', clinic_row.name,
      'clinicAddress', coalesce(b.address, clinic_row.name),
      'patientName', public.mask_patient_name(p.full_name),
      'status', a.status,
      'serviceName', coalesce(cs.name, ''),
      'isUpcoming', (a.appointment_date >= today_ist),
      'instructions', 'Show your token number at reception.'
    ) as item
    from public.appointments a
    join public.patients p on p.id = a.patient_id
    left join public.doctor_profiles dp on dp.id = a.doctor_id
    left join public.staff_profiles sp on sp.id = dp.staff_id
    left join public.branches b on b.id = a.branch_id
    left join public.clinic_services cs on cs.id = (a.metadata->>'service_id')::uuid
    where a.clinic_id = clinic_row.id
      and right(regexp_replace(p.phone, '\D', '', 'g'), 10) = clean_phone
      and a.appointment_date >= ninety_days_ago
    order by
      case when a.appointment_date >= today_ist then 0 else 1 end asc,
      case when a.appointment_date >= today_ist then a.appointment_date end asc,
      case when a.appointment_date >= today_ist then a.appointment_time end asc,
      case when a.appointment_date < today_ist then a.appointment_date end desc,
      case when a.appointment_date < today_ist then a.appointment_time end desc
    limit 50
  ) rows;

  return result;
end;
$$;

revoke all on function public.public_lookup_appointments(text, text) from public;
grant execute on function public.public_lookup_appointments(text, text) to anon, authenticated;

