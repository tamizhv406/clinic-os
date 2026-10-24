create table if not exists public.patients (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  branch_id uuid references public.branches(id) on delete set null,
  patient_code text,
  full_name text not null,
  phone text not null,
  whatsapp_number text,
  email text,
  age int,
  gender text check (gender in ('male','female','other')),
  date_of_birth date,
  blood_group text,
  address text,
  emergency_contact_name text,
  emergency_contact_phone text,
  allergies text,
  medical_history text,
  existing_conditions text,
  current_medications text,
  source text default 'reception' check (source in ('whatsapp','qr','website','phone','walk_in','reception')),
  whatsapp_consent boolean default false,
  reminder_consent boolean default false,
  status text default 'active' check (status in ('active','inactive','archived')),
  metadata jsonb default '{}',
  created_by uuid references public.staff_profiles(id) on delete set null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.patient_family_members (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  primary_patient_id uuid not null references public.patients(id) on delete cascade,
  linked_patient_id uuid not null references public.patients(id) on delete cascade,
  relationship text,
  created_at timestamptz default now(),
  unique(primary_patient_id, linked_patient_id)
);

create table if not exists public.patient_notes (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  patient_id uuid not null references public.patients(id) on delete cascade,
  note text not null,
  visibility text default 'internal' check (visibility in ('internal','doctor','reception')),
  created_by uuid references public.staff_profiles(id) on delete set null,
  created_at timestamptz default now()
);

create index if not exists idx_patients_clinic_id on public.patients(clinic_id);
create index if not exists idx_patients_branch_id on public.patients(branch_id);
create index if not exists idx_patients_phone on public.patients(phone);
create index if not exists idx_patients_whatsapp_number on public.patients(whatsapp_number);
create index if not exists idx_patients_full_name on public.patients(full_name);
create index if not exists idx_patients_patient_code on public.patients(patient_code);
create index if not exists idx_patient_family_members_clinic_id on public.patient_family_members(clinic_id);
create index if not exists idx_patient_family_members_primary_patient_id on public.patient_family_members(primary_patient_id);
create index if not exists idx_patient_notes_clinic_id on public.patient_notes(clinic_id);
create index if not exists idx_patient_notes_patient_id on public.patient_notes(patient_id);

drop trigger if exists set_patients_updated_at on public.patients;
create trigger set_patients_updated_at before update on public.patients
for each row execute function public.set_updated_at();

alter table public.patients enable row level security;
alter table public.patient_family_members enable row level security;
alter table public.patient_notes enable row level security;

create policy "super_admin_manage_patients" on public.patients
for all to authenticated
using (public.is_super_admin())
with check (public.is_super_admin());

create policy "staff_view_own_clinic_patients" on public.patients
for select to authenticated
using (clinic_id = public.current_clinic_id());

create policy "staff_create_own_clinic_patients" on public.patients
for insert to authenticated
with check (
  clinic_id = public.current_clinic_id()
  and public.has_permission('patients.create')
);

create policy "staff_update_own_clinic_patients" on public.patients
for update to authenticated
using (
  clinic_id = public.current_clinic_id()
  and (
    public.has_permission('patients.edit')
    or public.has_permission('patients.manage')
    or public.has_permission('patients.delete')
  )
)
with check (
  clinic_id = public.current_clinic_id()
  and (
    public.has_permission('patients.edit')
    or public.has_permission('patients.manage')
    or public.has_permission('patients.delete')
  )
);

create policy "staff_delete_own_clinic_patients" on public.patients
for delete to authenticated
using (
  clinic_id = public.current_clinic_id()
  and (
    public.has_permission('patients.delete')
    or public.has_permission('patients.manage')
  )
);

create policy "super_admin_manage_patient_family_members" on public.patient_family_members
for all to authenticated
using (public.is_super_admin())
with check (public.is_super_admin());

create policy "staff_view_own_clinic_patient_family_members" on public.patient_family_members
for select to authenticated
using (clinic_id = public.current_clinic_id());

create policy "staff_manage_own_clinic_patient_family_members" on public.patient_family_members
for insert to authenticated
with check (
  clinic_id = public.current_clinic_id()
  and (
    public.has_permission('patients.edit')
    or public.has_permission('patients.manage')
  )
);

create policy "staff_delete_own_clinic_patient_family_members" on public.patient_family_members
for delete to authenticated
using (
  clinic_id = public.current_clinic_id()
  and (
    public.has_permission('patients.edit')
    or public.has_permission('patients.manage')
  )
);

create policy "super_admin_manage_patient_notes" on public.patient_notes
for all to authenticated
using (public.is_super_admin())
with check (public.is_super_admin());

create policy "staff_view_own_clinic_patient_notes" on public.patient_notes
for select to authenticated
using (clinic_id = public.current_clinic_id());

create policy "staff_create_own_clinic_patient_notes" on public.patient_notes
for insert to authenticated
with check (
  clinic_id = public.current_clinic_id()
  and (
    public.has_permission('patients.edit')
    or public.has_permission('patients.manage')
  )
);
