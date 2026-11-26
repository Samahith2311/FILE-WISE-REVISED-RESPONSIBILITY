-- Status of one checklist item in one academic year and semester.
-- A missing row means "not completed".
create table public.item_status (
  item_id text not null references public.checklist_items (id) on delete cascade,
  ay text not null references public.academic_years (ay) on delete cascade,
  sem text not null check (sem in ('Odd', 'Even')),
  status text not null check (status in ('completed', 'partial', 'not_completed', 'na')),
  updated_at timestamptz not null default now(),
  updated_by uuid default auth.uid() references auth.users (id) on delete set null,
  primary key (item_id, ay, sem)
);

-- item_id is covered by the primary key; ay by this index.
create index item_status_ay_sem_idx on public.item_status (ay, sem);
create index item_status_updated_by_idx on public.item_status (updated_by);

alter table public.item_status enable row level security;

create policy "item_status: signed-in users read" on public.item_status
  for select to authenticated using (true);
create policy "item_status: admin inserts" on public.item_status
  for insert to authenticated with check ((select public.is_admin()));
create policy "item_status: admin updates" on public.item_status
  for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "item_status: admin deletes" on public.item_status
  for delete to authenticated using ((select public.is_admin()));
