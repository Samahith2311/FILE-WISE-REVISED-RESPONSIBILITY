-- Applies the ticked "reassign files" rows in one transaction and logs them.
-- p_changes: [{"fileId": "A13", "from": "Akshatha M", "to": "Gagan P"}, ...]
-- p_record_previous: store each old maintainer as the file's previous maintainer.
-- A row is skipped when the file does not list "from" as a maintainer.
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

  insert into public.activity_log (who, what, file_codes)
  values (
    coalesce((select display_name from public.profiles where user_id = (select auth.uid())), ''),
    format(
      'Reassigned %s files: %s%s',
      cardinality(v_codes), v_pairs,
      case when p_record_previous then ' (previous maintainer recorded)' else '' end
    ),
    v_codes
  );
end;
$$;

revoke execute on function public.reassign_faculty(jsonb, boolean) from public, anon;
grant execute on function public.reassign_faculty(jsonb, boolean) to authenticated;
