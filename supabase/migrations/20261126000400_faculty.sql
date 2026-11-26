create table public.faculty (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (btrim(name) <> ''),
  designation text not null default '',
  active boolean not null default true
);

alter table public.faculty enable row level security;

create policy "faculty: signed-in users read" on public.faculty
  for select to authenticated using (true);
create policy "faculty: admin inserts" on public.faculty
  for insert to authenticated with check ((select public.is_admin()));
create policy "faculty: admin updates" on public.faculty
  for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "faculty: admin deletes" on public.faculty
  for delete to authenticated using ((select public.is_admin()));
