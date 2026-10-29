-- =====================================================================
-- Migration: 20261028181000_honest_booking_status.sql
-- Description: Honest booking wording and status (Finding A1, A11)
-- Returns real appointment status ('booked', 'arrived', 'waiting', etc.)
-- without fabricating 'confirmed'. Normalizes phone lookup to last 10 digits.
-- =====================================================================

create or replace function public.public_booking_status(p_phone text, p_reference text)
returns jsonb
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  clean_phone text;
  clean_ref text;
  result jsonb;
begin
  clean_phone := right(regexp_replace(coalesce(p_phone, ''), '\D', '', 'g'), 10);
  clean_ref := btrim(coalesce(p_reference, ''));

  if clean_phone = '' or clean_ref = '' then
    return null;
  end if;

  select jsonb_build_object(
    'bookingId', a.id,
    'token', coalesce(a.token_number, ''),
    'status', a.status,
    'clinicName', c.name,
    'clinicSlug', c.slug,
    'doctorName', coalesce(sp.full_name, 'Doctor'),
    'patientName', p.full_name,
    'dateTime', to_char(a.appointment_date, 'DD Mon YYYY') || ' - ' || coalesce(to_char(a.appointment_time, 'HH12:MI AM'), 'Time to be confirmed')
  )
  into result
  from public.appointments a
  join public.clinics c on c.id = a.clinic_id
  join public.patients p on p.id = a.patient_id
  left join public.doctor_profiles dp on dp.id = a.doctor_id
  left join public.staff_profiles sp on sp.id = dp.staff_id
  where right(regexp_replace(coalesce(p.phone, ''), '\D', '', 'g'), 10) = clean_phone
    and (upper(btrim(coalesce(a.token_number, ''))) = upper(clean_ref) or a.id::text = clean_ref)
  order by a.created_at desc
  limit 1;

  return result;
end;
$$;

revoke all on function public.public_booking_status(text, text) from public;
grant execute on function public.public_booking_status(text, text) to anon, authenticated;

