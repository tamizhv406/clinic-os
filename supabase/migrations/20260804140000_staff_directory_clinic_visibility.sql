-- Staff directory visibility.
--
-- Until now "staff_view_own_profile" (phase 1) was the only SELECT policy on
-- staff_profiles outside of super_admin, so a signed-in user could read exactly one
-- row: their own. Every lookup of a colleague returned zero rows, which made
-- .single() calls answer 406 (doctor names on the owner dashboard) and left the
-- owner staff directory empty.
--
-- current_clinic_id() is security definer, so it reads staff_profiles without
-- re-entering RLS -- no recursion here.

drop policy if exists "staff_view_clinic_staff_profiles" on public.staff_profiles;
create policy "staff_view_clinic_staff_profiles" on public.staff_profiles
for select to authenticated
using (
  clinic_id is not null
  and clinic_id = public.current_clinic_id()
);

-- The staff directory shows each colleague's effective module access, which means
-- reading their staff_modules rows. Same clinic scoping as above.
drop policy if exists "staff_view_clinic_staff_modules" on public.staff_modules;
create policy "staff_view_clinic_staff_modules" on public.staff_modules
for select to authenticated
using (
  exists (
    select 1
    from public.staff_profiles sp
    where sp.id = staff_modules.staff_id
      and sp.clinic_id is not null
      and sp.clinic_id = public.current_clinic_id()
  )
);
