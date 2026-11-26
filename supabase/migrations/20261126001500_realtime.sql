-- Stream changes to signed-in clients (postgres_changes). Realtime applies each
-- table's select policy, so only authenticated users receive rows.
-- profiles is left out on purpose.
alter publication supabase_realtime add table
  public.academic_years,
  public.faculty,
  public.criteria,
  public.files,
  public.checklist_items,
  public.item_status,
  public.activity_log;
