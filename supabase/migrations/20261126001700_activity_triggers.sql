-- One activity_log row per app edit, written in the same transaction as the edit,
-- so an edit and its log row are saved or rolled back together. The wording matches
-- LocalRepo and src/repo/shared.ts; keep them in step.

-- No row when:
-- - a bulk function is running (it sets app.bulk and writes one summary row);
-- - no user is signed in (seed.sql, the local-data import, the SQL editor).
-- Cascades: deleting a file logs the file only. item_status has no delete trigger,
-- and log_checklist_items skips items whose file is already gone. pg_trigger_depth()
-- cannot tell: Postgres fires a cascade's AFTER triggers at depth 1.
create or replace function private.skip_log()
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce(current_setting('app.bulk', true), '') = 'on'
    or (select auth.uid()) is null;
$$;

create or replace function private.log_files()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_fields text[];
begin
  if private.skip_log() then
    return null;
  end if;
  if tg_op = 'INSERT' then
    perform private.log_activity(format('Added file %s "%s"', new.code, new.title), new.id, '{}');
  elsif tg_op = 'DELETE' then
    perform private.log_activity(format('Deleted file %s "%s"', old.code, old.title), null, '{}');
  else
    -- Only the fields a user edits (FIELD_LABELS), and only those that changed.
    v_fields := array_remove(array[
      case when new.title is distinct from old.title then 'title' end,
      case when new.maintainer is distinct from old.maintainer then 'maintainer' end,
      case when new.previous_maintainer is distinct from old.previous_maintainer then 'previous maintainer' end,
      case when (new.presented_criteria, new.presented_person, new.presented_proposed)
        is distinct from (old.presented_criteria, old.presented_person, old.presented_proposed) then 'presented in' end,
      case when new.previous_presentation is distinct from old.previous_presentation then 'previous presentation' end,
      case when new.related_criteria is distinct from old.related_criteria then 'related criteria' end,
      case when new.physical_location is distinct from old.physical_location then 'physical location' end,
      case when new.notes is distinct from old.notes then 'notes' end
    ], null);
    if cardinality(v_fields) > 0 then
      perform private.log_activity(format('Edited %s of %s', array_to_string(v_fields, ', '), new.code), new.id, '{}');
    end if;
  end if;
  return null;
end;
$$;

create or replace function private.log_checklist_items()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_code text;
  v_parts text[];
begin
  if private.skip_log() then
    return null;
  end if;
  if tg_op = 'INSERT' then
    select code into v_code from public.files where id = new.file_id;
    perform private.log_activity(format('Added checklist item "%s" to %s', new.label, v_code), new.file_id, '{}');
  elsif tg_op = 'DELETE' then
    select code into v_code from public.files where id = old.file_id;
    if not found then
      return null; -- cascaded from deleting the file, which logs itself
    end if;
    perform private.log_activity(format('Deleted checklist item "%s" from %s', old.label, v_code), old.file_id, '{}');
  elsif (new.label, new.repeating, new.note) is distinct from (old.label, old.repeating, old.note) then
    select code into v_code from public.files where id = new.file_id;
    v_parts := array_remove(array[
      case when new.label is distinct from old.label then format('renamed "%s" to "%s"', old.label, new.label) end,
      case when new.repeating is distinct from old.repeating
        then format('%s "%s" as repeating', case when new.repeating then 'marked' else 'unmarked' end, new.label) end,
      case when new.note is distinct from old.note then format('edited the note on "%s"', new.label) end
    ], null);
    perform private.log_activity(format('In %s: %s', v_code, array_to_string(v_parts, '; ')), new.file_id, '{}');
  end if;
  return null;
end;
$$;

create or replace function private.log_item_status()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_label text;
  v_code text;
  v_file_id text;
begin
  if private.skip_log() or (tg_op = 'UPDATE' and new.status is not distinct from old.status) then
    return null;
  end if;
  select i.label, f.code, f.id into v_label, v_code, v_file_id
  from public.checklist_items i join public.files f on f.id = i.file_id
  where i.id = new.item_id;
  perform private.log_activity(
    format('Marked "%s" in %s as %s (%s %s)', v_label, v_code,
      -- STATUS_LABELS in src/lib/scoring.ts
      case new.status when 'completed' then 'Completed' when 'partial' then 'Partial'
        when 'not_completed' then 'Not completed' else 'N/A' end,
      new.ay, new.sem),
    v_file_id, '{}');
  return null;
end;
$$;

create or replace function private.log_faculty()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_parts text[];
begin
  if private.skip_log() then
    return null;
  end if;
  if tg_op = 'INSERT' then
    perform private.log_activity(format('Added faculty %s', new.name), null, '{}');
  elsif new is distinct from old then
    v_parts := array_remove(array[
      case when new.designation is distinct from old.designation then format('designation to "%s"', new.designation) end,
      case when new.active is distinct from old.active then case when new.active then 'marked active' else 'marked inactive' end end
    ], null);
    perform private.log_activity(
      format('Faculty %s: %s', new.name, coalesce(nullif(array_to_string(v_parts, ', '), ''), 'edited')), null, '{}');
  end if;
  return null;
end;
$$;

create or replace function private.log_criteria()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if private.skip_log() or new is not distinct from old then
    return null;
  end if;
  perform private.log_activity(
    format('Edited criterion %s: %s%s', new.id, new.title,
      case when new.coordinator <> '' then ', coordinator ' || new.coordinator else '' end),
    null, '{}');
  return null;
end;
$$;

create or replace function private.log_academic_years()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if private.skip_log() then
    return null;
  end if;
  perform private.log_activity(format('Added academic year %s (checklists kept, statuses reset)', new.ay), null, '{}');
  return null;
end;
$$;

revoke execute on function private.skip_log() from public, anon;
grant execute on function private.skip_log() to authenticated;
-- Trigger functions run when the trigger fires; nobody needs to call them.
revoke execute on function private.log_files() from public, anon;
revoke execute on function private.log_checklist_items() from public, anon;
revoke execute on function private.log_item_status() from public, anon;
revoke execute on function private.log_faculty() from public, anon;
revoke execute on function private.log_criteria() from public, anon;
revoke execute on function private.log_academic_years() from public, anon;

create trigger files_log after insert or update or delete on public.files
  for each row execute function private.log_files();
create trigger checklist_items_log after insert or update or delete on public.checklist_items
  for each row execute function private.log_checklist_items();
create trigger item_status_log after insert or update on public.item_status
  for each row execute function private.log_item_status();
create trigger faculty_log after insert or update on public.faculty
  for each row execute function private.log_faculty();
create trigger criteria_log after update on public.criteria
  for each row execute function private.log_criteria();
create trigger academic_years_log after insert on public.academic_years
  for each row execute function private.log_academic_years();
