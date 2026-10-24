-- =====================================================================
-- Diagnose pharmacist login / access (read-only)
-- =====================================================================
-- Run in the Supabase SQL editor before and after applying
-- supabase/migrations/20261013120000_pharmacist_access_fix.sql.
--
-- How to read the results:
--   Query 1 empty      -> the Auth user does not exist. Create
--                         pharmacist@vernex.test under Authentication -> Users
--                         with "Auto Confirm User" ticked, then re-run
--                         supabase/seed/demo_seed.sql.
--   Query 2 empty      -> no staff profile is linked to the Auth user (it was
--                         created after the seed ran). Re-run the seed.
--   Query 3/4 missing pharmacy.manage (or pharmacy module disabled)
--                      -> apply 20261013120000_pharmacist_access_fix.sql.
--   clinic_enabled false/null in query 3 -> the clinic has that module
--                         switched off in clinic_modules.
-- =====================================================================

-- 1. Does the Auth user exist and is it confirmed?
select id, email, email_confirmed_at, last_sign_in_at
from auth.users where lower(email) = 'pharmacist@vernex.test';

-- 2. Is there an active staff profile linked to it?
select sp.id, sp.user_id, sp.role_key, sp.status, sp.clinic_id, c.slug, c.status as clinic_status
from public.staff_profiles sp left join public.clinics c on c.id = sp.clinic_id
where lower(sp.email) = 'pharmacist@vernex.test';

-- 3. Effective modules (staff rows override role rows) and clinic switch
select sm.module_key, sm.enabled, cm.enabled as clinic_enabled
from public.staff_profiles sp
join public.staff_modules sm on sm.staff_id = sp.id
left join public.clinic_modules cm on cm.clinic_id = sp.clinic_id and cm.module_key = sm.module_key
where lower(sp.email) = 'pharmacist@vernex.test' order by 1;

-- 4. Effective pharmacy / prescription / billing permissions
select sper.permission_key, sper.allowed
from public.staff_profiles sp join public.staff_permissions sper on sper.staff_id = sp.id
where lower(sp.email) = 'pharmacist@vernex.test'
  and split_part(sper.permission_key, '.', 1) in ('pharmacy','prescriptions','billing','dashboard')
order by 1;

-- 5. Other roles must be unchanged by the migration: compare before/after.
select role_key, count(*) filter (where allowed) as allowed_permissions
from public.role_permissions
where role_key in ('owner', 'admin', 'doctor', 'receptionist')
group by role_key order by role_key;
