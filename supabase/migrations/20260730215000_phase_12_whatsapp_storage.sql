create table if not exists public.whatsapp_conversations (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  branch_id uuid references public.branches(id) on delete set null,
  patient_id uuid references public.patients(id) on delete set null,
  phone_number text not null,
  status text not null default 'new' check (status in ('new','in_progress','appointment_confirmed','waiting_for_patient','transferred_to_reception','closed','failed')),
  source text not null default 'whatsapp' check (source in ('whatsapp','qr','website')),
  current_step text,
  linked_appointment_id uuid references public.appointments(id) on delete set null,
  last_message text,
  metadata jsonb not null default '{}',
  created_by uuid references public.staff_profiles(id) on delete set null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.whatsapp_templates (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  branch_id uuid references public.branches(id) on delete set null,
  name text not null,
  category text not null default 'booking' check (category in ('booking','reminder','payment','follow_up','review','cancellation','prescription','invoice','other')),
  status text not null default 'draft' check (status in ('active','draft','needs_api_approval','disabled')),
  body text not null,
  variables jsonb not null default '[]',
  provider_template_id text,
  metadata jsonb not null default '{}',
  created_by uuid references public.staff_profiles(id) on delete set null,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (clinic_id, name)
);

create table if not exists public.whatsapp_messages (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  branch_id uuid references public.branches(id) on delete set null,
  conversation_id uuid references public.whatsapp_conversations(id) on delete cascade,
  patient_id uuid references public.patients(id) on delete set null,
  phone_number text not null,
  status text not null default 'queued' check (status in ('queued','sent','delivered','read','failed','received')),
  direction text not null check (direction in ('inbound','outbound')),
  sender_type text not null default 'bot' check (sender_type in ('patient','bot','reception','system')),
  message_type text not null default 'text' check (message_type in ('text','template','appointment','prescription','reminder','invoice','system')),
  body text not null,
  template_id uuid references public.whatsapp_templates(id) on delete set null,
  related_type text,
  related_id uuid,
  delivery_status text not null default 'queued' check (delivery_status in ('queued','sent','delivered','read','failed','received')),
  provider_message_id text,
  payload jsonb not null default '{}',
  metadata jsonb not null default '{}',
  sent_by uuid references public.staff_profiles(id) on delete set null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.whatsapp_delivery_logs (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  branch_id uuid references public.branches(id) on delete set null,
  conversation_id uuid references public.whatsapp_conversations(id) on delete cascade,
  message_id uuid references public.whatsapp_messages(id) on delete cascade,
  patient_id uuid references public.patients(id) on delete set null,
  phone_number text,
  delivery_status text not null default 'queued' check (delivery_status in ('queued','sent','delivered','read','failed','received')),
  provider_message_id text,
  payload jsonb not null default '{}',
  metadata jsonb not null default '{}',
  created_by uuid references public.staff_profiles(id) on delete set null,
  created_at timestamptz default now()
);

create table if not exists public.whatsapp_patient_consents (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  branch_id uuid references public.branches(id) on delete set null,
  patient_id uuid references public.patients(id) on delete set null,
  phone_number text not null,
  consent_status text not null default 'unknown' check (consent_status in ('unknown','opted_in','opted_out','revoked')),
  consent_source text not null default 'staff' check (consent_source in ('staff','patient','import','system')),
  consented_at timestamptz,
  revoked_at timestamptz,
  payload jsonb not null default '{}',
  metadata jsonb not null default '{}',
  created_by uuid references public.staff_profiles(id) on delete set null,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (clinic_id, phone_number)
);

create table if not exists public.whatsapp_webhook_events (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  branch_id uuid references public.branches(id) on delete set null,
  provider text not null default 'placeholder',
  provider_event_id text,
  event_type text not null default 'placeholder',
  payload jsonb not null default '{}',
  metadata jsonb not null default '{}',
  status text not null default 'stored' check (status in ('stored','ignored','processed','failed')),
  created_by uuid references public.staff_profiles(id) on delete set null,
  received_at timestamptz default now(),
  created_at timestamptz default now()
);

create index if not exists idx_whatsapp_conversations_clinic_id on public.whatsapp_conversations(clinic_id);
create index if not exists idx_whatsapp_conversations_branch_id on public.whatsapp_conversations(branch_id);
create index if not exists idx_whatsapp_conversations_patient_id on public.whatsapp_conversations(patient_id);
create index if not exists idx_whatsapp_conversations_phone_number on public.whatsapp_conversations(phone_number);
create index if not exists idx_whatsapp_conversations_status on public.whatsapp_conversations(status);
create index if not exists idx_whatsapp_messages_clinic_id on public.whatsapp_messages(clinic_id);
create index if not exists idx_whatsapp_messages_conversation_id on public.whatsapp_messages(conversation_id);
create index if not exists idx_whatsapp_messages_patient_id on public.whatsapp_messages(patient_id);
create index if not exists idx_whatsapp_messages_delivery_status on public.whatsapp_messages(delivery_status);
create index if not exists idx_whatsapp_messages_related on public.whatsapp_messages(related_type, related_id);
create index if not exists idx_whatsapp_templates_clinic_id on public.whatsapp_templates(clinic_id);
create index if not exists idx_whatsapp_templates_status on public.whatsapp_templates(status);
create index if not exists idx_whatsapp_delivery_logs_message_id on public.whatsapp_delivery_logs(message_id);
create index if not exists idx_whatsapp_delivery_logs_clinic_id on public.whatsapp_delivery_logs(clinic_id);
create index if not exists idx_whatsapp_patient_consents_clinic_phone on public.whatsapp_patient_consents(clinic_id, phone_number);
create index if not exists idx_whatsapp_patient_consents_patient_id on public.whatsapp_patient_consents(patient_id);
create index if not exists idx_whatsapp_webhook_events_clinic_id on public.whatsapp_webhook_events(clinic_id);
create index if not exists idx_whatsapp_webhook_events_provider_event_id on public.whatsapp_webhook_events(provider_event_id);

drop trigger if exists set_whatsapp_conversations_updated_at on public.whatsapp_conversations;
create trigger set_whatsapp_conversations_updated_at before update on public.whatsapp_conversations
for each row execute function public.set_updated_at();

drop trigger if exists set_whatsapp_messages_updated_at on public.whatsapp_messages;
create trigger set_whatsapp_messages_updated_at before update on public.whatsapp_messages
for each row execute function public.set_updated_at();

drop trigger if exists set_whatsapp_templates_updated_at on public.whatsapp_templates;
create trigger set_whatsapp_templates_updated_at before update on public.whatsapp_templates
for each row execute function public.set_updated_at();

drop trigger if exists set_whatsapp_patient_consents_updated_at on public.whatsapp_patient_consents;
create trigger set_whatsapp_patient_consents_updated_at before update on public.whatsapp_patient_consents
for each row execute function public.set_updated_at();

create or replace function public.can_manage_whatsapp(action_key text)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select public.is_super_admin()
    or exists (
      select 1
      from public.staff_profiles sp
      where sp.id = auth.uid()
        and sp.status = 'active'
        and sp.role_key in ('owner','receptionist')
        and (
          public.has_permission('whatsapp.manage')
          or public.has_permission('whatsapp.' || action_key)
        )
    )
$$;

create or replace function public.can_view_patient_whatsapp(target_clinic_id uuid, target_patient_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.staff_profiles sp
    where sp.id = auth.uid()
      and sp.status = 'active'
      and sp.clinic_id = target_clinic_id
      and sp.role_key in ('doctor','pharmacist')
      and target_patient_id is not null
      and (
        public.has_permission('patients.view')
        or public.has_permission('prescriptions.view')
        or public.has_permission('pharmacy.view')
      )
  )
$$;

alter table public.whatsapp_conversations enable row level security;
alter table public.whatsapp_messages enable row level security;
alter table public.whatsapp_templates enable row level security;
alter table public.whatsapp_delivery_logs enable row level security;
alter table public.whatsapp_patient_consents enable row level security;
alter table public.whatsapp_webhook_events enable row level security;

create policy "super_admin_manage_whatsapp_conversations" on public.whatsapp_conversations for all to authenticated using (public.is_super_admin()) with check (public.is_super_admin());
create policy "clinic_staff_read_whatsapp_conversations" on public.whatsapp_conversations for select to authenticated using (clinic_id = public.current_clinic_id() or public.can_view_patient_whatsapp(clinic_id, patient_id));
create policy "whatsapp_staff_insert_conversations" on public.whatsapp_conversations for insert to authenticated with check (clinic_id = public.current_clinic_id() and public.can_manage_whatsapp('create'));
create policy "whatsapp_staff_update_conversations" on public.whatsapp_conversations for update to authenticated using (clinic_id = public.current_clinic_id() and public.can_manage_whatsapp('edit')) with check (clinic_id = public.current_clinic_id() and public.can_manage_whatsapp('edit'));
create policy "whatsapp_staff_delete_conversations" on public.whatsapp_conversations for delete to authenticated using (clinic_id = public.current_clinic_id() and public.can_manage_whatsapp('delete'));

create policy "super_admin_manage_whatsapp_messages" on public.whatsapp_messages for all to authenticated using (public.is_super_admin()) with check (public.is_super_admin());
create policy "clinic_staff_read_whatsapp_messages" on public.whatsapp_messages for select to authenticated using (clinic_id = public.current_clinic_id() or public.can_view_patient_whatsapp(clinic_id, patient_id));
create policy "whatsapp_staff_insert_messages" on public.whatsapp_messages for insert to authenticated with check (clinic_id = public.current_clinic_id() and public.can_manage_whatsapp('create'));
create policy "whatsapp_staff_update_messages" on public.whatsapp_messages for update to authenticated using (clinic_id = public.current_clinic_id() and public.can_manage_whatsapp('edit')) with check (clinic_id = public.current_clinic_id() and public.can_manage_whatsapp('edit'));
create policy "whatsapp_staff_delete_messages" on public.whatsapp_messages for delete to authenticated using (clinic_id = public.current_clinic_id() and public.can_manage_whatsapp('delete'));

create policy "super_admin_manage_whatsapp_templates" on public.whatsapp_templates for all to authenticated using (public.is_super_admin()) with check (public.is_super_admin());
create policy "clinic_staff_read_whatsapp_templates" on public.whatsapp_templates for select to authenticated using (clinic_id = public.current_clinic_id());
create policy "whatsapp_staff_insert_templates" on public.whatsapp_templates for insert to authenticated with check (clinic_id = public.current_clinic_id() and public.can_manage_whatsapp('create'));
create policy "whatsapp_staff_update_templates" on public.whatsapp_templates for update to authenticated using (clinic_id = public.current_clinic_id() and public.can_manage_whatsapp('edit')) with check (clinic_id = public.current_clinic_id() and public.can_manage_whatsapp('edit'));
create policy "whatsapp_staff_delete_templates" on public.whatsapp_templates for delete to authenticated using (clinic_id = public.current_clinic_id() and public.can_manage_whatsapp('delete'));

create policy "super_admin_manage_whatsapp_delivery_logs" on public.whatsapp_delivery_logs for all to authenticated using (public.is_super_admin()) with check (public.is_super_admin());
create policy "clinic_staff_read_whatsapp_delivery_logs" on public.whatsapp_delivery_logs for select to authenticated using (clinic_id = public.current_clinic_id() or public.can_view_patient_whatsapp(clinic_id, patient_id));
create policy "whatsapp_staff_insert_delivery_logs" on public.whatsapp_delivery_logs for insert to authenticated with check (clinic_id = public.current_clinic_id() and public.can_manage_whatsapp('create'));

create policy "super_admin_manage_whatsapp_patient_consents" on public.whatsapp_patient_consents for all to authenticated using (public.is_super_admin()) with check (public.is_super_admin());
create policy "clinic_staff_read_whatsapp_patient_consents" on public.whatsapp_patient_consents for select to authenticated using (clinic_id = public.current_clinic_id() or public.can_view_patient_whatsapp(clinic_id, patient_id));
create policy "whatsapp_staff_insert_patient_consents" on public.whatsapp_patient_consents for insert to authenticated with check (clinic_id = public.current_clinic_id() and public.can_manage_whatsapp('create'));
create policy "whatsapp_staff_update_patient_consents" on public.whatsapp_patient_consents for update to authenticated using (clinic_id = public.current_clinic_id() and public.can_manage_whatsapp('edit')) with check (clinic_id = public.current_clinic_id() and public.can_manage_whatsapp('edit'));

create policy "super_admin_manage_whatsapp_webhook_events" on public.whatsapp_webhook_events for all to authenticated using (public.is_super_admin()) with check (public.is_super_admin());
create policy "clinic_staff_read_whatsapp_webhook_events" on public.whatsapp_webhook_events for select to authenticated using (clinic_id = public.current_clinic_id());
create policy "whatsapp_staff_insert_webhook_events" on public.whatsapp_webhook_events for insert to authenticated with check (clinic_id = public.current_clinic_id() and public.can_manage_whatsapp('create'));

revoke all on function public.can_manage_whatsapp(text) from public;
grant execute on function public.can_manage_whatsapp(text) to authenticated;
revoke all on function public.can_view_patient_whatsapp(uuid, uuid) from public;
grant execute on function public.can_view_patient_whatsapp(uuid, uuid) to authenticated;
