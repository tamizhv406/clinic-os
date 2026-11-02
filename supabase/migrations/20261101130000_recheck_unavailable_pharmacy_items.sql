-- Re-check pharmacy order items that were flagged unavailable.
--
-- _ensure_pharmacy_order() matches each prescribed medicine to the catalogue and
-- checks stock exactly once, when the order is created. If the medicine was added to
-- the catalogue, or stock arrived, a minute later, the item stayed "unavailable"
-- forever and the pharmacist could not dispense it without asking the doctor to
-- re-issue the prescription.
--
-- This re-runs the same matching for open orders. It deliberately skips items the
-- pharmacist marked unavailable by hand (their note is free text), so a human
-- decision is never silently undone.

create or replace function public.recheck_unavailable_pharmacy_items()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_clinic uuid := public.current_clinic_id();
  v_role text;
  v_item record;
  v_medicine uuid;
  v_name text;
  v_updated integer := 0;
begin
  select role_key into v_role from public.staff_profiles where id = auth.uid() and status = 'active';
  if v_clinic is null or v_role is null or v_role not in ('pharmacist', 'owner', 'admin') then
    raise exception 'Only pharmacy staff can refresh the prescription queue.';
  end if;

  for v_item in
    select poi.id, poi.medicine_name, pi.medicine_id as prescribed_medicine_id
    from public.pharmacy_order_items poi
    join public.pharmacy_orders o on o.id = poi.pharmacy_order_id
    left join public.prescription_items pi on pi.id = poi.prescription_item_id
    where poi.clinic_id = v_clinic
      and poi.status = 'unavailable'
      and o.status in ('pending', 'partially_dispensed')
      and (poi.notes is null
           or poi.notes like 'No matching medicine%'
           or poi.notes like 'Out of stock%')
  loop
    v_medicine := public._match_prescribed_medicine(v_clinic, v_item.prescribed_medicine_id, v_item.medicine_name);
    if v_medicine is null or public._usable_stock(v_medicine) <= 0 then
      continue;
    end if;

    select name into v_name from public.medicines where id = v_medicine;
    update public.pharmacy_order_items
    set medicine_id = v_medicine,
        status = 'pending',
        notes = case
          when lower(btrim(v_name)) <> lower(btrim(v_item.medicine_name)) then format('Matched to %s', v_name)
          else null
        end
    where id = v_item.id;
    v_updated := v_updated + 1;
  end loop;

  return v_updated;
end;
$$;

revoke all on function public.recheck_unavailable_pharmacy_items() from public, anon;
grant execute on function public.recheck_unavailable_pharmacy_items() to authenticated;
