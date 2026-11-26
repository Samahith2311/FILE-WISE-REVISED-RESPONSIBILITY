-- The log is read-only from the app. Rows are added only by private.log_activity
-- (security definer); nobody can insert, edit or delete them through the API.
-- Signed-in users keep the read policy, and the table stays in supabase_realtime.
drop policy "activity_log: admin inserts" on public.activity_log;
drop policy "activity_log: admin updates" on public.activity_log;
drop policy "activity_log: admin deletes" on public.activity_log;

-- Row-level security does not cover truncate, so take the write grants away too.
revoke insert, update, delete, truncate on public.activity_log from anon, authenticated;
