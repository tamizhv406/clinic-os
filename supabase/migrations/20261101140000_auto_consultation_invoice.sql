-- Bill the doctor's consultation fee automatically when a consultation is completed.
--
-- Until now the only bill a visit produced on its own was the pharmacy bill. The
-- doctor's consultation fee became an invoice only if front-desk staff remembered to
-- build one by hand, so a clinic's revenue silently depended on a manual step.
--
-- When a consultation moves to 'completed' this creates one unpaid consultation
-- invoice for the doctor's configured fee. It is skipped when
--   * the doctor has no fee set (free or bundled visits), or
--   * the visit already has a live (non-cancelled) consultation invoice.
-- Reception then sees it under Pending Payments and collects it as usual.
--
-- SECURITY DEFINER because the person completing the consultation is a doctor, who has
-- no billing permission of their own; the invoice is still scoped to the
-- consultation's own clinic.

create or replace function public.bill_completed_consultation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_fee numeric(12,2);
  v_doctor_name text;
  v_invoice public.invoices;
begin
  if new.status is distinct from 'completed' or old.status is not distinct from 'completed' then
    return new;
  end if;

  select dp.consultation_fee, sp.full_name
  into v_fee, v_doctor_name
  from public.doctor_profiles dp
  left join public.staff_profiles sp on sp.id = dp.staff_id
  where dp.id = new.doctor_id;

  if coalesce(v_fee, 0) <= 0 then
    return new;
  end if;

  if exists (
    select 1 from public.invoices i
    where i.invoice_status <> 'cancelled'
      and i.invoice_type = 'consultation'
      and (i.consultation_id = new.id or i.appointment_id = new.appointment_id)
  ) then
    return new;
  end if;

  insert into public.invoices (
    clinic_id, branch_id, patient_id, appointment_id, consultation_id,
    invoice_number, invoice_type, subtotal, total_amount, paid_amount, balance_amount,
    payment_status, invoice_status, created_by, metadata
  )
  values (
    new.clinic_id, new.branch_id, new.patient_id, new.appointment_id, new.id,
    public.next_invoice_number(new.clinic_id), 'consultation', v_fee, v_fee, 0, v_fee,
    'unpaid', 'issued', auth.uid(), jsonb_build_object('source', 'consultation_completed')
  )
  returning * into v_invoice;

  insert into public.invoice_items (clinic_id, invoice_id, item_type, reference_id, description, quantity, unit_price, line_total)
  values (v_invoice.clinic_id, v_invoice.id, 'consultation', new.id,
          'Consultation' || coalesce(' - ' || v_doctor_name, ''), 1, v_fee, v_fee);

  insert into public.invoice_status_history (clinic_id, invoice_id, old_status, new_status, old_payment_status, new_payment_status, reason, changed_by)
  values (v_invoice.clinic_id, v_invoice.id, null, v_invoice.invoice_status, null, v_invoice.payment_status, 'consultation_completed', auth.uid());

  return new;
end;
$$;

revoke all on function public.bill_completed_consultation() from public, anon, authenticated;

drop trigger if exists consultations_bill_on_complete on public.consultations;
create trigger consultations_bill_on_complete
after update of status on public.consultations
for each row execute function public.bill_completed_consultation();
