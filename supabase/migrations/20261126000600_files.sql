-- One row per tracked file (D, A and P). People are free text, as in the docx.
-- sort_order = major * 1000 + minor from the code (P08.2 -> 8002), so new files
-- sort into place without renumbering the others.
create table public.files (
  id text primary key,
  code text not null unique check (code ~ '^[ADP]\d{2}(\.\d+)?$'),
  domain text not null check (domain in ('D', 'A', 'P')),
  sort_order integer not null,
  title text not null check (btrim(title) <> ''),
  proposed_title boolean not null default false,
  group_code text,
  container text check (container in ('D', 'A', 'P')),
  maintainer text not null default '',
  previous_maintainer text not null default '',
  presented_criteria text not null default '' check (presented_criteria = '' or presented_criteria ~ '^C[1-9]$'),
  presented_person text not null default '',
  presented_proposed boolean not null default false,
  previous_presentation text not null default '',
  related_criteria text[] not null default '{}'
    check (related_criteria <@ array['C1', 'C2', 'C3', 'C4', 'C5', 'C6', 'C7', 'C8', 'C9']),
  physical_location text not null default '',
  notes text not null default '',
  updated_at timestamptz not null default now(),
  check (left(code, 1) = domain)
);

alter table public.files enable row level security;

create policy "files: signed-in users read" on public.files
  for select to authenticated using (true);
create policy "files: admin inserts" on public.files
  for insert to authenticated with check ((select public.is_admin()));
create policy "files: admin updates" on public.files
  for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "files: admin deletes" on public.files
  for delete to authenticated using ((select public.is_admin()));
