-- Sets presented-in and adds or removes related criteria on many files in one
-- transaction, and logs it. Keys missing from p_patch are left unchanged:
-- {"criteria": "C7", "person": "...", "proposed": false, "addRelated": ["C9"], "removeRelated": ["C2"]}
-- Container files (D13) are skipped. Column checks reject invalid criteria ids.
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

  insert into public.activity_log (who, what, file_codes)
  values (
    coalesce((select display_name from public.profiles where user_id = (select auth.uid())), ''),
    format('Updated criteria on %s files', cardinality(v_codes)),
    v_codes
  );
end;
$$;

revoke execute on function public.bulk_update_file_criteria(text[], jsonb) from public, anon;
grant execute on function public.bulk_update_file_criteria(text[], jsonb) to authenticated;
