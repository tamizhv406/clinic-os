-- ---------------------------------------------------------------------------
-- Migration: 20261028183000_concurrency_safe_tokens.sql
-- Description:
--   Task 4 - Data Integrity:
--   1. Concurrency-safe token number generation using transactional advisory locks.
--   2. Strict uniqueness constraint per clinic, date, and token_number.
--   3. Seamless rollover past A999 (e.g. A001..A999, B001..B999, ..., Z999).
--   4. Preserves all existing tokens without alteration.
-- ---------------------------------------------------------------------------

-- 1. Create unique index on clinic_id, appointment_date, and token_number
create unique index if not exists idx_appointments_clinic_date_token
on public.appointments (clinic_id, appointment_date, token_number)
where token_number is not null;

-- 2. Concurrency-safe token generator
create or replace function public.next_token_number(target_clinic_id uuid, target_date date)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  lock_key bigint;
  max_token text;
  max_letter text;
  max_num int;
  next_letter text;
  next_num int;
  total_count int;
begin
  -- Transactional advisory lock on hashtext of clinic + date string
  -- Serializes token generation for the same clinic and date within the transaction
  lock_key := hashtext(target_clinic_id::text || ':' || target_date::text);
  perform pg_advisory_xact_lock(lock_key);

  -- Count existing valid tokens for today to determine sequential index
  select count(*)
  into total_count
  from public.appointments
  where clinic_id = target_clinic_id
    and appointment_date = target_date
    and token_number ~ '^[A-Z][0-9]{3,}$';

  if total_count = 0 then
    -- Check if any legacy appointments exist without 3-digit padding
    select max(token_number)
    into max_token
    from public.appointments
    where clinic_id = target_clinic_id
      and appointment_date = target_date
      and token_number ~ '^[A-Z][0-9]+$';

    if max_token is null then
      return 'A001';
    end if;
  end if;

  -- Determine next token based on max current token
  select
    substring(token_number from '^[A-Z]'),
    nullif(regexp_replace(token_number, '^[A-Z]', ''), '')::int
  into max_letter, max_num
  from public.appointments
  where clinic_id = target_clinic_id
    and appointment_date = target_date
    and token_number ~ '^[A-Z][0-9]+$'
  order by
    substring(token_number from '^[A-Z]') desc,
    nullif(regexp_replace(token_number, '^[A-Z]', ''), '')::int desc
  limit 1;

  if max_num is null or max_num < 1 then
    next_letter := 'A';
    next_num := 1;
  elsif max_num < 999 then
    next_letter := coalesce(max_letter, 'A');
    next_num := max_num + 1;
  else
    -- Rollover past 999: advance to next ASCII uppercase letter (A -> B -> C ...)
    if max_letter = 'Z' then
      -- If Z999 is reached, fall back to sequential 4-digit notation
      next_letter := 'Z';
      next_num := max_num + 1;
    else
      next_letter := chr(ascii(coalesce(max_letter, 'A')) + 1);
      next_num := 1;
    end if;
  end if;

  return next_letter || lpad(next_num::text, 3, '0');
end;
$$;

revoke all on function public.next_token_number(uuid, date) from public;
grant execute on function public.next_token_number(uuid, date) to anon, authenticated;

