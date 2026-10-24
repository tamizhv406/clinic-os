create table if not exists public.consultations (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  branch_id uuid references public.branches(id) on delete set null,
  appointment_id uuid not null references public.appointments(id) on delete cascade,
  patient_id uuid not null references public.patients(id) on delete cascade,
  doctor_id uuid not null references public.doctor_profiles(id) on delete cascade,
  symptoms text,
  diagnosis text,
  clinical_notes text,
  advice text,
  follow_up_date date,
  follow_up_reason text,
  status text default 'draft' check (status in ('draft','completed','cancelled')),
  created_by uuid references public.staff_profiles(id) on delete set null,
  completed_at timestamptz,
  metadata jsonb default '{}',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.consultation_vitals (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  consultation_id uuid not null references public.consultations(id) on delete cascade,
  patient_id uuid not null references public.patients(id) on delete cascade,
  height_cm numeric(6,2),
  weight_kg numeric(6,2),
  temperature_c numeric(5,2),
  blood_pressure text,
  pulse_rate int,
  respiratory_rate int,
  oxygen_saturation int,
  blood_sugar text,
  notes text,
  created_at timestamptz default now()
);

create table if not exists public.consultation_notes (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  consultation_id uuid not null references public.consultations(id) on delete cascade,
  note_type text default 'general' check (note_type in ('general','doctor','nurse','follow_up')),
  note text not null,
  created_by uuid references public.staff_profiles(id) on delete set null,
  created_at timestamptz default now()
);

create index if not exists idx_consultations_clinic_id on public.consultations(clinic_id);
create index if not exists idx_consultations_patient_id on public.consultations(patient_id);
create index if not exists idx_consultations_doctor_id on public.consultations(doctor_id);
create index if not exists idx_consultations_appointment_id on public.consultations(appointment_id);
create index if not exists idx_consultations_status on public.consultations(status);
create index if not exists idx_consultation_vitals_consultation_id on public.consultation_vitals(consultation_id);
create index if not exists idx_consultation_notes_consultation_id on public.consultation_notes(consultation_id);

drop trigger if exists set_consultations_updated_at on public.consultations;
create trigger set_consultations_updated_at before update on public.consultations
for each row execute function public.set_updated_at();

alter table public.consultations enable row level security;
alter table public.consultation_vitals enable row level security;
alter table public.consultation_notes enable row level security;

create policy "super_admin_manage_consultations" on public.consultations
for all to authenticated
using (public.is_super_admin())
with check (public.is_super_admin());

create policy "clinic_staff_view_consultations" on public.consultations
for select to authenticated
using (
  clinic_id = public.current_clinic_id()
  and (
    public.has_permission('consultation.view')
    or public.has_permission('consultation.manage')
    or doctor_id in (select id from public.doctor_profiles where staff_id = auth.uid())
  )
);

create policy "doctor_create_assigned_consultations" on public.consultations
for insert to authenticated
with check (
  clinic_id = public.current_clinic_id()
  and (
    public.has_permission('consultation.create')
    or doctor_id in (select id from public.doctor_profiles where staff_id = auth.uid())
  )
  and exists (
    select 1
    from public.appointments a
    where a.id = appointment_id
      and a.clinic_id = clinic_id
      and a.patient_id = patient_id
      and a.doctor_id = doctor_id
  )
);

create policy "doctor_update_assigned_consultations" on public.consultations
for update to authenticated
using (
  clinic_id = public.current_clinic_id()
  and (
    public.has_permission('consultation.edit')
    or public.has_permission('consultation.manage')
    or doctor_id in (select id from public.doctor_profiles where staff_id = auth.uid())
  )
)
with check (
  clinic_id = public.current_clinic_id()
  and (
    public.has_permission('consultation.edit')
    or public.has_permission('consultation.manage')
    or doctor_id in (select id from public.doctor_profiles where staff_id = auth.uid())
  )
);

create policy "super_admin_manage_consultation_vitals" on public.consultation_vitals
for all to authenticated
using (public.is_super_admin())
with check (public.is_super_admin());

create policy "clinic_staff_view_consultation_vitals" on public.consultation_vitals
for select to authenticated
using (
  clinic_id = public.current_clinic_id()
  and exists (
    select 1
    from public.consultations c
    where c.id = consultation_id
      and (
        public.has_permission('consultation.view')
        or public.has_permission('consultation.manage')
        or c.doctor_id in (select id from public.doctor_profiles where staff_id = auth.uid())
      )
  )
);

create policy "doctor_manage_consultation_vitals" on public.consultation_vitals
for all to authenticated
using (
  clinic_id = public.current_clinic_id()
  and exists (
    select 1
    from public.consultations c
    where c.id = consultation_id
      and (
        public.has_permission('consultation.edit')
        or public.has_permission('consultation.manage')
        or c.doctor_id in (select id from public.doctor_profiles where staff_id = auth.uid())
      )
  )
)
with check (
  clinic_id = public.current_clinic_id()
  and exists (
    select 1
    from public.consultations c
    where c.id = consultation_id
      and c.patient_id = patient_id
      and (
        public.has_permission('consultation.edit')
        or public.has_permission('consultation.manage')
        or c.doctor_id in (select id from public.doctor_profiles where staff_id = auth.uid())
      )
  )
);

create policy "super_admin_manage_consultation_notes" on public.consultation_notes
for all to authenticated
using (public.is_super_admin())
with check (public.is_super_admin());

create policy "clinic_staff_view_consultation_notes" on public.consultation_notes
for select to authenticated
using (
  clinic_id = public.current_clinic_id()
  and exists (
    select 1
    from public.consultations c
    where c.id = consultation_id
      and (
        public.has_permission('consultation.view')
        or public.has_permission('consultation.manage')
        or c.doctor_id in (select id from public.doctor_profiles where staff_id = auth.uid())
      )
  )
);

create policy "doctor_create_consultation_notes" on public.consultation_notes
for insert to authenticated
with check (
  clinic_id = public.current_clinic_id()
  and exists (
    select 1
    from public.consultations c
    where c.id = consultation_id
      and (
        public.has_permission('consultation.edit')
        or public.has_permission('consultation.manage')
        or c.doctor_id in (select id from public.doctor_profiles where staff_id = auth.uid())
      )
  )
);
