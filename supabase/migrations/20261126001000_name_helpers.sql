-- SQL copies of nameKey and replacePerson in src/lib/faculty.ts. Keep the two in step.

-- Trims all whitespace like JavaScript's trim(), including non-breaking spaces
-- (btrim only removes plain spaces).
create or replace function public.trim_ws(p text)
returns text
language sql
immutable
set search_path = ''
as $$
  select regexp_replace(coalesce(p, ''), '^[\s  - 　﻿]+|[\s  - 　﻿]+$', '', 'g');
$$;

-- "Mr. Sharath (proposed)" -> "sharath"
create or replace function public.name_key(p_name text)
returns text
language sql
immutable
set search_path = ''
as $$
  select lower(public.trim_ws(regexp_replace(
    public.trim_ws(regexp_replace(coalesce(p_name, ''), '\([^)]*\)', '', 'g')),
    '^(prof|mr|ms|mrs|dr)\.?[\s ]+', '', 'i'
  )));
$$;

-- Replaces p_from with p_to in a comma list, keeping notes like "(proposed)"
-- and dropping duplicates. Matching uses name_key.
create or replace function public.replace_person(p_text text, p_from text, p_to text)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_part text;
  v_key text;
  v_from text := public.name_key(p_from);
  v_to text := public.name_key(p_to);
  v_out text[] := '{}';
begin
  foreach v_part in array string_to_array(coalesce(p_text, ''), ',') loop
    v_part := public.trim_ws(v_part);
    continue when v_part = '';
    v_key := public.name_key(v_part);
    if v_key = v_from then
      continue when exists (select 1 from unnest(v_out) o where public.name_key(o) = v_to);
      v_out := v_out || (public.trim_ws(p_to) || coalesce(substring(v_part from '\s*\([^)]*\)\s*$'), ''));
    elsif v_key = v_to and exists (select 1 from unnest(v_out) o where public.name_key(o) = v_to) then
      continue;
    else
      v_out := v_out || v_part;
    end if;
  end loop;
  return array_to_string(v_out, ', ');
end;
$$;

-- True when the comma list p_text names p_name.
create or replace function public.has_person(p_text text, p_name text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select exists (
    select 1 from unnest(string_to_array(coalesce(p_text, ''), ',')) part
    where public.trim_ws(part) <> '' and public.name_key(part) = public.name_key(p_name)
  );
$$;

-- One faculty row per person: "Mr. Sharath" and "Sharath" cannot both exist.
create unique index faculty_name_key_idx on public.faculty (public.name_key(name));

revoke execute on function public.trim_ws(text) from public, anon;
revoke execute on function public.name_key(text) from public, anon;
revoke execute on function public.replace_person(text, text, text) from public, anon;
revoke execute on function public.has_person(text, text) from public, anon;
grant execute on function public.trim_ws(text) to authenticated;
grant execute on function public.name_key(text) to authenticated;
grant execute on function public.replace_person(text, text, text) to authenticated;
grant execute on function public.has_person(text, text) to authenticated;
