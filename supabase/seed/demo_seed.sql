-- =====================================================================
-- Vernex Clinic OS - demo data seed
-- =====================================================================
-- Run this in the Supabase SQL editor (or psql) AFTER all migrations in
-- supabase/migrations have been applied.
--
-- PREREQUISITE - create these Auth users first
-- -------------------------------------------
-- Supabase Dashboard -> Authentication -> Users -> "Add user"
-- (tick "Auto Confirm User"). Use any password you like, the same one for all:
--
--   owner@vernex.test
--   reception@vernex.test
--   doctor@vernex.test
--   doctor2@vernex.test
--   doctor3@vernex.test
--   pharmacist@vernex.test
--   superadmin@vernex.test
--
-- Any user in that list that does not exist is simply skipped, so you can
-- start with just owner/reception/doctor/pharmacist if you prefer.
--
-- The script is idempotent: running it again refreshes the demo data and
-- re-dates it around today. It only ever touches the demo clinic
-- (slug = 'vernex-demo-clinic') and never deletes data from other clinics.
--
-- It needs every migration in supabase/migrations, including the Phase 16
-- pharmacy migrations. Each run resets the demo clinic's pharmacy (stock,
-- purchases, movements, pharmacy bills) to the seeded state; section 12b then
-- creates the pharmacy activity through the real database functions, acting
-- as the demo pharmacist for this transaction only.
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
-- 0. Guard: at least one demo Auth user must exist
-- ---------------------------------------------------------------------
do $$
begin
  if to_regprocedure('public._ensure_pharmacy_order(uuid)') is null
     or to_regprocedure('public.create_pharmacy_counter_sale(jsonb)') is null
     or to_regprocedure('public.create_stock_purchase(jsonb)') is null then
    raise exception using
      message = 'The Phase 16 pharmacy migrations are not applied.',
      hint = 'Apply every file in supabase/migrations (up to 20261013123000_pharmacy_counter_sale.sql), then run this seed again.';
  end if;

  if not exists (
    select 1 from auth.users
    where lower(email) in ('owner@vernex.test','reception@vernex.test','doctor@vernex.test',
                           'doctor2@vernex.test','doctor3@vernex.test','pharmacist@vernex.test',
                           'superadmin@vernex.test','super_admin@vernex.test')
  ) then
    raise exception using
      message = 'No demo Auth users found.',
      hint = 'Create owner@vernex.test (and the other demo users) under Authentication -> Users with "Auto Confirm User" ticked, then re-run this script.';
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 1. Clinic, branch and enabled modules
-- ---------------------------------------------------------------------
-- The demo clinic is identified by its slug, not by a fixed id: an earlier
-- bootstrap script may already own that slug. Its real id and the main branch id
-- are published as session settings that the rest of this script reads.
do $$
declare
  v_clinic uuid;
  v_branch uuid;
  v_settings jsonb := jsonb_build_object(
    'demo', true,
    'booking_hours', 'Mon–Sat · 9:00 AM–8:00 PM',
    'map_url', 'https://maps.google.com/?q=Indiranagar+Bengaluru',
    'whatsapp', jsonb_build_object(
      'businessNumber', '+91 98765 43210',
      'displayName', 'Vernex Multispeciality Clinic',
      'businessProfileStatus', 'Verified (demo)',
      'clinicMode', 'multi_speciality',
      'enableBooking', true,
      'allowExistingPatientLookup', true,
      'requirePaymentBeforeConfirmation', false,
      'autoCreateAppointment', true,
      'sendReminderBeforeAppointment', true,
      'reminderTiming', '24 hours before',
      'reminderTemplate', 'appointment_reminder',
      'followUpReminder', true,
      'handoffOnStaff', true,
      'handoffAfterFailedAttempts', true,
      'receptionContactDisplay', '+91 98765 43210',
      'apiStatus', 'not_connected',
      'provider', 'meta_cloud_api'
    )
  );
begin
  select id into v_clinic from public.clinics where slug = 'vernex-demo-clinic';

  if v_clinic is null then
    insert into public.clinics (name, slug, clinic_mode, specialty, phone, whatsapp_number, email, address, status, settings)
    values ('Vernex Multispeciality Clinic', 'vernex-demo-clinic', 'multi_speciality',
            'General Medicine · Dental · Dermatology', '+91 98765 43210', '+91 98765 43210',
            'hello@vernexclinic.test', '12, 5th Main Road, Indiranagar, Bengaluru 560038', 'active', v_settings)
    returning id into v_clinic;
  else
    update public.clinics set
      name = 'Vernex Multispeciality Clinic',
      clinic_mode = 'multi_speciality',
      specialty = 'General Medicine · Dental · Dermatology',
      phone = '+91 98765 43210',
      whatsapp_number = '+91 98765 43210',
      email = 'hello@vernexclinic.test',
      address = '12, 5th Main Road, Indiranagar, Bengaluru 560038',
      status = 'active',
      settings = coalesce(settings, '{}'::jsonb) || v_settings
    where id = v_clinic;
  end if;

  -- Reuse the existing main branch if the clinic already has one.
  select id into v_branch from public.branches
  where clinic_id = v_clinic order by is_main desc nulls last, created_at limit 1;

  if v_branch is null then
    insert into public.branches (clinic_id, name, address, phone, is_main, status)
    values (v_clinic, 'Indiranagar (Main)', '12, 5th Main Road, Indiranagar, Bengaluru 560038', '+91 98765 43210', true, 'active')
    returning id into v_branch;
  else
    update public.branches set
      name = 'Indiranagar (Main)',
      address = '12, 5th Main Road, Indiranagar, Bengaluru 560038',
      phone = '+91 98765 43210', is_main = true, status = 'active'
    where id = v_branch;
  end if;

  perform set_config('vernex.clinic_id', v_clinic::text, false);
  perform set_config('vernex.branch_id', v_branch::text, false);
  raise notice 'Demo clinic % / branch %', v_clinic, v_branch;
end $$;

insert into public.clinic_modules (clinic_id, module_key, enabled)
select current_setting('vernex.clinic_id')::uuid, key, true from public.modules
on conflict (clinic_id, module_key) do update set enabled = true;

-- ---------------------------------------------------------------------
-- 2. Staff profiles linked to the Auth users that exist
-- ---------------------------------------------------------------------
do $$
declare
  v_clinic uuid := current_setting('vernex.clinic_id')::uuid;
  v_branch uuid := current_setting('vernex.branch_id')::uuid;
  v_staff record;
  v_auth_id uuid;
begin
  for v_staff in
    select * from (values
      -- Both spellings are listed because different bootstrap scripts used different
      -- addresses for the platform admin. Whichever exists gets the profile.
      ('superadmin@vernex.test',  'super_admin', 'Vernex Platform Admin',  'VNX-SUPER-001', '+91 90000 00001', '{}'::jsonb),
      ('super_admin@vernex.test', 'super_admin', 'Vernex Platform Admin',  'VNX-SUPER-002', '+91 90000 00001', '{}'::jsonb),
      ('owner@vernex.test',      'owner',        'Ananya Krishnan',        'VNX-OWNER-001', '+91 90000 00002', '{}'::jsonb),
      ('reception@vernex.test',  'receptionist', 'Sneha Rao',              'VNX-REC-001',   '+91 90000 00003', '{}'::jsonb),
      ('doctor@vernex.test',     'doctor',       'Dr. Priya Sharma',       'VNX-DOC-001',   '+91 90000 00004', '{"experience_years": 12}'::jsonb),
      ('doctor2@vernex.test',    'doctor',       'Dr. Rohan Mehta',        'VNX-DOC-002',   '+91 90000 00005', '{"experience_years": 9}'::jsonb),
      ('doctor3@vernex.test',    'doctor',       'Dr. Aisha Khan',         'VNX-DOC-003',   '+91 90000 00006', '{"experience_years": 10}'::jsonb),
      ('pharmacist@vernex.test', 'pharmacist',   'Vikram Shetty',          'VNX-PHAR-001',  '+91 90000 00007', '{}'::jsonb)
    ) as t(email, role_key, full_name, user_id, phone, metadata)
  loop
    select id into v_auth_id from auth.users where lower(email) = v_staff.email limit 1;
    continue when v_auth_id is null;

    insert into public.staff_profiles (id, clinic_id, branch_id, role_key, full_name, user_id, email, phone, status, metadata)
    values (
      v_auth_id,
      case when v_staff.role_key = 'super_admin' then null else v_clinic end,
      case when v_staff.role_key = 'super_admin' then null else v_branch end,
      v_staff.role_key, v_staff.full_name, v_staff.user_id, v_staff.email, v_staff.phone, 'active',
      v_staff.metadata || jsonb_build_object('demo', true)
    )
    on conflict (id) do update set
      clinic_id = excluded.clinic_id, branch_id = excluded.branch_id, role_key = excluded.role_key,
      full_name = excluded.full_name, user_id = excluded.user_id, email = excluded.email,
      phone = excluded.phone, status = 'active', metadata = excluded.metadata;

    -- Grant every module and permission the role is entitled to.
    insert into public.staff_modules (staff_id, module_key, enabled)
    select v_auth_id, rm.module_key, rm.enabled
    from public.role_modules rm where rm.role_key = v_staff.role_key
    on conflict (staff_id, module_key) do update set enabled = excluded.enabled;

    insert into public.staff_permissions (staff_id, permission_key, allowed)
    select v_auth_id, rp.permission_key, rp.allowed
    from public.role_permissions rp where rp.role_key = v_staff.role_key
    on conflict (staff_id, permission_key) do update set allowed = excluded.allowed;

    v_auth_id := null;
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- 3. Doctor profiles + weekly availability
-- ---------------------------------------------------------------------
do $$
declare
  v_clinic uuid := current_setting('vernex.clinic_id')::uuid;
  v_branch uuid := current_setting('vernex.branch_id')::uuid;
  v_row record;
  v_staff_id uuid;
  v_doctor_id uuid;
  v_day int;
begin
  for v_row in
    select * from (values
      ('doctor@vernex.test',  'general_medicine', 'General Medicine', 'MBBS, MD',   600::numeric, 15),
      ('doctor2@vernex.test', 'dental',           'Dental Surgeon',   'BDS, MDS',   800::numeric, 20),
      ('doctor3@vernex.test', 'dermatology',      'Dermatology',      'MBBS, DDVL', 900::numeric, 20)
    ) as t(email, department, specialization, qualification, fee, slot_minutes)
  loop
    select sp.id into v_staff_id
    from public.staff_profiles sp
    join auth.users u on u.id = sp.id
    where lower(u.email) = v_row.email and sp.role_key = 'doctor'
    limit 1;
    continue when v_staff_id is null;

    insert into public.doctor_profiles (clinic_id, branch_id, staff_id, department, specialization, qualification, consultation_fee, slot_duration_minutes, max_appointments_per_slot, status)
    values (v_clinic, v_branch, v_staff_id, v_row.department, v_row.specialization, v_row.qualification, v_row.fee, v_row.slot_minutes, 1, 'active')
    on conflict (staff_id) do update set
      department = excluded.department, specialization = excluded.specialization,
      qualification = excluded.qualification, consultation_fee = excluded.consultation_fee,
      slot_duration_minutes = excluded.slot_duration_minutes, status = 'active'
    returning id into v_doctor_id;

    -- Monday to Saturday, 09:00-20:00 with a 13:00-17:00 break.
    delete from public.doctor_availability where doctor_id = v_doctor_id;
    for v_day in 1..6 loop
      insert into public.doctor_availability (clinic_id, branch_id, doctor_id, day_of_week, start_time, end_time, break_start, break_end, is_active)
      values (v_clinic, v_branch, v_doctor_id, v_day, '09:00', '20:00', '13:00', '17:00', true);
    end loop;

    v_staff_id := null;
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- 4. Bookable services and lab tests
-- ---------------------------------------------------------------------
insert into public.clinic_services (clinic_id, name, description, department, duration_minutes, price, tax_rate, sort_order)
values
  (current_setting('vernex.clinic_id')::uuid, 'General Consultation', 'Fever, pain, infection, BP/diabetes review and general concerns.', 'general_medicine', 15, 600, 0, 1),
  (current_setting('vernex.clinic_id')::uuid, 'Dental Checkup', 'Tooth pain, cleaning, dental review and gum concerns.', 'dental', 20, 800, 0, 2),
  (current_setting('vernex.clinic_id')::uuid, 'Skin Consultation', 'Rashes, allergy, acne, skin infection and pigmentation.', 'dermatology', 20, 900, 0, 3),
  (current_setting('vernex.clinic_id')::uuid, 'Hair Consultation', 'Hair fall, dandruff, scalp care and treatment follow-up.', 'dermatology', 20, 1000, 0, 4),
  (current_setting('vernex.clinic_id')::uuid, 'Follow-up Visit', 'Review visit for an ongoing treatment plan.', 'general_medicine', 10, 300, 0, 5),
  (current_setting('vernex.clinic_id')::uuid, 'Dental Scaling', 'Professional cleaning and polishing.', 'dental', 30, 1500, 0, 6)
on conflict (clinic_id, name) do update set
  description = excluded.description, department = excluded.department,
  duration_minutes = excluded.duration_minutes, price = excluded.price, sort_order = excluded.sort_order,
  status = 'active';

insert into public.lab_tests (clinic_id, name, category, price, sort_order)
values
  (current_setting('vernex.clinic_id')::uuid, 'Complete Blood Count (CBC)', 'haematology', 350, 1),
  (current_setting('vernex.clinic_id')::uuid, 'Fasting Blood Sugar', 'biochemistry', 150, 2),
  (current_setting('vernex.clinic_id')::uuid, 'HbA1c', 'biochemistry', 550, 3),
  (current_setting('vernex.clinic_id')::uuid, 'Lipid Profile', 'biochemistry', 700, 4),
  (current_setting('vernex.clinic_id')::uuid, 'Thyroid Profile (T3 T4 TSH)', 'endocrinology', 650, 5),
  (current_setting('vernex.clinic_id')::uuid, 'Vitamin D', 'biochemistry', 1200, 6),
  (current_setting('vernex.clinic_id')::uuid, 'Urine Routine', 'pathology', 250, 7),
  (current_setting('vernex.clinic_id')::uuid, 'Dental X-Ray (IOPA)', 'radiology', 400, 8)
on conflict (clinic_id, name) do update set category = excluded.category, price = excluded.price, status = 'active';

-- ---------------------------------------------------------------------
-- 5. Patients
-- ---------------------------------------------------------------------
insert into public.patients (id, clinic_id, branch_id, patient_code, full_name, phone, whatsapp_number, email, age, gender, blood_group, address, emergency_contact_name, emergency_contact_phone, allergies, existing_conditions, current_medications, medical_history, source, whatsapp_consent, reminder_consent, status, created_at)
values
  ('22222222-2222-4222-8222-000000000001', current_setting('vernex.clinic_id')::uuid, current_setting('vernex.branch_id')::uuid, 'VNX-P-0001', 'Aarav Mehta',      '+919987654120', '+919987654120', 'aarav.mehta@example.test',    34, 'male',   'B+',  '204, Palm Grove, Indiranagar, Bengaluru', 'Riya Mehta',    '+919987654121', 'Penicillin',           'Hypertension',            'Amlodipine 5mg',        'Hypertension under control since 2023.', 'reception', true,  true,  'active', now() - interval '400 days'),
  ('22222222-2222-4222-8222-000000000002', current_setting('vernex.clinic_id')::uuid, current_setting('vernex.branch_id')::uuid, 'VNX-P-0002', 'Meera Krishnan',   '+919845022331', '+919845022331', 'meera.k@example.test',        28, 'female', 'O+',  '7, Lake View Apartments, Bengaluru',      'Suresh Krishnan','+919845022332', 'None known',           'None',                    'None',                  'No significant history.',                'whatsapp',  true,  true,  'active', now() - interval '12 days'),
  ('22222222-2222-4222-8222-000000000003', current_setting('vernex.clinic_id')::uuid, current_setting('vernex.branch_id')::uuid, 'VNX-P-0003', 'Rohan Kapoor',     '+919811147522', '+919811147522', 'rohan.kapoor@example.test',   42, 'male',   'A+',  '15, MG Road, Bengaluru',                  'Nisha Kapoor',  '+919811147523', 'Sulfa drugs',          'Type 2 Diabetes',         'Metformin 500mg',       'Diabetic since 2019, reviewed quarterly.', 'phone',   true,  true,  'active', now() - interval '220 days'),
  ('22222222-2222-4222-8222-000000000004', current_setting('vernex.clinic_id')::uuid, current_setting('vernex.branch_id')::uuid, 'VNX-P-0004', 'Sana Sheikh',      '+919702011884', '+919702011884', 'sana.sheikh@example.test',    31, 'female', 'AB+', '88, Koramangala 5th Block, Bengaluru',    'Imran Sheikh',  '+919702011885', 'Dust, pollen',         'Allergic rhinitis',       'Cetirizine as needed',  'Seasonal allergies.',                    'qr',        true,  false, 'active', now() - interval '90 days'),
  ('22222222-2222-4222-8222-000000000005', current_setting('vernex.clinic_id')::uuid, current_setting('vernex.branch_id')::uuid, 'VNX-P-0005', 'Neha Iyer',        '+919900112233', '+919900112233', 'neha.iyer@example.test',      26, 'female', 'B-',  '42, HSR Layout, Bengaluru',               'Lakshmi Iyer',  '+919900112234', 'None known',           'None',                    'None',                  'First visit.',                           'website',   true,  true,  'active', now() - interval '3 days'),
  ('22222222-2222-4222-8222-000000000006', current_setting('vernex.clinic_id')::uuid, current_setting('vernex.branch_id')::uuid, 'VNX-P-0006', 'Vikram Nair',      '+919845567788', '+919845567788', 'vikram.nair@example.test',    58, 'male',   'O-',  '9, Jayanagar 4th Block, Bengaluru',       'Anita Nair',    '+919845567789', 'Aspirin',              'Hypertension, Arthritis', 'Telmisartan 40mg',      'Reviewed monthly for BP.',               'reception', true,  true,  'active', now() - interval '500 days'),
  ('22222222-2222-4222-8222-000000000007', current_setting('vernex.clinic_id')::uuid, current_setting('vernex.branch_id')::uuid, 'VNX-P-0007', 'Kavya Reddy',      '+919966554433', '+919966554433', 'kavya.reddy@example.test',     8, 'female', 'A-',  '31, Whitefield, Bengaluru',               'Deepa Reddy',   '+919966554434', 'None known',           'None',                    'None',                  'Paediatric patient, routine care.',      'walk_in',   true,  false, 'active', now() - interval '45 days'),
  ('22222222-2222-4222-8222-000000000008', current_setting('vernex.clinic_id')::uuid, current_setting('vernex.branch_id')::uuid, 'VNX-P-0008', 'Imran Qureshi',    '+919723344556', '+919723344556', 'imran.q@example.test',        67, 'male',   'B+',  '5, Frazer Town, Bengaluru',               'Sofia Qureshi', '+919723344557', 'None known',           'Osteoarthritis',          'Calcium + Vitamin D3',  'Senior citizen, mobility support.',      'whatsapp',  true,  true,  'active', now() - interval '150 days'),
  ('22222222-2222-4222-8222-000000000009', current_setting('vernex.clinic_id')::uuid, current_setting('vernex.branch_id')::uuid, 'VNX-P-0009', 'Divya Menon',      '+919656778899', '+919656778899', 'divya.menon@example.test',    35, 'female', 'O+',  '77, Rajajinagar, Bengaluru',              'Arjun Menon',   '+919656778890', 'Latex',                'PCOS',                    'Myo-inositol',          'Under dermatology follow-up.',           'website',   true,  true,  'active', now() - interval '30 days'),
  ('22222222-2222-4222-8222-000000000010', current_setting('vernex.clinic_id')::uuid, current_setting('vernex.branch_id')::uuid, 'VNX-P-0010', 'Arjun Nair',       '+919812233445', '+919812233445', 'arjun.nair@example.test',     29, 'male',   'A+',  '18, Ulsoor, Bengaluru',                   'Maya Nair',     '+919812233446', 'None known',           'None',                    'None',                  'Dental treatment in progress.',          'reception', true,  false, 'active', now() - interval '60 days')
on conflict (id) do update set
  full_name = excluded.full_name, phone = excluded.phone, whatsapp_number = excluded.whatsapp_number,
  email = excluded.email, age = excluded.age, gender = excluded.gender, blood_group = excluded.blood_group,
  address = excluded.address, allergies = excluded.allergies, existing_conditions = excluded.existing_conditions,
  current_medications = excluded.current_medications, medical_history = excluded.medical_history,
  source = excluded.source, status = 'active';

insert into public.patient_notes (clinic_id, patient_id, note, visibility)
values
  (current_setting('vernex.clinic_id')::uuid, '22222222-2222-4222-8222-000000000001', 'Prefers early morning appointments. BP log maintained at home.', 'doctor'),
  (current_setting('vernex.clinic_id')::uuid, '22222222-2222-4222-8222-000000000003', 'Blood sugar trending down since diet change in the last quarter.', 'doctor'),
  (current_setting('vernex.clinic_id')::uuid, '22222222-2222-4222-8222-000000000006', 'Requires wheelchair access. Family member usually accompanies.', 'reception')
on conflict do nothing;

-- ---------------------------------------------------------------------
-- 6. Pharmacy: 40 medicines, 8 supplier purchases, ~70 stock batches
-- ---------------------------------------------------------------------
-- Re-running resets the demo clinic's pharmacy to this known state: its stock
-- batches, purchases, stock movements, low-stock alerts and pharmacy bills are
-- replaced, and medicines added during a demo (for example by the sample CSV
-- upload) are removed so the demo can be repeated. Nothing outside the demo
-- clinic is touched. Medicine ids 33333333-...-000000000001 to ...010 are kept
-- because prescriptions and templates refer to them.
do $$
declare
  v_clinic uuid := current_setting('vernex.clinic_id')::uuid;
begin
  delete from public.stock_movements where clinic_id = v_clinic;
  delete from public.low_stock_alerts where clinic_id = v_clinic;
  delete from public.invoices where clinic_id = v_clinic and invoice_type = 'pharmacy';
  delete from public.medicine_stock_batches where clinic_id = v_clinic;
  delete from public.stock_purchases where clinic_id = v_clinic;
  delete from public.medicines
  where clinic_id = v_clinic
    and id not in (select ('33333333-3333-4333-8333-' || lpad(n::text, 12, '0'))::uuid from generate_series(1, 40) as n);
end $$;

insert into public.medicines (id, clinic_id, branch_id, name, generic_name, category, manufacturer, strength, unit, hsn_code, gst_rate, reorder_level, status)
select ('33333333-3333-4333-8333-' || lpad(v.n::text, 12, '0'))::uuid,
       current_setting('vernex.clinic_id')::uuid, current_setting('vernex.branch_id')::uuid,
       v.name, v.generic, v.category, v.manufacturer, v.strength, v.unit, v.hsn, v.gst, v.reorder, 'active'
from (values
  ( 1, 'Paracetamol 650mg',            'Paracetamol',                          'general',       'Cipla',            '650mg',      'tablet',  '3004', 12, 40),
  ( 2, 'Amoxicillin 500mg',            'Amoxicillin',                          'antibiotic',    'Sun Pharma',       '500mg',      'capsule', '3004', 12, 30),
  ( 3, 'Cetirizine 10mg',              'Cetirizine',                           'general',       'Dr Reddys',        '10mg',       'tablet',  '3004', 12, 25),
  ( 4, 'Pantoprazole 40mg',            'Pantoprazole',                         'general',       'Alkem',            '40mg',       'tablet',  '3004', 12, 20),
  ( 5, 'Metformin 500mg',              'Metformin',                            'general',       'USV',              '500mg',      'tablet',  '3004', 12, 40),
  ( 6, 'Amlodipine 5mg',               'Amlodipine',                           'general',       'Torrent',          '5mg',        'tablet',  '3004', 12, 30),
  ( 7, 'Chlorhexidine Rinse',          'Chlorhexidine',                        'dental',        'ICPA',             '0.2%',       'bottle',  '3306', 18, 10),
  ( 8, 'Mometasone Cream',             'Mometasone furoate',                   'skin',          'Glenmark',         '0.1%',       'tube',    '3004', 12, 15),
  ( 9, 'ORS Sachet',                   'Oral rehydration',                     'pediatric',     'FDC',              '21.8g',      'sachet',  '3004',  5, 50),
  (10, 'Vitamin D3 60K',               'Cholecalciferol',                      'supplement',    'Mankind',          '60000IU',    'sachet',  '3004', 12, 20),
  (11, 'Azithromycin 500mg',           'Azithromycin',                         'antibiotic',    'Cipla',            '500mg',      'tablet',  '3004', 12, 15),
  (12, 'Cefixime 200mg',               'Cefixime',                             'antibiotic',    'Lupin',            '200mg',      'tablet',  '3004', 12, 20),
  (13, 'Augmentin 625 Duo',            'Amoxicillin + Clavulanic acid',        'antibiotic',    'GSK',              '625mg',      'tablet',  '3004', 12, 20),
  (14, 'Dolo 650',                     'Paracetamol',                          'general',       'Micro Labs',       '650mg',      'tablet',  '3004', 12, 60),
  (15, 'Combiflam',                    'Ibuprofen + Paracetamol',              'general',       'Sanofi',           '400/325mg',  'tablet',  '3004', 12, 30),
  (16, 'Diclofenac Gel 30g',           'Diclofenac diethylamine',              'physiotherapy', 'Novartis',         '1.16%',      'tube',    '3004', 12, 10),
  (17, 'Pan-D',                        'Pantoprazole + Domperidone',           'general',       'Alkem',            '40/30mg',    'capsule', '3004', 12, 30),
  (18, 'Ondansetron 4mg',              'Ondansetron',                          'general',       'Sun Pharma',       '4mg',        'tablet',  '3004', 12, 20),
  (19, 'Rantac 150',                   'Ranitidine',                           'general',       'JB Chemicals',     '150mg',      'tablet',  '3004', 12, 20),
  (20, 'Montelukast-LC',               'Montelukast + Levocetirizine',         'general',       'Cipla',            '10/5mg',     'tablet',  '3004', 12, 20),
  (21, 'Levocetirizine 5mg',           'Levocetirizine',                       'general',       'Dr Reddys',        '5mg',        'tablet',  '3004', 12, 25),
  (22, 'Glimepiride 1mg',              'Glimepiride',                          'general',       'Sanofi',           '1mg',        'tablet',  '3004', 12, 30),
  (23, 'Telmisartan 40mg',             'Telmisartan',                          'general',       'Glenmark',         '40mg',       'tablet',  '3004', 12, 30),
  (24, 'Atorvastatin 10mg',            'Atorvastatin',                         'general',       'Zydus',            '10mg',       'tablet',  '3004', 12, 30),
  (25, 'Ecosprin 75',                  'Aspirin',                              'general',       'USV',              '75mg',       'tablet',  '3004', 12, 40),
  (26, 'Ascoril LS Syrup',             'Ambroxol + Levosalbutamol + Guaifenesin', 'general',    'Glenmark',         '100ml',      'bottle',  '3004', 12, 10),
  (27, 'Calpol Syrup 60ml',            'Paracetamol',                          'pediatric',     'GSK',              '120mg/5ml',  'bottle',  '3004', 12, 10),
  (28, 'Sensodyne Repair 70g',         'Calcium sodium phosphosilicate',       'dental',        'GSK',              '70g',        'tube',    '3306', 18,  8),
  (29, 'Metrogyl DG Gel',              'Metronidazole + Chlorhexidine',        'dental',        'JB Chemicals',     '20g',        'tube',    '3004', 12,  8),
  (30, 'Clotrimazole Cream 15g',       'Clotrimazole',                         'skin',          'Glenmark',         '1%',         'tube',    '3004', 12, 10),
  (31, 'Mupirocin Ointment 5g',        'Mupirocin',                            'skin',          'GSK',              '2%',         'tube',    '3004', 12, 10),
  (32, 'Sunscreen SPF50 50g',          'Broad-spectrum sunscreen',             'skin',          'Glenmark',         'SPF50',      'tube',    '3304', 18,  6),
  (33, 'Shelcal 500',                  'Calcium + Vitamin D3',                 'supplement',    'Torrent',          '500mg',      'tablet',  '3004', 12, 30),
  (34, 'Becosules',                    'Vitamin B-complex + C',                'supplement',    'Pfizer',           'Capsule',    'capsule', '3004', 12, 30),
  (35, 'Neurobion Forte',              'Vitamin B1 + B6 + B12',                'supplement',    'P&G Health',       'Tablet',     'tablet',  '3004', 12, 30),
  (36, 'Electral ORS 21g',             'Oral rehydration salts',               'pediatric',     'FDC',              '21g',        'sachet',  '3004',  5, 30),
  (37, 'Insulin Glargine Pen',         'Insulin glargine',                     'general',       'Biocon',           '100IU/ml',   'pen',     '3004',  5,  5),
  (38, 'Omeprazole 20mg',              'Omeprazole',                           'general',       'Dr Reddys',        '20mg',       'capsule', '3004', 12, 30),
  (39, 'Amoxyclav Dry Syrup 30ml',     'Amoxicillin + Clavulanic acid',        'pediatric',     'Alkem',            '228.5mg/5ml','bottle',  '3004', 12,  6),
  (40, 'Volini Spray 40g',             'Diclofenac + Menthol',                 'physiotherapy', 'Sun Pharma',       '40g',        'spray',   '3004', 12,  6)
) as v(n, name, generic, category, manufacturer, strength, unit, hsn, gst, reorder)
on conflict (id) do update set
  name = excluded.name, generic_name = excluded.generic_name, category = excluded.category,
  manufacturer = excluded.manufacturer, strength = excluded.strength, unit = excluded.unit,
  hsn_code = excluded.hsn_code, gst_rate = excluded.gst_rate, reorder_level = excluded.reorder_level,
  branch_id = excluded.branch_id, status = 'active';

-- Eight supplier invoices over the last 60 days from three suppliers.
insert into public.stock_purchases (id, clinic_id, branch_id, supplier_name, supplier_phone, invoice_number, purchase_date, total_amount, notes, status, metadata, created_by, created_at)
select ('44444444-4444-4444-8444-' || lpad(v.n::text, 12, '0'))::uuid,
       current_setting('vernex.clinic_id')::uuid, current_setting('vernex.branch_id')::uuid,
       v.supplier, v.phone, v.invoice, current_date - v.days_ago, 0, v.notes, 'saved',
       jsonb_build_object('source', v.source, 'demo', true),
       (select sp.id from public.staff_profiles sp where sp.clinic_id = current_setting('vernex.clinic_id')::uuid and sp.role_key = 'pharmacist' limit 1),
       ((current_date - v.days_ago) + time '11:00') at time zone 'Asia/Kolkata'
from (values
  (1, 'MedSupply Distributors',    '+918040001111', 'PUR-2001', 58, 'manual', 'Monthly general stock replenishment.'),
  (2, 'Karnataka Pharma Agencies', '+918040002222', 'PUR-2002', 52, 'manual', 'Dental and dermatology items.'),
  (3, 'MedSupply Distributors',    '+918040001111', 'PUR-2003', 45, 'excel',  'Chronic-care medicines (uploaded from supplier sheet).'),
  (4, 'Apollo Wholesale',          '+918040003333', 'PUR-2004', 38, 'manual', 'Antibiotics, antacids and syrups.'),
  (5, 'Karnataka Pharma Agencies', '+918040002222', 'PUR-2005', 30, 'excel',  'Supplements and cardiac medicines (uploaded from supplier sheet).'),
  (6, 'Apollo Wholesale',          '+918040003333', 'PUR-2006', 21, 'manual', 'Skin care and antibiotics.'),
  (7, 'MedSupply Distributors',    '+918040001111', 'PUR-2007', 12, 'excel',  'Fast-moving top-up (uploaded from supplier sheet).'),
  (8, 'Apollo Wholesale',          '+918040003333', 'PUR-2008',  4, 'manual', 'Weekly top-up.')
) as v(n, supplier, phone, invoice, days_ago, source, notes)
on conflict (id) do update set
  supplier_name = excluded.supplier_name, supplier_phone = excluded.supplier_phone, invoice_number = excluded.invoice_number,
  purchase_date = excluded.purchase_date, notes = excluded.notes, status = 'saved', metadata = excluded.metadata,
  created_by = excluded.created_by, created_at = excluded.created_at;

-- ~70 batches with a deliberate mix (before the dispensing and adjustments in 12b):
--   low stock:            Amoxicillin, Amlodipine, Ondansetron, Glimepiride, Calpol, Insulin pen
--   out of stock (in 12b): Rantac (damaged), Mupirocin (returned), Sunscreen (count correction)
--   expiring <= 30 days:   CTZ-C13, MOM-H05, AUG-M02, DCF-P02, ELO-J01
--   expiring 31-90 days:   LVC-U02, BCS-H03, MDG-C01
--   already expired:       VD3-J08, CMB-O01, CLT-D01
insert into public.medicine_stock_batches (clinic_id, branch_id, medicine_id, purchase_id, batch_no, expiry_date, quantity_available,
                                           purchase_price, selling_price, mrp, supplier_name, status, created_at)
select p.clinic_id, p.branch_id,
       ('33333333-3333-4333-8333-' || lpad(v.med::text, 12, '0'))::uuid, p.id, v.batch_no, current_date + v.expiry_in_days, v.qty,
       v.cost, v.sell, v.mrp, p.supplier_name, v.status, p.created_at
from (values
  ( 1, 'PCM-A21', 300, 180, 1,   1.80,   2.50,   2.80, 'active'),
  ( 1, 'PCM-A25', 420, 300, 5,   1.80,   2.50,   2.80, 'active'),
  ( 1, 'PCM-A29', 600, 200, 8,   1.85,   2.50,   2.80, 'active'),
  ( 2, 'AMX-B07', 210,  12, 1,   6.40,   9.00,  10.00, 'active'),
  ( 3, 'CTZ-C13',  25,  60, 1,   1.10,   2.00,   2.20, 'active'),
  ( 3, 'CTZ-C18', 390, 200, 6,   1.10,   2.00,   2.20, 'active'),
  ( 3, 'CTZ-C22', 560, 150, 8,   1.15,   2.00,   2.20, 'active'),
  ( 4, 'PAN-D04', 420,  95, 1,   3.20,   5.00,   5.50, 'active'),
  ( 4, 'PAN-D09', 500, 150, 6,   3.20,   5.00,   5.50, 'active'),
  ( 4, 'PAN-D12', 600, 100, 8,   3.25,   5.00,   5.50, 'active'),
  ( 5, 'MET-E09', 365, 140, 3,   1.60,   2.60,   3.00, 'active'),
  ( 5, 'MET-E12', 460, 200, 7,   1.60,   2.60,   3.00, 'active'),
  ( 5, 'MET-E14', 600, 150, 8,   1.65,   2.60,   3.00, 'active'),
  ( 6, 'AML-F02', 280,   8, 3,   2.10,   3.50,   4.00, 'active'),
  ( 7, 'CHX-G11', 190,  34, 2,  78.00, 120.00, 135.00, 'active'),
  ( 8, 'MOM-H05',  18,  22, 2,  96.00, 148.00, 165.00, 'active'),
  ( 8, 'MOM-H07', 330,  20, 8,  96.00, 148.00, 165.00, 'active'),
  ( 9, 'ORS-I17', 500, 210, 1,  12.00,  20.00,  22.00, 'active'),
  ( 9, 'ORS-I21', 620, 150, 7,  12.00,  20.00,  22.00, 'active'),
  (10, 'VD3-J08', -10,  15, 2,  42.00,  68.00,  75.00, 'expired'),
  (10, 'VD3-J11', 400,  40, 8,  42.00,  68.00,  75.00, 'active'),
  (11, 'AZI-K11', 240,  60, 4,  18.50,  26.00,  29.50, 'active'),
  (11, 'AZI-K15', 400,  90, 7,  18.50,  26.00,  29.50, 'active'),
  (11, 'AZI-K18', 560,  60, 8,  18.70,  26.00,  29.50, 'active'),
  (12, 'CFX-L03', 300,  80, 4,   9.80,  14.00,  16.20, 'active'),
  (13, 'AUG-M02',  12,  30, 2,  16.00,  22.50,  25.00, 'active'),
  (13, 'AUG-M06', 360,  60, 6,  16.00,  22.50,  25.00, 'active'),
  (14, 'DOL-N21', 330, 400, 3,   1.70,   2.40,   2.70, 'active'),
  (14, 'DOL-N27', 520, 300, 7,   1.70,   2.40,   2.70, 'active'),
  (14, 'DOL-N30', 640, 200, 8,   1.75,   2.40,   2.70, 'active'),
  (15, 'CMB-O01',  -5,  18, 1,   2.20,   3.40,   3.80, 'expired'),
  (15, 'CMB-O05', 280, 150, 5,   2.20,   3.40,   3.80, 'active'),
  (16, 'DCF-P02',  21,  12, 2,  58.00,  86.00,  95.00, 'active'),
  (16, 'DCF-P04', 300,  20, 6,  58.00,  86.00,  95.00, 'active'),
  (17, 'PND-Q08', 350, 120, 3,   7.20,  11.00,  12.50, 'active'),
  (18, 'OND-R03', 260,   6, 4,   3.80,   6.00,   6.80, 'active'),
  (19, 'RNT-S02', 200,  40, 4,   1.10,   1.80,   2.00, 'active'),
  (20, 'MLC-T05', 300,  90, 5,   9.50,  14.50,  16.00, 'active'),
  (21, 'LVC-U02',  45,  50, 1,   1.40,   2.40,   2.70, 'active'),
  (21, 'LVC-U06', 380, 100, 7,   1.40,   2.40,   2.70, 'active'),
  (22, 'GLM-V04', 300,  10, 3,   2.40,   3.90,   4.40, 'active'),
  (23, 'TEL-W09', 400, 150, 5,   4.10,   6.50,   7.40, 'active'),
  (23, 'TEL-W11', 520,  90, 8,   4.10,   6.50,   7.40, 'active'),
  (24, 'ATV-X07', 380, 150, 5,   3.60,   5.80,   6.60, 'active'),
  (24, 'ATV-X10', 560, 100, 8,   3.60,   5.80,   6.60, 'active'),
  (25, 'ECO-Y12', 420, 200, 3,   0.30,   0.50,   0.56, 'active'),
  (25, 'ECO-Y15', 560, 140, 7,   0.30,   0.50,   0.56, 'active'),
  (26, 'ASC-Z03', 260,  30, 4,  68.00,  98.00, 109.00, 'active'),
  (27, 'CPL-A04', 200,   4, 4,  28.00,  42.00,  46.80, 'active'),
  (28, 'SEN-B02', 500,  25, 2, 132.00, 185.00, 205.00, 'active'),
  (29, 'MDG-C01',  75,  15, 2,  52.00,  78.00,  86.00, 'active'),
  (29, 'MDG-C03', 400,  12, 8,  52.00,  78.00,  86.00, 'active'),
  (30, 'CLT-D01', -20,   6, 2,  48.00,  72.00,  80.00, 'expired'),
  (30, 'CLT-D04', 330,  30, 6,  48.00,  72.00,  80.00, 'active'),
  (31, 'MUP-E02', 260,  15, 6,  82.00, 118.00, 130.00, 'active'),
  (32, 'SUN-F01', 400,  10, 2, 310.00, 445.00, 495.00, 'active'),
  (33, 'SHL-G07', 450, 150, 5,   5.20,   8.00,   9.10, 'active'),
  (33, 'SHL-G10', 600, 120, 8,   5.20,   8.00,   9.10, 'active'),
  (34, 'BCS-H03',  60,  60, 1,   2.10,   3.20,   3.60, 'active'),
  (34, 'BCS-H06', 500, 100, 7,   2.10,   3.20,   3.60, 'active'),
  (35, 'NRB-I05', 420, 120, 5,   2.70,   4.10,   4.60, 'active'),
  (35, 'NRB-I08', 600, 100, 8,   2.70,   4.10,   4.60, 'active'),
  (36, 'ELO-J01',  28,  40, 1,  14.00,  21.00,  23.00, 'active'),
  (36, 'ELO-J04', 600, 100, 7,  14.00,  21.00,  23.00, 'active'),
  (37, 'INS-K02', 150,   2, 4, 520.00, 720.00, 790.00, 'active'),
  (38, 'OMP-L06', 380, 120, 5,   2.90,   4.60,   5.20, 'active'),
  (38, 'OMP-L09', 560, 100, 8,   2.90,   4.60,   5.20, 'active'),
  (39, 'AXD-M02', 180,  15, 6,  64.00,  92.00, 101.00, 'active'),
  (40, 'VOL-N03', 400,  18, 8, 145.00, 210.00, 235.00, 'active')
) as v(med, batch_no, expiry_in_days, qty, purchase_no, cost, sell, mrp, status)
join public.stock_purchases p on p.id = ('44444444-4444-4444-8444-' || lpad(v.purchase_no::text, 12, '0'))::uuid;

-- One add_stock movement per batch, referencing its purchase; purchase totals from the batches.
insert into public.stock_movements (clinic_id, branch_id, medicine_id, batch_id, movement_type, quantity, reason, reference_type, reference_id, created_by, created_at)
select b.clinic_id, b.branch_id, b.medicine_id, b.id, 'add_stock', b.quantity_available,
       format('Purchase %s from %s', p.invoice_number, p.supplier_name), 'stock_purchase', p.id, p.created_by, b.created_at
from public.medicine_stock_batches b
join public.stock_purchases p on p.id = b.purchase_id
where b.clinic_id = current_setting('vernex.clinic_id')::uuid;

update public.stock_purchases p
set total_amount = t.total,
    metadata = p.metadata || jsonb_build_object('item_count', t.items)
from (
  select purchase_id, round(sum(quantity_available * purchase_price), 2) as total, count(*) as items
  from public.medicine_stock_batches
  where clinic_id = current_setting('vernex.clinic_id')::uuid
  group by purchase_id
) t
where p.id = t.purchase_id;

-- ---------------------------------------------------------------------
-- 7. Prescription templates and doctor favourites
-- ---------------------------------------------------------------------
do $$
declare
  v_clinic uuid := current_setting('vernex.clinic_id')::uuid;
  v_template uuid;
  v_doctor uuid;
begin
  -- Clinic-wide templates (doctor_id null = shared with every doctor).
  delete from public.prescription_templates where clinic_id = v_clinic and doctor_id is null;

  insert into public.prescription_templates (clinic_id, doctor_id, name, description, advice)
  values (v_clinic, null, 'Viral Fever', 'Standard 3 day viral fever plan.', 'Plenty of fluids, rest, return if fever persists beyond 3 days.')
  returning id into v_template;
  insert into public.prescription_template_items (clinic_id, template_id, medicine_name, dosage, frequency, timing, duration, quantity, sort_order)
  values
    (v_clinic, v_template, 'Paracetamol 650mg', '1 tablet', '1-1-1', 'After food', '3 days', '9', 0),
    (v_clinic, v_template, 'Cetirizine 10mg',   '1 tablet', '0-0-1', 'Bedtime',    '3 days', '3', 1),
    (v_clinic, v_template, 'ORS Sachet',        '1 sachet', '1-0-1', 'Anytime',    '3 days', '6', 2);

  insert into public.prescription_templates (clinic_id, doctor_id, name, description, advice)
  values (v_clinic, null, 'Acute Bacterial Infection', 'Five day antibiotic course with gastric cover.', 'Complete the full antibiotic course even if symptoms improve.')
  returning id into v_template;
  insert into public.prescription_template_items (clinic_id, template_id, medicine_name, dosage, frequency, timing, duration, quantity, sort_order)
  values
    (v_clinic, v_template, 'Amoxicillin 500mg',  '1 capsule', '1-0-1', 'After food',    '5 days', '10', 0),
    (v_clinic, v_template, 'Pantoprazole 40mg',  '1 tablet',  '1-0-0', 'Before food',   '5 days', '5',  1),
    (v_clinic, v_template, 'Paracetamol 650mg',  '1 tablet',  '1-0-1', 'After food',    '3 days', '6',  2);

  insert into public.prescription_templates (clinic_id, doctor_id, name, description, advice)
  values (v_clinic, null, 'Diabetes Review', 'Routine quarterly diabetes review.', 'Continue diet and 30 minutes of walking daily. Repeat HbA1c in 3 months.')
  returning id into v_template;
  insert into public.prescription_template_items (clinic_id, template_id, medicine_name, dosage, frequency, timing, duration, quantity, sort_order)
  values
    (v_clinic, v_template, 'Metformin 500mg', '1 tablet', '1-0-1', 'After food', '90 days', '180', 0),
    (v_clinic, v_template, 'Vitamin D3 60K',  '1 sachet', 'Weekly', 'After food', '8 weeks', '8',   1);

  -- Seed each doctor's favourites with the medicines they prescribe most.
  for v_doctor in select id from public.doctor_profiles where clinic_id = v_clinic loop
    insert into public.doctor_favorite_medicines (clinic_id, doctor_id, medicine_name, default_dosage, default_frequency, default_timing, default_duration, usage_count, sort_order)
    values
      (v_clinic, v_doctor, 'Paracetamol 650mg', '1 tablet',  '1-0-1', 'After food',  '3 days', 24, 0),
      (v_clinic, v_doctor, 'Pantoprazole 40mg', '1 tablet',  '1-0-0', 'Before food', '5 days', 17, 1),
      (v_clinic, v_doctor, 'Cetirizine 10mg',   '1 tablet',  '0-0-1', 'Bedtime',     '5 days', 12, 2),
      (v_clinic, v_doctor, 'Amoxicillin 500mg', '1 capsule', '1-0-1', 'After food',  '5 days',  9, 3)
    on conflict do nothing;
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- 8. Appointment slots for the next two weeks
-- ---------------------------------------------------------------------
do $$
declare
  v_doctor uuid;
  v_offset int;
begin
  for v_doctor in select id from public.doctor_profiles where clinic_id = current_setting('vernex.clinic_id')::uuid loop
    for v_offset in 0..13 loop
      perform public.ensure_doctor_slots(v_doctor, current_date + v_offset);
    end loop;
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- 9. Appointments (today's queue + recent history)
-- ---------------------------------------------------------------------
do $$
declare
  v_clinic uuid := current_setting('vernex.clinic_id')::uuid;
  v_branch uuid := current_setting('vernex.branch_id')::uuid;
  v_doc_gm uuid; v_doc_dental uuid; v_doc_derm uuid;
  v_reception uuid;
  v_row record;
  v_doctor uuid;
  v_slot public.appointment_slots;
  v_appointment_id uuid;
  v_token int := 0;
begin
  select id into v_doc_gm     from public.doctor_profiles where clinic_id = v_clinic and department = 'general_medicine' limit 1;
  select id into v_doc_dental from public.doctor_profiles where clinic_id = v_clinic and department = 'dental' limit 1;
  select id into v_doc_derm   from public.doctor_profiles where clinic_id = v_clinic and department = 'dermatology' limit 1;
  select sp.id into v_reception from public.staff_profiles sp where sp.clinic_id = v_clinic and sp.role_key = 'receptionist' limit 1;

  if v_doc_gm is null then
    raise notice 'No doctor profile found - skipping appointment seed.';
    return;
  end if;

  -- Clear previously seeded demo data so re-runs stay clean. Deleting the
  -- appointments cascades to their consultations; prescriptions only lose the
  -- foreign key, so they are removed explicitly (which cascades to pharmacy
  -- orders and medicine reminders).
  delete from public.prescriptions where clinic_id = v_clinic and metadata->>'demo' = 'true';
  delete from public.appointments where clinic_id = v_clinic and metadata->>'demo' = 'true';

  -- Release the slots those appointments were holding.
  update public.appointment_slots s
  set booked_count = 0, status = 'available'
  where s.clinic_id = v_clinic
    and not exists (select 1 from public.appointments a where a.slot_id = s.id);

  for v_row in
    select * from (values
      -- patient,                                    dept,     day offset, status,            source,      problem
      ('22222222-2222-4222-8222-000000000001','general_medicine',  0, 'completed',       'reception', 'Recurring headache and mild fever'),
      ('22222222-2222-4222-8222-000000000002','dermatology',       0, 'in_consultation', 'whatsapp',  'Skin rash on both forearms'),
      ('22222222-2222-4222-8222-000000000003','general_medicine',  0, 'waiting',         'phone',     'Quarterly diabetes review'),
      ('22222222-2222-4222-8222-000000000010','dental',            0, 'arrived',         'walk_in',   'Tooth sensitivity while drinking cold water'),
      ('22222222-2222-4222-8222-000000000005','general_medicine',  0, 'booked',          'website',   'Sore throat and cough for three days'),
      ('22222222-2222-4222-8222-000000000007','general_medicine',  0, 'booked',          'whatsapp',  'Child fever since last night'),
      ('22222222-2222-4222-8222-000000000009','dermatology',       1, 'booked',          'website',   'Hair fall follow-up'),
      ('22222222-2222-4222-8222-000000000006','general_medicine',  1, 'booked',          'reception', 'Monthly blood pressure review'),
      ('22222222-2222-4222-8222-000000000008','dental',            2, 'booked',          'qr',        'Dental scaling appointment'),
      ('22222222-2222-4222-8222-000000000004','dermatology',      -6, 'completed',       'qr',        'Seasonal allergy flare-up'),
      ('22222222-2222-4222-8222-000000000006','general_medicine', -9, 'completed',       'reception', 'Blood pressure review'),
      ('22222222-2222-4222-8222-000000000003','general_medicine',-14, 'completed',       'phone',     'Diabetes review and prescription refill'),
      ('22222222-2222-4222-8222-000000000010','dental',          -20, 'completed',       'walk_in',   'Dental filling'),
      ('22222222-2222-4222-8222-000000000001','general_medicine',-25, 'completed',       'reception', 'Blood pressure and cholesterol review'),
      ('22222222-2222-4222-8222-000000000009','dermatology',      -4, 'cancelled',       'website',   'Rescheduled by patient'),
      ('22222222-2222-4222-8222-000000000007','general_medicine',  -2,'no_show',         'whatsapp',  'Did not attend')
    ) as t(patient_id, dept, day_offset, status, source, problem)
  loop
    v_doctor := case v_row.dept
      when 'dental' then coalesce(v_doc_dental, v_doc_gm)
      when 'dermatology' then coalesce(v_doc_derm, v_doc_gm)
      else v_doc_gm end;

    perform public.ensure_doctor_slots(v_doctor, current_date + v_row.day_offset);

    select * into v_slot
    from public.appointment_slots
    where doctor_id = v_doctor
      and slot_date = current_date + v_row.day_offset
      and booked_count < capacity
      and status = 'available'
    order by start_time
    limit 1;

    continue when v_slot.id is null;

    v_token := v_token + 1;

    insert into public.appointments (clinic_id, branch_id, patient_id, doctor_id, slot_id, token_number,
                                     appointment_date, appointment_time, department, main_problem, source,
                                     status, is_new_patient, created_by, assigned_by, metadata, created_at)
    values (v_clinic, v_branch, v_row.patient_id::uuid, v_doctor, v_slot.id, 'A' || lpad(v_token::text, 3, '0'),
            v_slot.slot_date, v_slot.start_time, v_row.dept, v_row.problem, v_row.source,
            v_row.status, false, v_reception, v_reception,
            jsonb_build_object('demo', true), now() + (v_row.day_offset || ' days')::interval)
    returning id into v_appointment_id;

    update public.appointment_slots
    set booked_count = booked_count + 1,
        status = case when booked_count + 1 >= capacity then 'full' else status end
    where id = v_slot.id;

    insert into public.appointment_status_history (clinic_id, appointment_id, old_status, new_status, changed_by, reason)
    values (v_clinic, v_appointment_id, null, v_row.status, v_reception, 'demo_seed');

    v_slot := null;
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- 10. Consultations, vitals, prescriptions and medicine reminders
-- ---------------------------------------------------------------------
do $$
declare
  v_clinic uuid := current_setting('vernex.clinic_id')::uuid;
  v_branch uuid := current_setting('vernex.branch_id')::uuid;
  v_appointment record;
  v_consultation uuid;
  v_prescription uuid;
  v_doctor_staff uuid;
  v_index int := 0;
  v_diagnosis text;
  v_advice text;
  v_follow_up date;
begin
  for v_appointment in
    select a.*, dp.staff_id
    from public.appointments a
    join public.doctor_profiles dp on dp.id = a.doctor_id
    where a.clinic_id = v_clinic
      and a.metadata->>'demo' = 'true'
      and a.status in ('completed', 'in_consultation')
    order by a.appointment_date
  loop
    v_index := v_index + 1;
    v_doctor_staff := v_appointment.staff_id;

    v_diagnosis := case (v_index % 5)
      when 0 then 'Acute viral pharyngitis'
      when 1 then 'Essential hypertension - controlled'
      when 2 then 'Type 2 diabetes mellitus - review'
      when 3 then 'Allergic contact dermatitis'
      else 'Dental caries with sensitivity' end;

    v_advice := case (v_index % 5)
      when 0 then 'Warm saline gargles, plenty of fluids, rest for 3 days.'
      when 1 then 'Continue current medication. Low salt diet. Home BP log twice weekly.'
      when 2 then 'Continue Metformin. 30 minutes brisk walk daily. Repeat HbA1c in 3 months.'
      when 3 then 'Avoid the suspected allergen. Apply cream twice daily for 2 weeks.'
      else 'Use desensitising toothpaste. Avoid very cold food for 2 weeks.' end;

    v_follow_up := case
      when v_index % 3 = 0 then v_appointment.appointment_date + 7
      when v_index % 3 = 1 then v_appointment.appointment_date + 30
      else null end;

    insert into public.consultations (clinic_id, branch_id, appointment_id, patient_id, doctor_id, symptoms, diagnosis,
                                      clinical_notes, advice, follow_up_date, follow_up_reason, status, created_by,
                                      completed_at, metadata, created_at)
    values (v_clinic, v_branch, v_appointment.id, v_appointment.patient_id, v_appointment.doctor_id,
            v_appointment.main_problem, v_diagnosis,
            'Examination unremarkable apart from the presenting complaint. Vitals stable.',
            v_advice, v_follow_up,
            case when v_follow_up is null then null else 'Review response to treatment' end,
            case when v_appointment.status = 'completed' then 'completed' else 'draft' end,
            v_doctor_staff,
            case when v_appointment.status = 'completed'
                 then (v_appointment.appointment_date + time '10:20')::timestamptz else null end,
            jsonb_build_object('demo', true),
            (v_appointment.appointment_date + time '10:00')::timestamptz)
    returning id into v_consultation;

    insert into public.consultation_vitals (clinic_id, consultation_id, patient_id, height_cm, weight_kg, temperature_c,
                                            blood_pressure, pulse_rate, respiratory_rate, oxygen_saturation, blood_sugar, notes)
    values (v_clinic, v_consultation, v_appointment.patient_id,
            160 + (v_index % 20), 58 + (v_index % 25), 36.6 + ((v_index % 4) * 0.4),
            (110 + (v_index % 20))::text || '/' || (70 + (v_index % 10))::text,
            72 + (v_index % 14), 16 + (v_index % 4), 96 + (v_index % 4),
            (95 + (v_index % 40))::text || ' mg/dL', 'Recorded at check-in.');

    insert into public.consultation_notes (clinic_id, consultation_id, note_type, note, created_by)
    values (v_clinic, v_consultation, 'doctor', 'Patient counselled on the treatment plan and warning signs.', v_doctor_staff);

    -- Only completed consultations get a finalised prescription.
    continue when v_appointment.status <> 'completed';

    insert into public.prescriptions (clinic_id, branch_id, consultation_id, appointment_id, patient_id, doctor_id,
                                      diagnosis_summary, advice, follow_up_date, status, delivery_status, delivery_channel,
                                      send_to_pharmacy, pharmacy_status, created_by, finalized_at, metadata, created_at)
    values (v_clinic, v_branch, v_consultation, v_appointment.id, v_appointment.patient_id, v_appointment.doctor_id,
            v_diagnosis, v_advice, v_follow_up, 'finalized',
            case when v_index % 2 = 0 then 'delivered' else 'sent' end, 'whatsapp',
            -- Sent to pharmacy in section 12b, after the items exist (the pharmacy
            -- order trigger reads the items when send_to_pharmacy turns on).
            false, 'not_sent', v_doctor_staff,
            (v_appointment.appointment_date + time '10:25')::timestamptz,
            jsonb_build_object('demo', true),
            (v_appointment.appointment_date + time '10:25')::timestamptz)
    returning id into v_prescription;

    insert into public.prescription_items (clinic_id, prescription_id, medicine_id, medicine_name, dosage, frequency, timing,
                                           duration, food_instruction, quantity, instructions, sort_order, reminder_enabled,
                                           reminder_frequency, reminder_start_date, reminder_end_date)
    values
      (v_clinic, v_prescription, '33333333-3333-4333-8333-000000000001', 'Paracetamol 650mg', '1 tablet', '1-0-1', 'After food', '3 days', 'after_food', '6', 'Take only if fever is above 100F.', 0, true, 'twice_daily', v_appointment.appointment_date, v_appointment.appointment_date + 3),
      (v_clinic, v_prescription, '33333333-3333-4333-8333-000000000004', 'Pantoprazole 40mg', '1 tablet', '1-0-0', 'Before food', '5 days', 'before_food', '5', 'Take 30 minutes before breakfast.', 1, false, null, null, null);

    insert into public.prescription_delivery_logs (clinic_id, prescription_id, channel, old_status, new_status, message, changed_by)
    values (v_clinic, v_prescription, 'whatsapp', 'queued', 'sent', 'Prescription shared with the patient.', v_doctor_staff);

    -- Active medicine reminders for the two most recent prescriptions.
    if v_appointment.appointment_date >= current_date - 10 then
      insert into public.medicine_reminders (clinic_id, patient_id, prescription_id, medicine_name, dosage, frequency, timing,
                                             start_date, end_date, next_run_at, status, delivery_status, consent_confirmed, created_by, metadata)
      values (v_clinic, v_appointment.patient_id, v_prescription, 'Paracetamol 650mg', '1 tablet', 'twice_daily', 'After food',
              current_date, current_date + 3, (current_date + 1 + time '09:00')::timestamptz,
              'active', 'queued', true, v_doctor_staff, jsonb_build_object('source', 'demo_seed'));
    end if;
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- 11. Pharmacy orders: created in section 12b through the database trigger.
-- ---------------------------------------------------------------------
-- 12. Invoices and collected payments (drives every revenue report)
-- ---------------------------------------------------------------------
do $$
declare
  v_clinic uuid := current_setting('vernex.clinic_id')::uuid;
  v_branch uuid := current_setting('vernex.branch_id')::uuid;
  v_biller uuid;
  v_consultation record;
  v_invoice_id uuid;
  v_invoice_no text;
  v_fee numeric;
  v_paid numeric;
  v_mode text;
  v_index int := 0;
begin
  select sp.id into v_biller from public.staff_profiles sp
  where sp.clinic_id = v_clinic and sp.role_key in ('receptionist','owner') order by sp.role_key limit 1;

  delete from public.invoices where clinic_id = v_clinic and metadata->>'demo' = 'true';

  for v_consultation in
    select c.*, a.appointment_date, dp.consultation_fee
    from public.consultations c
    join public.appointments a on a.id = c.appointment_id
    join public.doctor_profiles dp on dp.id = c.doctor_id
    where c.clinic_id = v_clinic and c.metadata->>'demo' = 'true' and c.status = 'completed'
    order by a.appointment_date
  loop
    v_index := v_index + 1;
    v_fee := coalesce(v_consultation.consultation_fee, 600);

    -- A realistic mix: mostly settled, some partial, one unpaid.
    v_paid := case (v_index % 4)
      when 0 then 0
      when 1 then round(v_fee / 2)
      else v_fee end;

    v_mode := case (v_index % 3) when 0 then 'cash' when 1 then 'upi' else 'card' end;
    v_invoice_no := 'INV-' || to_char(v_consultation.appointment_date, 'YYYYMMDD') || '-' || lpad(v_index::text, 3, '0');

    insert into public.invoices (clinic_id, branch_id, patient_id, appointment_id, consultation_id, invoice_number,
                                 invoice_type, subtotal, discount_amount, tax_amount, total_amount, paid_amount,
                                 balance_amount, payment_status, invoice_status, notes, created_by, metadata, created_at)
    values (v_clinic, v_branch, v_consultation.patient_id, v_consultation.appointment_id, v_consultation.id, v_invoice_no,
            'consultation', v_fee, 0, 0, v_fee, v_paid, v_fee - v_paid,
            case when v_paid = 0 then 'unpaid' when v_paid < v_fee then 'partial' else 'paid' end,
            'issued', 'Consultation charge.', v_biller,
            jsonb_build_object('demo', true),
            (v_consultation.appointment_date + time '11:00')::timestamptz)
    returning id into v_invoice_id;

    insert into public.invoice_items (clinic_id, invoice_id, item_type, description, quantity, unit_price, discount_amount, tax_rate, tax_amount, line_total)
    values (v_clinic, v_invoice_id, 'consultation', 'General Consultation', 1, v_fee, 0, 0, 0, v_fee);

    if v_paid > 0 then
      insert into public.manual_payment_records (clinic_id, branch_id, invoice_id, patient_id, amount, payment_mode, reference_number, payment_note, received_by, received_at)
      values (v_clinic, v_branch, v_invoice_id, v_consultation.patient_id, v_paid, v_mode,
              upper(v_mode) || '-' || lpad(v_index::text, 5, '0'), 'Collected at the front desk.', v_biller,
              (v_consultation.appointment_date + time '11:05')::timestamptz);
    end if;

    insert into public.invoice_status_history (clinic_id, invoice_id, old_status, new_status, old_payment_status, new_payment_status, reason, changed_by)
    values (v_clinic, v_invoice_id, null, 'issued', null,
            case when v_paid = 0 then 'unpaid' when v_paid < v_fee then 'partial' else 'paid' end,
            'demo_seed', v_biller);
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- 12b. Pharmacy activity through the real database functions
-- ---------------------------------------------------------------------
-- Stock adjustments, routed prescriptions, FEFO dispensing, prescription bills
-- and counter sales are all created by calling the same RPCs the app uses, so
-- the demo data obeys the same rules (stock movements, statuses, totals).
-- Those RPCs check the signed-in staff member through auth.uid(). The SQL
-- editor has no session, so this block acts as the demo pharmacist by setting
-- the JWT claim PostgREST would set - for this transaction only, cleared again
-- at the end. Timestamps are then moved back to the simulated day and time.
-- Requires the Phase 16 migrations (20261013120000 ... 20261013123000).

create or replace function pg_temp.mid(n int) returns uuid language sql immutable as
  $$ select ('33333333-3333-4333-8333-' || lpad(n::text, 12, '0'))::uuid $$;
create or replace function pg_temp.pid(n int) returns uuid language sql immutable as
  $$ select ('22222222-2222-4222-8222-' || lpad(n::text, 12, '0'))::uuid $$;
-- A wall-clock time in the clinic's time zone, `days_ago` days before today (IST).
create or replace function pg_temp.ist_at(days_ago int, at_time time) returns timestamptz language sql stable as
  $$ select (((now() at time zone 'Asia/Kolkata')::date - days_ago) + at_time) at time zone 'Asia/Kolkata' $$;
-- Today, `minutes_ago` minutes before now, but never before today's IST midnight.
create or replace function pg_temp.today_at(minutes_ago int) returns timestamptz language sql stable as
  $$ select greatest(now() - make_interval(mins => minutes_ago), (((now() at time zone 'Asia/Kolkata')::date)::timestamp + time '00:05') at time zone 'Asia/Kolkata') $$;

-- Rows written by an RPC in this transaction carry created_at = now(); these
-- helpers move exactly those rows to the simulated time.
create or replace function pg_temp.seed_adjust(p_batch text, p_medicine int, p_type text, p_qty int, p_reason text, p_at timestamptz)
returns void language plpgsql as $$
declare v_batch uuid;
begin
  select id into v_batch from public.medicine_stock_batches where medicine_id = pg_temp.mid(p_medicine) and batch_no = p_batch;
  perform public.adjust_medicine_stock(jsonb_build_object('batch_id', v_batch, 'movement_type', p_type, 'quantity', p_qty, 'reason', p_reason));
  update public.stock_movements set created_at = p_at where batch_id = v_batch and movement_type = p_type and created_at = now();
end $$;

create or replace function pg_temp.seed_route(p_rx uuid, p_at timestamptz)
returns uuid language plpgsql as $$
declare v_order uuid;
begin
  -- Turning send_to_pharmacy on fires the Task 7 trigger, which creates the order and matches medicines.
  update public.prescriptions
  set send_to_pharmacy = true,
      pharmacy_status = case when pharmacy_status = 'not_sent' then 'sent_to_pharmacy' else pharmacy_status end
  where id = p_rx;
  select id into v_order from public.pharmacy_orders where prescription_id = p_rx;
  update public.pharmacy_orders set created_at = p_at, updated_at = p_at where id = v_order;
  insert into public.prescription_delivery_logs (clinic_id, prescription_id, channel, old_status, new_status, message, changed_by, created_at)
  select clinic_id, id, 'pharmacy', 'not_sent', 'sent_to_pharmacy', 'Prescription sent to pharmacy', created_by, p_at from public.prescriptions where id = p_rx;
  return v_order;
end $$;

-- Dispense the open items of an order FEFO (only the first one when p_first_only).
create or replace function pg_temp.seed_dispense(p_order uuid, p_at timestamptz, p_first_only boolean default false)
returns void language plpgsql as $$
declare
  v_item record;
  v_batch uuid;
  v_items jsonb := '[]'::jsonb;
  v_today date := (now() at time zone 'Asia/Kolkata')::date;
begin
  for v_item in
    select poi.* from public.pharmacy_order_items poi
    left join public.prescription_items pi on pi.id = poi.prescription_item_id
    where poi.pharmacy_order_id = p_order and poi.status in ('pending', 'partial') and poi.medicine_id is not null
    order by pi.sort_order nulls last, poi.medicine_name
  loop
    select b.id into v_batch from public.medicine_stock_batches b
    where b.medicine_id = v_item.medicine_id and coalesce(b.status, 'active') = 'active'
      and b.quantity_available >= v_item.requested_quantity - v_item.dispensed_quantity
      and (b.expiry_date is null or b.expiry_date >= v_today)
    order by b.expiry_date nulls last, b.created_at
    limit 1;
    continue when v_batch is null;
    v_items := v_items || jsonb_build_array(jsonb_build_object('order_item_id', v_item.id, 'batch_id', v_batch, 'quantity', v_item.requested_quantity - v_item.dispensed_quantity));
    v_batch := null;
    exit when p_first_only;
  end loop;
  if jsonb_array_length(v_items) = 0 then return; end if;
  perform public.dispense_pharmacy_order(jsonb_build_object('order_id', p_order, 'items', v_items));
  update public.pharmacy_orders set dispensed_at = case when status = 'dispensed' then p_at else dispensed_at end, updated_at = p_at where id = p_order;
  update public.stock_movements set created_at = p_at where reference_type = 'pharmacy_order' and reference_id = p_order and created_at = now();
end $$;

-- Pharmacy bill for a dispensed order, paid in full.
create or replace function pg_temp.seed_bill(p_order uuid, p_at timestamptz, p_mode text, p_seq int)
returns void language plpgsql as $$
declare v_invoice public.invoices;
begin
  if not exists (select 1 from public.pharmacy_order_items where pharmacy_order_id = p_order and dispensed_quantity > 0) then
    return;
  end if;
  v_invoice := public.create_invoice_from_pharmacy_order(p_order);
  if v_invoice.total_amount > 0 then
    perform public.record_manual_payment(jsonb_build_object('invoice_id', v_invoice.id, 'amount', v_invoice.total_amount, 'payment_mode', p_mode,
      'payment_note', 'Collected at the pharmacy counter.', 'received_at', p_at + interval '2 minutes'));
  end if;
  update public.invoices
  set created_at = p_at,
      invoice_number = 'PH-' || to_char(p_at at time zone 'Asia/Kolkata', 'YYYYMMDD') || '-' || lpad(p_seq::text, 3, '0'),
      metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object('demo', true, 'payment_mode', p_mode)
  where id = v_invoice.id;
end $$;

-- Counter sale through create_pharmacy_counter_sale. p_items: [[medicine_no, quantity], ...]
create or replace function pg_temp.seed_sale(p_at timestamptz, p_patient int, p_mode text, p_items jsonb, p_discount numeric, p_seq int)
returns void language plpgsql as $$
declare v_result jsonb; v_invoice uuid;
begin
  v_result := public.create_pharmacy_counter_sale(jsonb_build_object(
    'patient_id', pg_temp.pid(p_patient), 'payment_mode', p_mode, 'discount_amount', p_discount,
    'items', (select jsonb_agg(jsonb_build_object('medicine_id', pg_temp.mid((x->>0)::int), 'quantity', (x->>1)::int)) from jsonb_array_elements(p_items) x)));
  v_invoice := (v_result->>'invoice_id')::uuid;
  update public.invoices
  set created_at = p_at,
      invoice_number = 'PH-' || to_char(p_at at time zone 'Asia/Kolkata', 'YYYYMMDD') || '-' || lpad(p_seq::text, 3, '0'),
      metadata = metadata || jsonb_build_object('demo', true)
  where id = v_invoice;
  update public.manual_payment_records set received_at = p_at where invoice_id = v_invoice;
  update public.stock_movements set created_at = p_at where reference_type = 'pharmacy_counter_sale' and reference_id = v_invoice;
end $$;

-- A finalized prescription with catalogue items (not yet sent to pharmacy).
-- p_items: [[medicine_no, quantity], ...]; a medicine_no of 0 means p_extra_name (not in the catalogue).
create or replace function pg_temp.seed_prescription(p_patient int, p_doctor uuid, p_diagnosis text, p_items jsonb, p_at timestamptz, p_extra_name text default null)
returns uuid language plpgsql as $$
declare
  v_rx uuid;
  v_doctor_staff uuid;
  x jsonb;
  v_index int := 0;
  v_name text;
begin
  select staff_id into v_doctor_staff from public.doctor_profiles where id = p_doctor;
  insert into public.prescriptions (clinic_id, branch_id, patient_id, doctor_id, diagnosis_summary, advice, status, delivery_status, delivery_channel,
                                    send_to_pharmacy, pharmacy_status, created_by, finalized_at, metadata, created_at)
  values (current_setting('vernex.clinic_id')::uuid, current_setting('vernex.branch_id')::uuid, pg_temp.pid(p_patient), p_doctor, p_diagnosis,
          'Take medicines as directed. Return if symptoms persist.', 'finalized', 'queued', 'pharmacy',
          false, 'not_sent', v_doctor_staff, p_at, jsonb_build_object('demo', true), p_at)
  returning id into v_rx;
  for x in select * from jsonb_array_elements(p_items) loop
    if (x->>0)::int = 0 then
      v_name := p_extra_name;
    else
      select name into v_name from public.medicines where id = pg_temp.mid((x->>0)::int);
    end if;
    insert into public.prescription_items (clinic_id, prescription_id, medicine_id, medicine_name, dosage, frequency, timing, duration, food_instruction, quantity, sort_order)
    values (current_setting('vernex.clinic_id')::uuid, v_rx, case when (x->>0)::int = 0 then null else pg_temp.mid((x->>0)::int) end, v_name,
            '1 tablet', '1-0-1', 'After food', ((x->>1)::int / 2 + 1)::text || ' days', 'after_food', (x->>1)::text, v_index);
    v_index := v_index + 1;
  end loop;
  return v_rx;
end $$;

do $$
declare
  v_clinic uuid := current_setting('vernex.clinic_id')::uuid;
  v_branch uuid := current_setting('vernex.branch_id')::uuid;
  v_actor uuid;
  v_doctors uuid[];
  v_doctor_count int;
  v_rx uuid;
  v_order uuid;
  v_row record;
  v_seq int := 0;
  v_i int := 0;
  v_modes text[] := array['cash', 'upi', 'card'];
begin
  if to_regprocedure('public._ensure_pharmacy_order(uuid)') is null or to_regprocedure('public.create_pharmacy_counter_sale(jsonb)') is null then
    raise exception 'The Phase 16 pharmacy migrations are not applied. Apply every file in supabase/migrations, then run this seed again.';
  end if;

  select id into v_actor from public.staff_profiles where clinic_id = v_clinic and role_key = 'pharmacist' and status = 'active' order by created_at limit 1;
  if v_actor is null then
    select id into v_actor from public.staff_profiles where clinic_id = v_clinic and role_key in ('owner', 'admin') and status = 'active' order by role_key desc, created_at limit 1;
  end if;
  select array_agg(id order by department, created_at) into v_doctors from public.doctor_profiles where clinic_id = v_clinic and status = 'active';
  v_doctor_count := coalesce(array_length(v_doctors, 1), 0);

  if v_actor is null then
    -- No staff session to act as: keep the stock, write the low-stock alerts directly, skip the activity.
    raise notice 'No pharmacist or owner profile in the demo clinic - pharmacy activity skipped.';
    insert into public.low_stock_alerts (clinic_id, branch_id, medicine_id, current_stock, reorder_level, status)
    select m.clinic_id, v_branch, m.id,
           coalesce(sum(b.quantity_available) filter (where b.status = 'active'), 0)::int, coalesce(m.reorder_level, 0), 'active'
    from public.medicines m
    left join public.medicine_stock_batches b on b.medicine_id = m.id and b.clinic_id = m.clinic_id
    where m.clinic_id = v_clinic and m.status = 'active'
    group by m.id, m.clinic_id, m.reorder_level
    having coalesce(sum(b.quantity_available) filter (where b.status = 'active'), 0)::int <= coalesce(m.reorder_level, 0)
       and coalesce(m.reorder_level, 0) > 0;
    return;
  end if;

  perform set_config('request.jwt.claim.sub', v_actor::text, true);

  -- 1. Stock adjustments with reasons (three of them leave a medicine out of stock).
  perform pg_temp.seed_adjust('RNT-S02', 19, 'damage',      40, 'Whole carton crushed in transit; supplier informed for credit note.', pg_temp.ist_at(30, time '10:15'));
  perform pg_temp.seed_adjust('MUP-E02', 31, 'remove_stock', 15, 'Returned to Apollo Wholesale: wrong pack size supplied.',          pg_temp.ist_at(18, time '17:40'));
  perform pg_temp.seed_adjust('SUN-F01', 32, 'correction',   10, 'Physical count found none on shelf; earlier entry was duplicated.', pg_temp.ist_at(3,  time '19:05'));
  perform pg_temp.seed_adjust('CMB-O01', 15, 'expired',       6, 'Expired strips removed from the shelf for disposal.',              pg_temp.ist_at(4,  time '09:20'));
  perform pg_temp.seed_adjust('PCM-A21',  1, 'damage',        4, 'Strip torn during counting.',                                      pg_temp.ist_at(9,  time '12:10'));
  perform pg_temp.seed_adjust('ORS-I17',  9, 'correction',    5, 'Monthly stock audit recount.',                                     pg_temp.ist_at(6,  time '18:30'));

  if v_doctor_count = 0 then
    raise notice 'No doctor profile in the demo clinic - prescriptions skipped.';
  else
    -- 2. Prescriptions from the consultations seeded above: past ones dispensed and billed, today's stays pending.
    for v_row in
      select p.id, p.created_at from public.prescriptions p
      where p.clinic_id = v_clinic and p.metadata->>'demo' = 'true' and p.consultation_id is not null and not p.send_to_pharmacy
      order by p.created_at
    loop
      v_order := pg_temp.seed_route(v_row.id, least(v_row.created_at + interval '5 minutes', now()));
      -- Same calendar the appointments above were dated with (current_date), so
      -- "today's" consultation always stays in today's queue.
      if v_row.created_at::date < current_date and v_order is not null then
        perform pg_temp.seed_dispense(v_order, v_row.created_at + interval '25 minutes');
        v_seq := v_seq + 1;
        perform pg_temp.seed_bill(v_order, v_row.created_at + interval '27 minutes', v_modes[1 + v_seq % 3], v_seq);
      end if;
    end loop;

    -- 3. Sixteen more prescriptions over the last 13 days, dispensed (dispensed_by = the pharmacist) and billed.
    for v_row in
      select * from (values
        ( 1,  2, 'Viral fever',                      '[[14,9],[3,5]]'),
        ( 1,  8, 'Acute gastritis',                  '[[17,10],[9,6]]'),
        ( 2,  3, 'Hypertension review',              '[[23,30],[25,30]]'),
        ( 3,  5, 'Upper respiratory infection',      '[[11,3],[20,10]]'),
        ( 3,  9, 'Type 2 diabetes review',           '[[5,60],[24,30]]'),
        ( 4,  4, 'Allergic rhinitis',                '[[21,10],[20,10]]'),
        ( 5,  6, 'Dyslipidaemia',                    '[[24,30],[25,30]]'),
        ( 6,  1, 'Acute pharyngitis',                '[[12,10],[1,6]]'),
        ( 6,  7, 'Paediatric diarrhoea',             '[[9,8],[36,4]]'),
        ( 7, 10, 'Dental pain after extraction',     '[[15,6],[7,1]]'),
        ( 8,  8, 'Vitamin deficiency',               '[[33,30],[35,30]]'),
        ( 9,  2, 'Acid reflux',                      '[[38,14],[4,10]]'),
        (10,  4, 'Contact dermatitis',               '[[30,1],[21,10]]'),
        (11,  6, 'Hypertension with dyslipidaemia',  '[[23,30],[24,30]]'),
        (12,  3, 'Seasonal fever',                   '[[1,9],[34,10]]'),
        (13,  9, 'Lower back strain',                '[[16,1],[14,6]]')
      ) as t(days_ago, patient_no, diagnosis, items)
    loop
      v_i := v_i + 1;
      v_rx := pg_temp.seed_prescription(v_row.patient_no, v_doctors[1 + v_i % v_doctor_count], v_row.diagnosis, v_row.items::jsonb,
                                        pg_temp.ist_at(v_row.days_ago, time '10:00' + make_interval(mins => 23 * v_i)));
      v_order := pg_temp.seed_route(v_rx, pg_temp.ist_at(v_row.days_ago, time '10:05' + make_interval(mins => 23 * v_i)));
      perform pg_temp.seed_dispense(v_order, pg_temp.ist_at(v_row.days_ago, time '10:30' + make_interval(mins => 23 * v_i)));
      v_seq := v_seq + 1;
      perform pg_temp.seed_bill(v_order, pg_temp.ist_at(v_row.days_ago, time '10:32' + make_interval(mins => 23 * v_i)), v_modes[1 + v_seq % 3], v_seq);
    end loop;

    -- 4. Today's queue: five more routed prescriptions (plus today's consultation above = six pending orders).
    --    One has a medicine that is not in the catalogue, one has an out-of-stock medicine (Rantac 150),
    --    one is partially dispensed.
    v_rx := pg_temp.seed_prescription(1, v_doctors[1], 'Acute bronchitis', '[[1,6],[4,5],[0,1]]', pg_temp.today_at(200), 'Herbal Cough Lozenges');
    perform pg_temp.seed_route(v_rx, pg_temp.today_at(198));
    v_rx := pg_temp.seed_prescription(3, v_doctors[1 + 1 % v_doctor_count], 'Dyspepsia', '[[19,10],[17,10]]', pg_temp.today_at(150));
    perform pg_temp.seed_route(v_rx, pg_temp.today_at(148));
    v_rx := pg_temp.seed_prescription(5, v_doctors[1 + 2 % v_doctor_count], 'Tonsillitis', '[[11,3],[3,5]]', pg_temp.today_at(95));
    v_order := pg_temp.seed_route(v_rx, pg_temp.today_at(93));
    perform pg_temp.seed_dispense(v_order, pg_temp.today_at(60), true);
    v_rx := pg_temp.seed_prescription(6, v_doctors[1], 'Hypertension and dyslipidaemia review', '[[5,60],[23,30],[24,30]]', pg_temp.today_at(40));
    perform pg_temp.seed_route(v_rx, pg_temp.today_at(38));
    v_rx := pg_temp.seed_prescription(7, v_doctors[1 + 1 % v_doctor_count], 'Viral fever with cough', '[[14,6],[20,5],[9,4]]', pg_temp.today_at(12));
    perform pg_temp.seed_route(v_rx, pg_temp.today_at(10));
  end if;

  -- 5. Counter sales across the last 14 days (cash / UPI / card); five of them today.
  for v_row in
    select * from (values
      (13, '17:10', 2, 'cash', '[[1,10]]',           0),
      (13, '19:25', 4, 'upi',  '[[3,10],[21,10]]',   0),
      (12, '11:40', 6, 'card', '[[25,30]]',          0),
      (11, '16:05', 8, 'cash', '[[33,30]]',          5),
      (10, '18:20', 9, 'upi',  '[[14,10],[9,4]]',    0),
      ( 9, '12:15', 1, 'upi',  '[[4,10]]',           0),
      ( 8, '17:55', 3, 'cash', '[[5,30]]',           0),
      ( 7, '10:45', 5, 'card', '[[7,1]]',            0),
      ( 7, '19:30', 7, 'upi',  '[[36,3],[9,2]]',     0),
      ( 6, '13:20', 2, 'cash', '[[38,14]]',          0),
      ( 5, '18:40', 4, 'upi',  '[[20,10]]',          0),
      ( 4, '11:10', 6, 'card', '[[23,30],[24,30]]', 10),
      ( 3, '16:30', 8, 'cash', '[[35,30]]',          0),
      ( 3, '20:05', 10, 'upi', '[[1,6],[17,10]]',    0),
      ( 2, '12:50', 9, 'cash', '[[14,10]]',          0),
      ( 2, '18:15', 1, 'card', '[[12,6]]',           0),
      ( 1, '10:25', 3, 'upi',  '[[11,3]]',           0),
      ( 1, '15:35', 5, 'cash', '[[34,10],[33,15]]',  0),
      ( 1, '19:50', 7, 'upi',  '[[4,10],[1,10]]',    0),
      ( 0, null,    2, 'upi',  '[[14,10]]',          0),
      ( 0, null,    4, 'cash', '[[3,5],[9,3]]',      0),
      ( 0, null,    6, 'card', '[[25,30],[33,30]]',  0),
      ( 0, null,    8, 'upi',  '[[38,14]]',          0),
      ( 0, null,   10, 'cash', '[[7,1],[1,6]]',      0)
    ) as t(days_ago, at_time, patient_no, mode, items, discount)
  loop
    v_seq := v_seq + 1;
    perform pg_temp.seed_sale(
      case when v_row.days_ago = 0 then pg_temp.today_at(5 + 9 * v_seq % 180) else pg_temp.ist_at(v_row.days_ago, v_row.at_time::time) end,
      v_row.patient_no, v_row.mode, v_row.items::jsonb, v_row.discount, v_seq);
  end loop;

  -- 6. Alerts from the final stock, then stop acting as the pharmacist.
  perform public.refresh_low_stock_alerts(v_clinic, v_branch);
  perform set_config('request.jwt.claim.sub', '', true);
end $$;

-- One refund in each state so the Refunds screen is demonstrable.
do $$
declare
  v_clinic uuid := current_setting('vernex.clinic_id')::uuid;
  v_staff uuid;
  v_invoice record;
  v_index int := 0;
begin
  select sp.id into v_staff from public.staff_profiles sp where sp.clinic_id = v_clinic and sp.role_key = 'owner' limit 1;
  delete from public.invoice_refunds where clinic_id = v_clinic;

  for v_invoice in
    select * from public.invoices
    where clinic_id = v_clinic and payment_status = 'paid' and metadata->>'demo' = 'true'
    order by created_at desc limit 3
  loop
    v_index := v_index + 1;
    insert into public.invoice_refunds (clinic_id, branch_id, invoice_id, patient_id, original_amount, refund_amount,
                                        refund_mode, reason, status, requested_by, approved_by, processed_at)
    values (v_clinic, v_invoice.branch_id, v_invoice.id, v_invoice.patient_id, v_invoice.total_amount,
            round(v_invoice.total_amount / 2), 'upi',
            case v_index when 1 then 'Consultation cancelled after payment.'
                         when 2 then 'Duplicate payment collected at the counter.'
                         else 'Service not delivered as scheduled.' end,
            case v_index when 1 then 'requested' when 2 then 'approved' else 'processed' end,
            v_staff,
            case when v_index = 1 then null else v_staff end,
            case when v_index = 3 then now() - interval '1 day' else null end);
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- 13. WhatsApp templates, conversations and consents
-- ---------------------------------------------------------------------
insert into public.whatsapp_templates (clinic_id, name, category, status, body, variables)
values
  (current_setting('vernex.clinic_id')::uuid, 'Welcome - Multi-speciality', 'booking', 'active',
   'Welcome to {{clinic_name}}. What type of care do you need? Reply with a department name.', '["{{clinic_name}}"]'),
  (current_setting('vernex.clinic_id')::uuid, 'Booking Confirmation', 'booking', 'active',
   'Hello {{patient_name}}, your appointment with {{doctor_name}} is confirmed for {{appointment_date}} at {{appointment_time}}. Token {{token}}.',
   '["{{patient_name}}","{{doctor_name}}","{{appointment_date}}","{{appointment_time}}","{{token}}"]'),
  (current_setting('vernex.clinic_id')::uuid, 'Appointment Reminder', 'reminder', 'active',
   'Reminder: {{patient_name}}, your appointment with {{doctor_name}} is tomorrow at {{appointment_time}}.',
   '["{{patient_name}}","{{doctor_name}}","{{appointment_time}}"]'),
  (current_setting('vernex.clinic_id')::uuid, 'Medicine Reminder', 'reminder', 'active',
   'Hello {{patient_name}}, time to take {{medicine_name}} ({{dosage}}).', '["{{patient_name}}","{{medicine_name}}","{{dosage}}"]'),
  (current_setting('vernex.clinic_id')::uuid, 'Prescription Delivery', 'prescription', 'needs_api_approval',
   'Hello {{patient_name}}, your prescription from {{doctor_name}} is attached.', '["{{patient_name}}","{{doctor_name}}"]'),
  (current_setting('vernex.clinic_id')::uuid, 'Payment Receipt', 'invoice', 'active',
   'Hello {{patient_name}}, we received {{amount}} against bill {{invoice_number}}. Thank you.',
   '["{{patient_name}}","{{amount}}","{{invoice_number}}"]'),
  (current_setting('vernex.clinic_id')::uuid, 'Follow-up Reminder', 'follow_up', 'active',
   'Hello {{patient_name}}, your follow-up with {{doctor_name}} is due on {{follow_up_date}}.',
   '["{{patient_name}}","{{doctor_name}}","{{follow_up_date}}"]'),
  (current_setting('vernex.clinic_id')::uuid, 'Cancellation Notice', 'cancellation', 'draft',
   'Hello {{patient_name}}, your appointment on {{appointment_date}} has been cancelled. Reason: {{reason}}.',
   '["{{patient_name}}","{{appointment_date}}","{{reason}}"]')
on conflict (clinic_id, name) do update set
  category = excluded.category, status = excluded.status, body = excluded.body, variables = excluded.variables;

do $$
declare
  v_clinic uuid := current_setting('vernex.clinic_id')::uuid;
  v_branch uuid := current_setting('vernex.branch_id')::uuid;
  v_conversation uuid;
  v_row record;
  v_message record;
begin
  delete from public.whatsapp_conversations where clinic_id = v_clinic and metadata->>'demo' = 'true';

  for v_row in
    select * from (values
      ('22222222-2222-4222-8222-000000000002', '+919845022331', 'Meera Krishnan',  'appointment_confirmed',    'confirmed',            'Appointment confirmed. Token A002.'),
      ('22222222-2222-4222-8222-000000000007', '+919966554433', 'Kavya Reddy',     'in_progress',              'collect_patient_details','Please share the patient age.'),
      ('22222222-2222-4222-8222-000000000008', '+919723344557', 'Imran Qureshi',   'waiting_for_patient',      'select_slot',           'Please choose a time slot.'),
      ('22222222-2222-4222-8222-000000000009', '+919656778899', 'Divya Menon',     'transferred_to_reception', 'transferred',           'Transferred to reception for a special request.'),
      (null,                                    '+919000011122', 'Unknown caller',  'new',                      'welcome',               'Hi')
    ) as t(patient_id, phone, patient_name, status, step, last_message)
  loop
    insert into public.whatsapp_conversations (clinic_id, branch_id, patient_id, phone_number, status, source, current_step, last_message, metadata)
    values (v_clinic, v_branch, v_row.patient_id::uuid, v_row.phone, v_row.status, 'whatsapp', v_row.step, v_row.last_message,
            jsonb_build_object('demo', true, 'patientName', v_row.patient_name))
    returning id into v_conversation;

    for v_message in
      select * from (values
        (1, 'inbound',  'patient', 'Hi'),
        (2, 'outbound', 'bot',     'Welcome to Vernex Multispeciality Clinic. Reply 1 to book an appointment, 2 to view an appointment, 3 to talk to reception.'),
        (3, 'inbound',  'patient', '1'),
        (4, 'outbound', 'bot',     'Please choose a department: General Medicine, Dental, Dermatology.')
      ) as m(seq, direction, sender, body)
    loop
      insert into public.whatsapp_messages (clinic_id, branch_id, conversation_id, patient_id, phone_number, status, direction,
                                            sender_type, message_type, body, delivery_status, metadata, created_at)
      values (v_clinic, v_branch, v_conversation, v_row.patient_id::uuid, v_row.phone,
              case when v_message.direction = 'inbound' then 'received' else 'delivered' end,
              v_message.direction, v_message.sender, 'text', v_message.body,
              case when v_message.direction = 'inbound' then 'received' else 'delivered' end,
              jsonb_build_object('demo', true), now() - ((10 - v_message.seq) || ' minutes')::interval);
    end loop;

    insert into public.whatsapp_patient_consents (clinic_id, branch_id, patient_id, phone_number, consent_status, consent_source, consented_at)
    values (v_clinic, v_branch, v_row.patient_id::uuid, v_row.phone, 'opted_in', 'patient', now() - interval '2 days')
    on conflict (clinic_id, phone_number) do update set consent_status = 'opted_in';
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- 14. Monitoring samples so the Monitoring screen has rows
-- ---------------------------------------------------------------------
do $$
declare
  v_clinic uuid := current_setting('vernex.clinic_id')::uuid;
  v_actor uuid;
begin
  select id into v_actor from public.staff_profiles where clinic_id = v_clinic and role_key = 'owner' limit 1;

  insert into public.system_health_checks (clinic_id, event_type, status, message, metadata, created_at)
  values
    (v_clinic, 'health_check', 'ok', 'Database reachable.', '{"latency_ms": 42}', now() - interval '2 hours'),
    (v_clinic, 'health_check', 'ok', 'Storage reachable.', '{"latency_ms": 88}', now() - interval '1 hour'),
    (v_clinic, 'health_check', 'degraded', 'WhatsApp provider not connected.', '{"provider": "meta_cloud_api"}', now() - interval '30 minutes');

  insert into public.audit_logs (clinic_id, actor_id, user_id, event_type, entity_type, action, status, severity, message, metadata, created_at)
  values
    (v_clinic, v_actor, v_actor, 'appointment_created', 'appointments', 'create', 'success', 'info', 'Appointment created from reception.', '{"demo": true}', now() - interval '3 hours'),
    (v_clinic, v_actor, v_actor, 'invoice_created', 'invoices', 'create', 'success', 'info', 'Consultation invoice issued.', '{"demo": true}', now() - interval '2 hours'),
    (v_clinic, v_actor, v_actor, 'prescription_created', 'prescriptions', 'create', 'success', 'info', 'Prescription finalised and routed to pharmacy.', '{"demo": true}', now() - interval '1 hour');
exception when others then
  raise notice 'Monitoring seed skipped: %', sqlerrm;
end $$;

-- ---------------------------------------------------------------------
-- 15. Support tickets
-- ---------------------------------------------------------------------
do $$
declare
  v_clinic uuid := current_setting('vernex.clinic_id')::uuid;
  v_owner uuid;
begin
  select id into v_owner from public.staff_profiles where clinic_id = v_clinic and role_key = 'owner' limit 1;
  delete from public.support_tickets where clinic_id = v_clinic;

  insert into public.support_tickets (clinic_id, subject, description, category, priority, status, raised_by)
  values
    (v_clinic, 'WhatsApp provider connection', 'Need help connecting the official WhatsApp Business API.', 'whatsapp', 'high', 'open', v_owner),
    (v_clinic, 'Add a second branch', 'We are opening a Koramangala branch next month.', 'technical', 'normal', 'in_progress', v_owner),
    (v_clinic, 'Invoice numbering format', 'Can invoice numbers include the branch code?', 'billing', 'low', 'resolved', v_owner);
end $$;

commit;

-- ---------------------------------------------------------------------
-- Summary
-- ---------------------------------------------------------------------
select 'clinics' as entity, count(*) from public.clinics where slug = 'vernex-demo-clinic'
union all select 'staff_profiles', count(*) from public.staff_profiles where clinic_id = current_setting('vernex.clinic_id')::uuid
union all select 'doctor_profiles', count(*) from public.doctor_profiles where clinic_id = current_setting('vernex.clinic_id')::uuid
union all select 'clinic_services', count(*) from public.clinic_services where clinic_id = current_setting('vernex.clinic_id')::uuid
union all select 'patients', count(*) from public.patients where clinic_id = current_setting('vernex.clinic_id')::uuid
union all select 'appointment_slots', count(*) from public.appointment_slots where clinic_id = current_setting('vernex.clinic_id')::uuid
union all select 'appointments', count(*) from public.appointments where clinic_id = current_setting('vernex.clinic_id')::uuid
union all select 'consultations', count(*) from public.consultations where clinic_id = current_setting('vernex.clinic_id')::uuid
union all select 'prescriptions', count(*) from public.prescriptions where clinic_id = current_setting('vernex.clinic_id')::uuid
union all select 'medicines', count(*) from public.medicines where clinic_id = current_setting('vernex.clinic_id')::uuid
union all select 'stock_batches', count(*) from public.medicine_stock_batches where clinic_id = current_setting('vernex.clinic_id')::uuid
union all select 'stock_purchases', count(*) from public.stock_purchases where clinic_id = current_setting('vernex.clinic_id')::uuid
union all select 'stock_movements', count(*) from public.stock_movements where clinic_id = current_setting('vernex.clinic_id')::uuid
union all select 'low_stock_alerts (active)', count(*) from public.low_stock_alerts where clinic_id = current_setting('vernex.clinic_id')::uuid and status = 'active'
union all select 'pharmacy_orders: ' || coalesce(status, 'unknown'), count(*) from public.pharmacy_orders where clinic_id = current_setting('vernex.clinic_id')::uuid group by status
union all select 'pharmacy invoices', count(*) from public.invoices where clinic_id = current_setting('vernex.clinic_id')::uuid and invoice_type = 'pharmacy'
union all select 'pharmacy invoices today (IST)', count(*) from public.invoices where clinic_id = current_setting('vernex.clinic_id')::uuid and invoice_type = 'pharmacy'
  and created_at >= ((now() at time zone 'Asia/Kolkata')::date)::timestamp at time zone 'Asia/Kolkata'
union all select 'invoices (all types)', count(*) from public.invoices where clinic_id = current_setting('vernex.clinic_id')::uuid
union all select 'payments', count(*) from public.manual_payment_records where clinic_id = current_setting('vernex.clinic_id')::uuid
union all select 'refunds', count(*) from public.invoice_refunds where clinic_id = current_setting('vernex.clinic_id')::uuid
union all select 'whatsapp_templates', count(*) from public.whatsapp_templates where clinic_id = current_setting('vernex.clinic_id')::uuid
union all select 'whatsapp_conversations', count(*) from public.whatsapp_conversations where clinic_id = current_setting('vernex.clinic_id')::uuid
order by 1;
