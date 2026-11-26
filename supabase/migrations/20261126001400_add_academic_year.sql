-- Adds an academic year and logs it. Checklists carry over unchanged; the new year
-- has no item_status rows, so every item starts as "not completed".
create or replace function public.add_academic_year(p_ay text)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_ay text := btrim(coalesce(p_ay, ''));
begin
  if not public.is_admin() then
    raise exception 'Only the admin can make changes.' using errcode = '42501';
  end if;
  if v_ay !~ '^\d{4}-\d{2}$' then
    raise exception 'Academic year must look like 2027-28.' using errcode = '22023';
  end if;
  if exists (select 1 from public.academic_years where ay = v_ay) then
    raise exception '% already exists.', v_ay using errcode = '23505';
  end if;

  insert into public.academic_years (ay) values (v_ay);

  insert into public.activity_log (who, what)
  values (
    coalesce((select display_name from public.profiles where user_id = (select auth.uid())), ''),
    format('Added academic year %s (checklists kept, statuses reset)', v_ay)
  );
end;
$$;

revoke execute on function public.add_academic_year(text) from public, anon;
grant execute on function public.add_academic_year(text) to authenticated;
