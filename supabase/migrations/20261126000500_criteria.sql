create table public.criteria (
  id text primary key check (id ~ '^C[1-9]$'),
  title text not null default '',
  coordinator text not null default ''
);

alter table public.criteria enable row level security;

create policy "criteria: signed-in users read" on public.criteria
  for select to authenticated using (true);
create policy "criteria: admin inserts" on public.criteria
  for insert to authenticated with check ((select public.is_admin()));
create policy "criteria: admin updates" on public.criteria
  for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "criteria: admin deletes" on public.criteria
  for delete to authenticated using ((select public.is_admin()));
