-- The only way to add an activity_log row. Lives in schema private, which the API
-- does not expose, so it cannot be called through REST or rpc(). Triggers and the
-- bulk functions call it inside the transaction of the edit they describe.
-- Do not add "private" to the exposed schemas in the API settings.
create schema if not exists private;

revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

create or replace function private.log_activity(p_what text, p_file_id text, p_file_codes text[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Only the admin can make changes.' using errcode = '42501';
  end if;
  insert into public.activity_log (who, what, file_id, file_codes)
  values (
    coalesce((select display_name from public.profiles where user_id = (select auth.uid())), ''),
    p_what,
    p_file_id,
    coalesce(p_file_codes, '{}')
  );
end;
$$;

revoke execute on function private.log_activity(text, text, text[]) from public, anon;
grant execute on function private.log_activity(text, text, text[]) to authenticated;
