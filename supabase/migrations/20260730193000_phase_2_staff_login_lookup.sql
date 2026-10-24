create or replace function public.resolve_staff_login_email(staff_user_id text)
returns text
language sql
security definer
set search_path = public
stable
as $$
  select email
  from public.staff_profiles
  where user_id = staff_user_id
    and status = 'active'
  limit 1
$$;

revoke all on function public.resolve_staff_login_email(text) from public;
grant execute on function public.resolve_staff_login_email(text) to anon, authenticated;
