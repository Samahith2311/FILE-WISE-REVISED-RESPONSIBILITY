create table public.academic_years (
  ay text primary key check (ay ~ '^\d{4}-\d{2}$'),
  created_at timestamptz not null default now()
);

alter table public.academic_years enable row level security;

create policy "academic_years: signed-in users read" on public.academic_years
  for select to authenticated using (true);
create policy "academic_years: admin inserts" on public.academic_years
  for insert to authenticated with check ((select public.is_admin()));
create policy "academic_years: admin updates" on public.academic_years
  for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "academic_years: admin deletes" on public.academic_years
  for delete to authenticated using ((select public.is_admin()));
