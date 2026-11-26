-- True when the signed-in user's profile has role 'admin'. The role comes from
-- public.profiles only, never from user_metadata (which users can edit themselves).
-- Security definer so policies can call it without granting wider profile reads.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where user_id = (select auth.uid()) and role = 'admin'
  );
$$;

revoke execute on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;
