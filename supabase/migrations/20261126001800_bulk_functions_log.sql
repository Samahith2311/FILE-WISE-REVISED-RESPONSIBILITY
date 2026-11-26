-- The four bulk functions, unchanged except for logging: each sets app.bulk so the
-- row triggers stay quiet, and writes its one summary row through
-- private.log_activity. app.bulk is transaction-local and is turned off again at
-- the end, so later edits in the same transaction are logged as usual.

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
  perform set_config('app.bulk', 'on', true);

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

  perform private.log_activity(
    format('Renamed faculty %s to %s (%s files updated)', v_old, v_new, cardinality(v_codes)),
    null,
    v_codes
  );
  perform set_config('app.bulk', 'off', true);
end;
$$;

create or replace function public.reassign_faculty(p_changes jsonb, p_record_previous boolean)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_change record;
  v_code text;
  v_codes text[] := '{}';
  v_pairs text;
begin
  if not public.is_admin() then
    raise exception 'Only the admin can make changes.' using errcode = '42501';
  end if;
  if jsonb_typeof(p_changes) is distinct from 'array' then
    raise exception 'p_changes must be a JSON array.' using errcode = '22023';
  end if;
  perform set_config('app.bulk', 'on', true);

  for v_change in
    select * from jsonb_to_recordset(p_changes) as x("fileId" text, "from" text, "to" text)
  loop
    continue when btrim(coalesce(v_change."to", '')) = '' or btrim(coalesce(v_change."from", '')) = '';
    update public.files f set
      maintainer = public.replace_person(f.maintainer, v_change."from", v_change."to"),
      previous_maintainer = case when p_record_previous then btrim(v_change."from") else f.previous_maintainer end,
      updated_at = now()
    where f.id = v_change."fileId" and public.has_person(f.maintainer, v_change."from")
    returning f.code into v_code;
    if found then
      v_codes := v_codes || v_code;
    end if;
  end loop;

  if cardinality(v_codes) = 0 then
    raise exception 'No files were reassigned.' using errcode = 'P0002';
  end if;

  select string_agg(distinct btrim("from") || ' to ' || btrim("to"), '; ')
  into v_pairs
  from jsonb_to_recordset(p_changes) as x("fileId" text, "from" text, "to" text);

  perform private.log_activity(
    format(
      'Reassigned %s files: %s%s',
      cardinality(v_codes), v_pairs,
      case when p_record_previous then ' (previous maintainer recorded)' else '' end
    ),
    null,
    v_codes
  );
  perform set_config('app.bulk', 'off', true);
end;
$$;

create or replace function public.bulk_update_file_criteria(p_file_ids text[], p_patch jsonb)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_add text[] := coalesce(array(select jsonb_array_elements_text(p_patch -> 'addRelated')), '{}');
  v_remove text[] := coalesce(array(select jsonb_array_elements_text(p_patch -> 'removeRelated')), '{}');
  v_codes text[];
begin
  if not public.is_admin() then
    raise exception 'Only the admin can make changes.' using errcode = '42501';
  end if;
  if jsonb_typeof(p_patch) is distinct from 'object' then
    raise exception 'p_patch must be a JSON object.' using errcode = '22023';
  end if;
  perform set_config('app.bulk', 'on', true);

  with changed as (
    update public.files f set
      presented_criteria = case when p_patch ? 'criteria' then p_patch ->> 'criteria' else f.presented_criteria end,
      presented_person = case when p_patch ? 'person' then btrim(p_patch ->> 'person') else f.presented_person end,
      presented_proposed = case when p_patch ? 'proposed' then (p_patch ->> 'proposed')::boolean else f.presented_proposed end,
      related_criteria = (
        select coalesce(array_agg(c order by substr(c, 2)::int), '{}')
        from (select distinct c from unnest(f.related_criteria || v_add) c where c <> all (v_remove)) s
      ),
      updated_at = now()
    where f.id = any (p_file_ids) and f.container is null
    returning f.code, f.sort_order, f.domain
  )
  select coalesce(array_agg(code order by array_position(array['D', 'A', 'P'], domain), sort_order), '{}')
  into v_codes from changed;

  if cardinality(v_codes) = 0 then
    raise exception 'Select at least one file.' using errcode = 'P0002';
  end if;

  perform private.log_activity(format('Updated criteria on %s files', cardinality(v_codes)), null, v_codes);
  perform set_config('app.bulk', 'off', true);
end;
$$;

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
  perform set_config('app.bulk', 'on', true);

  insert into public.academic_years (ay) values (v_ay);

  perform private.log_activity(format('Added academic year %s (checklists kept, statuses reset)', v_ay), null, '{}');
  perform set_config('app.bulk', 'off', true);
end;
$$;
