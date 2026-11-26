create table public.checklist_items (
  id text primary key,
  file_id text not null references public.files (id) on delete cascade,
  sort_order integer not null default 0,
  label text not null check (btrim(label) <> ''),
  repeating boolean not null default false,
  note text not null default '',
  template text
);

create index checklist_items_file_id_idx on public.checklist_items (file_id);

alter table public.checklist_items enable row level security;

create policy "checklist_items: signed-in users read" on public.checklist_items
  for select to authenticated using (true);
create policy "checklist_items: admin inserts" on public.checklist_items
  for insert to authenticated with check ((select public.is_admin()));
create policy "checklist_items: admin updates" on public.checklist_items
  for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "checklist_items: admin deletes" on public.checklist_items
  for delete to authenticated using ((select public.is_admin()));
