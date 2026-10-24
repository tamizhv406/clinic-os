drop policy if exists "authenticated_insert_audit_logs" on public.audit_logs;
create policy "authenticated_insert_audit_logs" on public.audit_logs
for insert to authenticated
with check (
  public.is_super_admin()
  or (
    clinic_id = public.current_clinic_id()
    and coalesce(user_id, actor_id) = auth.uid()
  )
);

drop policy if exists "authenticated_insert_system_health_checks" on public.system_health_checks;
create policy "authenticated_insert_system_health_checks" on public.system_health_checks
for insert to authenticated
with check (
  public.is_super_admin()
  or (
    clinic_id = public.current_clinic_id()
    and (user_id is null or user_id = auth.uid())
  )
);

drop policy if exists "authenticated_insert_app_error_logs" on public.app_error_logs;
create policy "authenticated_insert_app_error_logs" on public.app_error_logs
for insert to authenticated
with check (
  public.is_super_admin()
  or (
    clinic_id = public.current_clinic_id()
    and (user_id is null or user_id = auth.uid())
  )
);

drop policy if exists "authenticated_insert_security_events" on public.security_events;
create policy "authenticated_insert_security_events" on public.security_events
for insert to authenticated
with check (
  public.is_super_admin()
  or (
    clinic_id = public.current_clinic_id()
    and (user_id is null or user_id = auth.uid())
  )
);

drop policy if exists "authenticated_insert_background_job_logs" on public.background_job_logs;
create policy "authenticated_insert_background_job_logs" on public.background_job_logs
for insert to authenticated
with check (
  public.is_super_admin()
  or (
    clinic_id = public.current_clinic_id()
    and (user_id is null or user_id = auth.uid())
  )
);

create index if not exists idx_patients_clinic_status on public.patients(clinic_id, status);
create index if not exists idx_appointments_clinic_date_status on public.appointments(clinic_id, appointment_date, status);
create index if not exists idx_invoices_clinic_created_at on public.invoices(clinic_id, created_at);
create index if not exists idx_audit_logs_clinic_created_at on public.audit_logs(clinic_id, created_at);
