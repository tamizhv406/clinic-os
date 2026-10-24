-- ---------------------------------------------------------------------------
-- Public clinic directory: lets an anonymous patient see every published
-- clinic (status in ('trial', 'active')) so they can pick one on /book
-- before landing on that clinic's /book/:clinicSlug page.
-- ---------------------------------------------------------------------------

create or replace function public.public_published_clinics()
returns jsonb
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', c.id,
      'slug', c.slug,
      'name', c.name,
      'specialization', coalesce(c.specialty, ''),
      'address', coalesce(c.address, ''),
      'phone', coalesce(c.phone, ''),
      'logoUrl', coalesce(c.logo_url, '')
    )
    order by c.name
  ), '[]'::jsonb)
  from public.clinics c
  where c.status in ('trial', 'active')
$$;

revoke all on function public.public_published_clinics() from public;
grant execute on function public.public_published_clinics() to anon, authenticated;
