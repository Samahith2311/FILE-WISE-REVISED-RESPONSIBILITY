-- Who changed what, newest first. The app reads only the newest 500 rows.
create table public.activity_log (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  who text not null default '',
  what text not null,
  file_id text references public.files (id) on delete set null,
  file_codes text[] not null default '{}'
);

create index activity_log_at_idx on public.activity_log (at desc);
create index activity_log_file_id_idx on public.activity_log (file_id);

alter table public.activity_log enable row level security;

create policy "activity_log: signed-in users read" on public.activity_log
  for select to authenticated using (true);
create policy "activity_log: admin inserts" on public.activity_log
  for insert to authenticated with check ((select public.is_admin()));
create policy "activity_log: admin updates" on public.activity_log
  for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "activity_log: admin deletes" on public.activity_log
  for delete to authenticated using ((select public.is_admin()));
