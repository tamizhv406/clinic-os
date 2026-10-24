-- =====================================================================
-- Pharmacist access fix (Phase 16, Task 1)
-- =====================================================================
-- Phase 1 granted the pharmacist role only view/create/edit/assign/cancel/
-- bill/dispense/configure, so pharmacy.manage (Medicine Stock, Purchase
-- Entry) was never allowed. Per-staff rows also override role rows
-- (has_permission() = coalesce(staff, role)), and the demo seed copied the
-- old role grants into staff_permissions, so existing pharmacists must be
-- updated as well.
--
-- Only the pharmacist role and pharmacist staff are touched. Nothing is
-- revoked, and clinic_modules is left alone (the demo seed enables modules
-- for the demo clinic). Safe to re-run.
-- =====================================================================

-- 1. Role-level grants
insert into public.role_modules (role_key, module_key, enabled)
values
  ('pharmacist', 'dashboard', true),
  ('pharmacist', 'pharmacy', true),
  ('pharmacist', 'prescriptions', true),
  ('pharmacist', 'billing', true)
on conflict (role_key, module_key) do update set enabled = true;

insert into public.role_permissions (role_key, permission_key, allowed)
select 'pharmacist', p.key, true
from public.permissions p
where p.key in (
  'pharmacy.view', 'pharmacy.create', 'pharmacy.edit', 'pharmacy.manage',
  'pharmacy.dispense', 'pharmacy.bill', 'pharmacy.export',
  'prescriptions.view',
  'billing.view', 'billing.create', 'billing.bill',
  'dashboard.view'
)
on conflict (role_key, permission_key) do update set allowed = true;

-- 2. Bring every existing pharmacist staff member up to date
insert into public.staff_modules (staff_id, module_key, enabled)
select sp.id, m.module_key, true
from public.staff_profiles sp
cross join (values ('dashboard'), ('pharmacy'), ('prescriptions'), ('billing')) as m(module_key)
where sp.role_key = 'pharmacist'
on conflict (staff_id, module_key) do update set enabled = true;

insert into public.staff_permissions (staff_id, permission_key, allowed)
select sp.id, p.key, true
from public.staff_profiles sp
join public.permissions p on p.key in (
  'pharmacy.view', 'pharmacy.create', 'pharmacy.edit', 'pharmacy.manage',
  'pharmacy.dispense', 'pharmacy.bill', 'pharmacy.export',
  'prescriptions.view',
  'billing.view', 'billing.create', 'billing.bill',
  'dashboard.view'
)
where sp.role_key = 'pharmacist'
on conflict (staff_id, permission_key) do update set allowed = true;
