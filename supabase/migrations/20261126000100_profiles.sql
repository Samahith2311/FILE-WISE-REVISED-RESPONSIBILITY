-- One row per sign-in account. The role decides who may write; it is set by hand
-- in the SQL editor (see README) and can never be changed from the app.
create table public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default '',
  role text not null default 'viewer' check (role in ('admin', 'viewer'))
);

alter table public.profiles enable row level security;

-- Each user reads only their own row. No insert, update or delete policies:
-- the client cannot create profiles or change a role.
create policy "profiles: read own row" on public.profiles
  for select to authenticated
  using (user_id = (select auth.uid()));
