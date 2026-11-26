-- Renames a faculty member and every file and criterion that names them, in one
-- transaction, and logs it. Security invoker: row-level security still applies.
create or replace function public.rename_faculty(p_faculty_id uuid, p_new_name text)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_old text;
  v_new text := btrim(coalesce(p_new_name, ''));
  v_codes text[];
begin
  if not public.is_admin() then
    raise exception 'Only the admin can make changes.' using errcode = '42501';
  end if;
  if v_new = '' then
    raise exception 'Enter a name.' using errcode = '22023';
  end if;

  select name into v_old from public.faculty where id = p_faculty_id for update;
  if not found then
    raise exception 'Faculty member not found.' using errcode = 'P0002';
  end if;
  if exists (
    select 1 from public.faculty
    where id <> p_faculty_id and public.name_key(name) = public.name_key(v_new)
  ) then
    raise exception '% is already in the faculty list.', v_new using errcode = '23505';
  end if;

  update public.faculty set name = v_new where id = p_faculty_id;

  with changed as (
    update public.files f set
      maintainer = public.replace_person(f.maintainer, v_old, v_new),
      previous_maintainer = public.replace_person(f.previous_maintainer, v_old, v_new),
      presented_person = public.replace_person(f.presented_person, v_old, v_new),
      updated_at = now()
    -- Only rows whose text actually changes, so the count matches local mode.
    where (
      public.replace_person(f.maintainer, v_old, v_new),
      public.replace_person(f.previous_maintainer, v_old, v_new),
      public.replace_person(f.presented_person, v_old, v_new)
    ) is distinct from (f.maintainer, f.previous_maintainer, f.presented_person)
      and (public.has_person(f.maintainer, v_old)
        or public.has_person(f.previous_maintainer, v_old)
        or public.has_person(f.presented_person, v_old))
    returning f.code, f.sort_order, f.domain
  )
  select coalesce(array_agg(code order by array_position(array['D', 'A', 'P'], domain), sort_order), '{}')
  into v_codes from changed;

  update public.criteria
  set coordinator = public.replace_person(coordinator, v_old, v_new)
  where public.has_person(coordinator, v_old);

  insert into public.activity_log (who, what, file_codes)
  values (
    coalesce((select display_name from public.profiles where user_id = (select auth.uid())), ''),
    format('Renamed faculty %s to %s (%s files updated)', v_old, v_new, cardinality(v_codes)),
    v_codes
  );
end;
$$;

revoke execute on function public.rename_faculty(uuid, text) from public, anon;
grant execute on function public.rename_faculty(uuid, text) to authenticated;
