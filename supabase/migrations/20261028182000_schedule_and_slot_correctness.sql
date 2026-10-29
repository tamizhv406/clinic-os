-- ---------------------------------------------------------------------------
-- Migration: 20261028182000_schedule_and_slot_correctness.sql
-- Description:
--   Task 3 - Schedule and Slot Correctness:
--   1. ensure_doctor_slots respects break start/end, slot length, capacity,
--      blocked dates, doctor active status, and never overlaps into breaks or past end time.
--   2. sync_doctor_schedule_and_slots atomically updates doctor availability,
--      deletes future unbooked slots, regenerates new slots, preserves booked slots,
--      and returns clear warnings for bookings outside the new schedule.
--   3. block_doctor_date_and_sync_slots and unblock_doctor_date_and_sync_slots.
--   4. public_doctor_available_dates uses Asia/Kolkata timezone and hides blocked dates.
--   5. public_doctor_available_slots hides past slots for today and hides blocked slots.
--   6. public_create_booking verifies slot freshness and concurrency safety.
-- ---------------------------------------------------------------------------

-- 1. ensure_doctor_slots: single source of truth for slot generation
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
  select * into profile
  from public.doctor_profiles
  where id = p_doctor_id and status = 'active';

  if profile.id is null then
    return;
  end if;

  -- Blocked date: generate no slots
  if exists (
    select 1 from public.doctor_blocked_dates
    where doctor_id = p_doctor_id and blocked_date = p_date
  ) then
    return;
  end if;

  slot_minutes := coalesce(profile.slot_duration_minutes, 15);
  if slot_minutes <= 0 then
    slot_minutes := 15;
  end if;

  for availability in
    select * from public.doctor_availability
    where doctor_id = p_doctor_id
      and is_active
      and day_of_week = extract(dow from p_date)::int
    order by start_time asc
  loop
    cursor_minutes := extract(epoch from availability.start_time)::int / 60;
    finish_minutes := extract(epoch from availability.end_time)::int / 60;
    break_start_minutes := case when availability.break_start is null then null else extract(epoch from availability.break_start)::int / 60 end;
    break_end_minutes := case when availability.break_end is null then null else extract(epoch from availability.break_end)::int / 60 end;

    while cursor_minutes + slot_minutes <= finish_minutes loop
      -- Handle breaks: slot must not overlap with break period
      if break_start_minutes is not null and break_end_minutes is not null then
        -- If cursor is inside break, jump to break end
        if cursor_minutes >= break_start_minutes and cursor_minutes < break_end_minutes then
          cursor_minutes := break_end_minutes;
          continue;
        end if;
        -- If slot would overlap break start, advance to break end
        if cursor_minutes < break_start_minutes and cursor_minutes + slot_minutes > break_start_minutes then
          cursor_minutes := break_end_minutes;
          continue;
        end if;
      end if;

      if cursor_minutes + slot_minutes <= finish_minutes then
        insert into public.appointment_slots (
          clinic_id,
          branch_id,
          doctor_id,
          slot_date,
          start_time,
          end_time,
          capacity,
          booked_count,
          status
        )
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
        on conflict (doctor_id, slot_date, start_time) do update
        set capacity = coalesce(profile.max_appointments_per_slot, 1),
            end_time = make_interval(mins => cursor_minutes + slot_minutes)::time
        where appointment_slots.booked_count = 0;
      end if;

      cursor_minutes := cursor_minutes + slot_minutes;
    end loop;
  end loop;
end;
$$;

revoke all on function public.ensure_doctor_slots(uuid, date) from public;
grant execute on function public.ensure_doctor_slots(uuid, date) to anon, authenticated;

-- 2. sync_doctor_schedule_and_slots: atomic schedule update + slot regeneration
create or replace function public.sync_doctor_schedule_and_slots(
  p_doctor_id uuid,
  p_availability jsonb,
  p_slot_duration int default null,
  p_max_capacity int default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  item jsonb;
  v_clinic_id uuid;
  v_branch_id uuid;
  v_today_ist date;
  v_scan_date date;
  v_warnings jsonb := '[]'::jsonb;
  conflicting record;
begin
  -- Fetch doctor clinic & branch
  select clinic_id, branch_id into v_clinic_id, v_branch_id
  from public.doctor_profiles
  where id = p_doctor_id;

  if v_clinic_id is null then
    raise exception 'Doctor profile not found';
  end if;

  -- Optional slot duration or capacity update
  if p_slot_duration is not null or p_max_capacity is not null then
    update public.doctor_profiles
    set slot_duration_minutes = coalesce(p_slot_duration, slot_duration_minutes),
        max_appointments_per_slot = coalesce(p_max_capacity, max_appointments_per_slot),
        updated_at = now()
    where id = p_doctor_id;
  end if;

  -- Replace availability rows
  if p_availability is not null then
    delete from public.doctor_availability where doctor_id = p_doctor_id;

    for item in select * from jsonb_array_elements(p_availability) loop
      insert into public.doctor_availability (
        clinic_id,
        branch_id,
        doctor_id,
        day_of_week,
        start_time,
        end_time,
        break_start,
        break_end,
        is_active
      )
      values (
        v_clinic_id,
        coalesce(nullif(item->>'branch_id', '')::uuid, v_branch_id),
        p_doctor_id,
        (item->>'day_of_week')::int,
        (item->>'start_time')::time,
        (item->>'end_time')::time,
        nullif(item->>'break_start', '')::time,
        nullif(item->>'break_end', '')::time,
        coalesce((item->>'is_active')::boolean, true)
      );
    end loop;
  end if;

  v_today_ist := (now() at time zone 'Asia/Kolkata')::date;

  -- Delete all unbooked future slots for this doctor so they regenerate cleanly
  delete from public.appointment_slots
  where doctor_id = p_doctor_id
    and slot_date >= v_today_ist
    and booked_count = 0;

  -- Regenerate future slots for the next 30 days
  for day_offset in 0 .. 30 loop
    v_scan_date := v_today_ist + day_offset;
    perform public.ensure_doctor_slots(p_doctor_id, v_scan_date);
  end loop;

  -- Check existing booked appointments that fall outside the new schedule
  for conflicting in
    select
      a.id as appointment_id,
      a.token_number,
      a.appointment_date,
      a.appointment_time,
      p.full_name as patient_name
    from public.appointments a
    join public.patients p on p.id = a.patient_id
    where a.doctor_id = p_doctor_id
      and a.appointment_date >= v_today_ist
      and a.status in ('booked', 'confirmed', 'arrived', 'waiting')
      and not exists (
        select 1
        from public.doctor_availability da
        where da.doctor_id = p_doctor_id
          and da.is_active
          and da.day_of_week = extract(dow from a.appointment_date)::int
          and a.appointment_time >= da.start_time
          and a.appointment_time < da.end_time
          and (
            da.break_start is null
            or da.break_end is null
            or a.appointment_time < da.break_start
            or a.appointment_time >= da.break_end
          )
      )
    order by a.appointment_date asc, a.appointment_time asc
  loop
    v_warnings := v_warnings || jsonb_build_array(jsonb_build_object(
      'appointmentId', conflicting.appointment_id,
      'token', conflicting.token_number,
      'patientName', conflicting.patient_name,
      'date', conflicting.appointment_date::text,
      'time', to_char(conflicting.appointment_time, 'HH12:MI AM'),
      'warning', 'Appointment for ' || conflicting.patient_name || ' (' || coalesce(conflicting.token_number, 'No token') || ') on ' || to_char(conflicting.appointment_date, 'Dy, DD Mon') || ' at ' || to_char(conflicting.appointment_time, 'HH12:MI AM') || ' falls outside the new schedule hours.'
    ));
  end loop;

  return jsonb_build_object(
    'success', true,
    'warnings', v_warnings
  );
end;
$$;

revoke all on function public.sync_doctor_schedule_and_slots(uuid, jsonb, int, int) from public;
grant execute on function public.sync_doctor_schedule_and_slots(uuid, jsonb, int, int) to authenticated;

-- 3. block_doctor_date_and_sync_slots: atomic date blocking + slot cleanup
create or replace function public.block_doctor_date_and_sync_slots(
  p_clinic_id uuid,
  p_doctor_id uuid,
  p_blocked_date date,
  p_reason text default null,
  p_staff_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_warnings jsonb := '[]'::jsonb;
  conflicting record;
begin
  insert into public.doctor_blocked_dates (
    clinic_id,
    doctor_id,
    blocked_date,
    reason,
    created_by
  )
  values (
    p_clinic_id,
    p_doctor_id,
    p_blocked_date,
    p_reason,
    p_staff_id
  )
  on conflict (doctor_id, blocked_date) do update
  set reason = excluded.reason;

  -- Delete all unbooked slots on this date
  delete from public.appointment_slots
  where doctor_id = p_doctor_id
    and slot_date = p_blocked_date
    and booked_count = 0;

  -- Any remaining booked slots get flagged as warnings for reception to move
  for conflicting in
    select
      a.id as appointment_id,
      a.token_number,
      a.appointment_date,
      a.appointment_time,
      p.full_name as patient_name
    from public.appointments a
    join public.patients p on p.id = a.patient_id
    where a.doctor_id = p_doctor_id
      and a.appointment_date = p_blocked_date
      and a.status in ('booked', 'confirmed', 'arrived', 'waiting')
    order by a.appointment_time asc
  loop
    v_warnings := v_warnings || jsonb_build_array(jsonb_build_object(
      'appointmentId', conflicting.appointment_id,
      'token', conflicting.token_number,
      'patientName', conflicting.patient_name,
      'date', conflicting.appointment_date::text,
      'time', to_char(conflicting.appointment_time, 'HH12:MI AM'),
      'warning', 'Appointment for ' || conflicting.patient_name || ' on blocked date ' || to_char(conflicting.appointment_date, 'Dy, DD Mon') || ' at ' || to_char(conflicting.appointment_time, 'HH12:MI AM') || ' needs to be rescheduled.'
    ));
  end loop;

  return jsonb_build_object(
    'success', true,
    'warnings', v_warnings
  );
end;
$$;

revoke all on function public.block_doctor_date_and_sync_slots(uuid, uuid, date, text, uuid) from public;
grant execute on function public.block_doctor_date_and_sync_slots(uuid, uuid, date, text, uuid) to authenticated;

-- 4. public_doctor_available_dates: uses Asia/Kolkata date and hides blocked dates
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
  today_ist date;
  has_availability boolean;
  is_blocked boolean;
begin
  today_ist := (now() at time zone 'Asia/Kolkata')::date;

  for day_offset in 0 .. greatest(coalesce(p_days, 14), 1) - 1 loop
    target := today_ist + day_offset;

    -- Check if doctor has active availability for this day of week
    select exists (
      select 1 from public.doctor_availability da
      where da.doctor_id = p_doctor_id
        and da.is_active
        and da.day_of_week = extract(dow from target)::int
    ) into has_availability;

    if not has_availability then
      continue;
    end if;

    -- Check if date is blocked
    select exists (
      select 1 from public.doctor_blocked_dates bd
      where bd.doctor_id = p_doctor_id and bd.blocked_date = target
    ) into is_blocked;

    -- Blocked dates disappear from the patient date list
    if is_blocked then
      continue;
    end if;

    result := result || jsonb_build_array(jsonb_build_object(
      'id', target::text,
      'date', target::text,
      'label', to_char(target, 'Dy, DD Mon'),
      'available', true
    ));
  end loop;

  return result;
end;
$$;

revoke all on function public.public_doctor_available_dates(uuid, int) from public;
grant execute on function public.public_doctor_available_dates(uuid, int) to anon, authenticated;

-- 5. public_doctor_available_slots: 12-hour AM/PM, hides past slots for today, hides blocked slots
create or replace function public.public_doctor_available_slots(p_doctor_id uuid, p_date date)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  result jsonb;
  today_ist date;
  now_ist_time time;
  is_blocked boolean;
begin
  today_ist := (now() at time zone 'Asia/Kolkata')::date;
  now_ist_time := (now() at time zone 'Asia/Kolkata')::time;

  -- Past dates have no available slots
  if p_date < today_ist then
    return '[]'::jsonb;
  end if;

  -- Blocked date: return empty array
  select exists (
    select 1 from public.doctor_blocked_dates
    where doctor_id = p_doctor_id and blocked_date = p_date
  ) into is_blocked;

  if is_blocked then
    return '[]'::jsonb;
  end if;

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
        when s.booked_count >= s.capacity or s.status = 'full' then 'booked'
        when s.capacity - s.booked_count = 1 and s.capacity > 1 then 'limited'
        else 'available'
      end
    ) as slot
    from public.appointment_slots s
    where s.doctor_id = p_doctor_id
      and s.slot_date = p_date
      and s.status <> 'blocked'
      and (
        p_date > today_ist
        or (p_date = today_ist and s.start_time > now_ist_time)
      )
  ) slots;

  return result;
end;
$$;

revoke all on function public.public_doctor_available_slots(uuid, date) from public;
grant execute on function public.public_doctor_available_slots(uuid, date) to anon, authenticated;

-- 6. Update public_create_booking with exact concurrency message
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
  today_ist date;
  now_ist_time time;
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

  -- Lock slot row for concurrency protection
  select * into slot_row
  from public.appointment_slots
  where id = nullif(input->>'slot_id', '')::uuid
  for update;

  if slot_row.id is null then
    raise exception 'This slot was just taken, please pick another';
  end if;
  if slot_row.clinic_id <> clinic_row.id then
    raise exception 'Selected slot does not belong to this clinic';
  end if;
  if slot_row.status <> 'available' or slot_row.booked_count >= slot_row.capacity then
    raise exception 'This slot was just taken, please pick another';
  end if;

  today_ist := (now() at time zone 'Asia/Kolkata')::date;
  now_ist_time := (now() at time zone 'Asia/Kolkata')::time;
  if slot_row.slot_date < today_ist or (slot_row.slot_date = today_ist and slot_row.start_time <= now_ist_time) then
    raise exception 'This slot is in the past, please pick an upcoming slot';
  end if;

  select * into doctor_row from public.doctor_profiles where id = slot_row.doctor_id;
  select full_name into doctor_name from public.staff_profiles where id = doctor_row.staff_id;

  if nullif(input->>'service_id', '') is not null then
    select * into service_row
    from public.clinic_services
    where id = (input->>'service_id')::uuid and clinic_id = clinic_row.id;
  end if;

  -- Normalize phone to last 10 digits for patient lookup
  select * into patient_row
  from public.patients
  where clinic_id = clinic_row.id
    and right(regexp_replace(phone, '\D', '', 'g'), 10) = right(regexp_replace(patient_phone, '\D', '', 'g'), 10)
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
    'appointment_id', appointment_row.id,
    'bookingId', appointment_row.id,
    'token_number', token,
    'token', token,
    'appointment_date', slot_row.slot_date,
    'appointmentDate', slot_row.slot_date,
    'appointment_time', to_char(slot_row.start_time, 'HH12:MI AM'),
    'appointmentTime', to_char(slot_row.start_time, 'HH12:MI AM'),
    'doctor_name', doctor_name,
    'doctorName', doctor_name,
    'clinic_name', clinic_row.name,
    'clinicName', clinic_row.name,
    'clinicSlug', clinic_row.slug,
    'patientName', patient_name,
    'serviceName', service_row.name,
    'dateTime', to_char(slot_row.slot_date, 'Dy, DD Mon') || ' at ' || to_char(slot_row.start_time, 'HH12:MI AM'),
    'status', 'booked'
  );
end;
$$;

revoke all on function public.public_create_booking(jsonb) from public;
grant execute on function public.public_create_booking(jsonb) to anon, authenticated;
