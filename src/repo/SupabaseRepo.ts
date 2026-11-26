import type { RealtimeChannel, RealtimePostgresChangesPayload, SupabaseClient } from '@supabase/supabase-js'
import seed from '../data/seed.json'
import { STATUS_LABELS, statusKey } from '../lib/scoring'
import type {
  AppState,
  ChecklistItem,
  CriteriaBulkPatch,
  CriterionPatch,
  DeptFile,
  Domain,
  Faculty,
  FacultyPatch,
  FilePatch,
  ItemPatch,
  ItemStatus,
  NewFileInput,
  Period,
  ReassignChange,
  Semester,
  User,
} from '../types'
import { STATE_VERSION } from './initialState'
import { ACTIVITY_LIMIT, PermissionError, type Repo } from './Repo'
import { FIELD_LABELS, facultyChangeText, itemChangeText, newFile } from './shared'
import {
  fileToRow,
  filePatchToRow,
  itemPatchToRow,
  toActivity,
  toCriterion,
  toFaculty,
  toFile,
  toItem,
  type ActivityRow,
  type CriterionRow,
  type FacultyRow,
  type FileRow,
  type ItemRow,
  type StatusRow,
} from './supabaseMap'

const TABLES = ['academic_years', 'faculty', 'criteria', 'files', 'checklist_items', 'item_status', 'activity_log'] as const
type Table = (typeof TABLES)[number]
type Row = Record<string, unknown>
interface DbError {
  code?: string
  message: string
}

/** PostgREST returns at most 1000 rows per request. */
const PAGE = 1000

function fail(error: DbError): never {
  if (error.code === '42501') throw new PermissionError()
  throw new Error(error.message)
}

/**
 * Repo backed by Supabase. Row-level security in supabase/migrations enforces
 * "read: signed-in users, write: admin only"; the role check here only gives a
 * clearer message.
 *
 * Live updates: one realtime channel listens to postgres_changes on every table and
 * applies each row change to the cached state. Every (re)subscribe triggers a full
 * reload, which also covers changes missed while offline or during a channel error.
 *
 * Writes update the cache only after Supabase returns the saved row. Bulk actions
 * run as Postgres functions (one transaction each) and are followed by a reload.
 */
export class SupabaseRepo implements Repo {
  private state: AppState | null = null
  private loading: Promise<AppState> | null = null
  private channel: RealtimeChannel | null = null
  private readonly listeners = new Set<(state: AppState) => void>()

  constructor(private readonly sb: SupabaseClient) {
    // Sign-out closes the realtime channel and drops the cached data.
    sb.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') setTimeout(() => void this.close(), 0)
    })
  }

  load(): Promise<AppState> {
    if (this.state) return Promise.resolve(this.state)
    if (!this.loading) {
      this.openChannel()
      this.loading = this.fetchAll()
        .then((s) => (this.state = s))
        .finally(() => (this.loading = null))
    }
    return this.loading
  }

  subscribe(listener: (state: AppState) => void): () => void {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  async updateFile(fileId: string, patch: FilePatch, actor: User): Promise<void> {
    const keys = Object.keys(patch) as Array<keyof FilePatch>
    if (keys.length === 0) return
    this.guard(actor)
    const row = await this.one<FileRow>(
      this.sb.from('files').update({ ...filePatchToRow(patch), updated_at: new Date().toISOString() }).eq('id', fileId).select(),
    )
    this.apply('files', row)
    await this.log(actor, `Edited ${keys.map((k) => FIELD_LABELS[k]).join(', ')} of ${row.code}`, fileId)
  }

  async setStatus(itemId: string, period: Period, status: ItemStatus, actor: User): Promise<void> {
    this.guard(actor)
    const item = this.requireItem(itemId)
    const file = this.requireFile(item.fileId)
    const { data } = await this.sb.auth.getSession()
    const row = await this.one<StatusRow>(
      this.sb
        .from('item_status')
        .upsert(
          { item_id: itemId, ay: period.ay, sem: period.sem, status, updated_at: new Date().toISOString(), updated_by: data.session?.user.id ?? null },
          { onConflict: 'item_id,ay,sem' },
        )
        .select(),
    )
    this.apply('item_status', row)
    await this.log(actor, `Marked "${item.label}" in ${file.code} as ${STATUS_LABELS[status]} (${period.ay} ${period.sem})`, file.id)
  }

  async addItem(fileId: string, label: string, actor: User): Promise<ChecklistItem> {
    this.guard(actor)
    const file = this.requireFile(fileId)
    if (file.container) throw new Error(`${file.code} is a container and has no checklist.`)
    const order = Math.max(0, ...this.cached().items.filter((i) => i.fileId === fileId).map((i) => i.order)) + 1
    const row = await this.one<ItemRow>(
      this.sb
        .from('checklist_items')
        .insert({ id: `${file.code}-${crypto.randomUUID().slice(0, 8)}`, file_id: fileId, sort_order: order, label: label.trim() })
        .select(),
    )
    this.apply('checklist_items', row)
    await this.log(actor, `Added checklist item "${row.label}" to ${file.code}`, fileId)
    return toItem(row)
  }

  async updateItem(itemId: string, patch: ItemPatch, actor: User): Promise<void> {
    this.guard(actor)
    const item = this.requireItem(itemId)
    const file = this.requireFile(item.fileId)
    const row = await this.one<ItemRow>(this.sb.from('checklist_items').update(itemPatchToRow(patch)).eq('id', itemId).select())
    this.apply('checklist_items', row)
    await this.log(actor, itemChangeText(item, patch, file.code), file.id)
  }

  async deleteItem(itemId: string, actor: User): Promise<void> {
    this.guard(actor)
    const item = this.requireItem(itemId)
    const file = this.requireFile(item.fileId)
    const row = await this.one<ItemRow>(this.sb.from('checklist_items').delete().eq('id', itemId).select())
    this.apply('checklist_items', null, row)
    await this.log(actor, `Deleted checklist item "${item.label}" from ${file.code}`, file.id)
  }

  async addFile(input: NewFileInput, actor: User): Promise<DeptFile> {
    this.guard(actor)
    const file = newFile(input, this.cached().files)
    const row = await this.one<FileRow>(this.sb.from('files').insert(fileToRow(file)).select())
    this.apply('files', row)
    await this.log(actor, `Added file ${row.code} "${row.title}"`, row.id)
    return toFile(row)
  }

  async deleteFile(fileId: string, actor: User): Promise<void> {
    this.guard(actor)
    const file = this.requireFile(fileId)
    if (file.container) throw new Error(`${file.code} holds the ${file.container} files and cannot be deleted.`)
    const row = await this.one<FileRow>(this.sb.from('files').delete().eq('id', fileId).select())
    this.apply('files', null, row)
    await this.log(actor, `Deleted file ${file.code} "${file.title}"`)
  }

  async addAcademicYear(ay: string, actor: User): Promise<void> {
    await this.rpc(actor, 'add_academic_year', { p_ay: ay })
  }

  async addFaculty(name: string, designation: string, actor: User): Promise<Faculty> {
    this.guard(actor)
    const clean = name.trim()
    if (!clean) throw new Error('Enter a name.')
    const row = await this.one<FacultyRow>(this.sb.from('faculty').insert({ name: clean, designation: designation.trim() }).select())
    this.apply('faculty', row)
    await this.log(actor, `Added faculty ${row.name}`)
    return toFaculty(row)
  }

  async updateFaculty(facultyId: string, patch: FacultyPatch, actor: User): Promise<void> {
    this.guard(actor)
    const row = await this.one<FacultyRow>(this.sb.from('faculty').update(patch).eq('id', facultyId).select())
    this.apply('faculty', row)
    await this.log(actor, facultyChangeText(toFaculty(row), patch))
  }

  async renameFaculty(facultyId: string, newName: string, actor: User): Promise<void> {
    await this.rpc(actor, 'rename_faculty', { p_faculty_id: facultyId, p_new_name: newName })
  }

  async reassignFaculty(changes: ReassignChange[], recordPrevious: boolean, actor: User): Promise<void> {
    await this.rpc(actor, 'reassign_faculty', { p_changes: changes, p_record_previous: recordPrevious })
  }

  async updateCriterion(criterionId: string, patch: CriterionPatch, actor: User): Promise<void> {
    this.guard(actor)
    const row = await this.one<CriterionRow>(
      this.sb
        .from('criteria')
        .update({
          ...(patch.title !== undefined && { title: patch.title.trim() }),
          ...(patch.coordinator !== undefined && { coordinator: patch.coordinator.trim() }),
        })
        .eq('id', criterionId)
        .select(),
    )
    this.apply('criteria', row)
    await this.log(actor, `Edited criterion ${row.id}: ${row.title}${row.coordinator ? `, coordinator ${row.coordinator}` : ''}`)
  }

  async bulkUpdateFileCriteria(fileIds: string[], patch: CriteriaBulkPatch, actor: User): Promise<void> {
    await this.rpc(actor, 'bulk_update_file_criteria', { p_file_ids: fileIds, p_patch: patch })
  }

  // ---------------------------------------------------------------------------

  private guard(actor: User): void {
    if (actor.role !== 'admin') throw new PermissionError()
  }

  private cached(): AppState {
    if (!this.state) throw new Error('Data is not loaded yet.')
    return this.state
  }

  private requireFile(fileId: string): DeptFile {
    const file = this.cached().files.find((f) => f.id === fileId)
    if (!file) throw new Error(`File ${fileId} not found.`)
    return file
  }

  private requireItem(itemId: string): ChecklistItem {
    const item = this.cached().items.find((i) => i.id === itemId)
    if (!item) throw new Error(`Checklist item ${itemId} not found.`)
    return item
  }

  /** Runs one write and returns the saved row. No row back means RLS hid it or it was gone. */
  private async one<T>(query: PromiseLike<{ data: T[] | null; error: DbError | null }>): Promise<T> {
    const { data, error } = await query
    if (error) fail(error)
    const row = data?.[0]
    if (!row) throw new Error('Not saved: the record was not found or you do not have permission.')
    return row
  }

  // shortcut: the write and its log row are two requests, not one transaction; move both into an RPC if a lost log row ever matters.
  private async log(actor: User, what: string, fileId?: string): Promise<void> {
    const row = await this.one<ActivityRow>(this.sb.from('activity_log').insert({ who: actor.name, what, file_id: fileId ?? null }).select())
    this.apply('activity_log', row)
  }

  /** Bulk actions: one Postgres transaction each (which also writes the log), then a full reload. */
  private async rpc(actor: User, fn: string, args: Record<string, unknown>): Promise<void> {
    this.guard(actor)
    const { error } = await this.sb.rpc(fn, args)
    if (error) fail(error)
    await this.reload()
  }

  private async fetchAll(): Promise<AppState> {
    const [years, faculty, criteria, files, items, statuses, activity] = await Promise.all([
      this.all<{ ay: string }>('academic_years', ['ay'], 'ay'),
      this.all<FacultyRow>('faculty', ['name']),
      this.all<CriterionRow>('criteria', ['id']),
      this.all<FileRow>('files', ['sort_order', 'id']),
      this.all<ItemRow>('checklist_items', ['file_id', 'sort_order', 'id']),
      this.all<StatusRow>('item_status', ['item_id', 'ay', 'sem'], 'item_id, ay, sem, status'),
      this.sb.from('activity_log').select('*').order('at', { ascending: false }).order('id', { ascending: false }).limit(ACTIVITY_LIMIT),
    ])
    if (activity.error) fail(activity.error)
    const statusMap: Record<string, ItemStatus> = {}
    for (const r of statuses) statusMap[statusKey(r.item_id, { ay: r.ay, sem: r.sem })] = r.status
    return {
      version: STATE_VERSION,
      academicYears: years.map((y) => y.ay),
      domains: seed.domains as Domain[],
      files: files.map(toFile),
      items: items.map(toItem),
      faculty: faculty.map(toFaculty),
      criteria: criteria.map(toCriterion).sort((a, b) => Number(a.id.slice(1)) - Number(b.id.slice(1))),
      statuses: statusMap,
      activity: ((activity.data ?? []) as ActivityRow[]).map(toActivity),
    }
  }

  private async all<T>(table: Table, order: string[], columns = '*'): Promise<T[]> {
    const rows: T[] = []
    for (let from = 0; ; from += PAGE) {
      let query = this.sb.from(table).select(columns)
      for (const column of order) query = query.order(column)
      const { data, error } = await query.range(from, from + PAGE - 1)
      if (error) fail(error)
      rows.push(...(data as T[]))
      if (data.length < PAGE) return rows
    }
  }

  private async reload(): Promise<void> {
    try {
      if (this.loading) await this.loading
      this.state = await this.fetchAll()
      this.emit()
    } catch (e) {
      console.error('Reload from Supabase failed', e)
    }
  }

  private openChannel(): void {
    if (this.channel) return
    let channel = this.sb.channel('dept-files')
    for (const table of TABLES) {
      channel = channel.on('postgres_changes', { event: '*', schema: 'public', table }, (p: RealtimePostgresChangesPayload<Row>) =>
        p.eventType === 'DELETE' ? this.apply(table, null, p.old) : this.apply(table, p.new),
      )
    }
    this.channel = channel.subscribe((status) => {
      // Fires again after every reconnect. CHANNEL_ERROR and TIMED_OUT are retried by
      // supabase-js; the reload then runs on the next SUBSCRIBED.
      if (status === 'SUBSCRIBED') void this.reload()
    })
  }

  private async close(): Promise<void> {
    const channel = this.channel
    this.channel = null
    this.state = null
    if (channel) await this.sb.removeChannel(channel)
  }

  /**
   * Applies one row change to the cached state and notifies listeners.
   * `row` is the new row, or null for a delete (then `old` holds the primary key).
   * Applying the same change twice (our write, then its realtime echo) is harmless.
   */
  private apply(table: Table, row: object | null, old: object = {}): void {
    const s = this.state
    if (!s) return
    const key = (row ?? old) as Row
    const id = String(key.id)
    let next: AppState
    switch (table) {
      case 'files': {
        const files = replaceById(s.files, row && toFile(row as unknown as FileRow), id).sort((a, b) => a.order - b.order)
        const gone = row ? [] : s.items.filter((i) => i.fileId === id).map((i) => i.id)
        next = { ...s, files, items: row ? s.items : s.items.filter((i) => i.fileId !== id), statuses: dropStatuses(s.statuses, gone) }
        break
      }
      case 'checklist_items': {
        const items = replaceById(s.items, row && toItem(row as unknown as ItemRow), id).sort((a, b) => a.order - b.order)
        next = { ...s, items, statuses: row ? s.statuses : dropStatuses(s.statuses, [id]) }
        break
      }
      case 'faculty':
        next = { ...s, faculty: replaceById(s.faculty, row && toFaculty(row as unknown as FacultyRow), id).sort((a, b) => a.name.localeCompare(b.name)) }
        break
      case 'criteria':
        next = {
          ...s,
          criteria: replaceById(s.criteria, row && toCriterion(row as unknown as CriterionRow), id).sort(
            (a, b) => Number(a.id.slice(1)) - Number(b.id.slice(1)),
          ),
        }
        break
      case 'item_status': {
        const k = statusKey(String(key.item_id), { ay: String(key.ay), sem: key.sem as Semester })
        const statuses = { ...s.statuses }
        if (row) statuses[k] = (row as StatusRow).status
        else delete statuses[k]
        next = { ...s, statuses }
        break
      }
      case 'academic_years': {
        const ay = String(key.ay)
        const rest = s.academicYears.filter((y) => y !== ay)
        next = { ...s, academicYears: row ? [...rest, ay].sort() : rest }
        break
      }
      case 'activity_log': {
        const entry = row && toActivity(row as unknown as ActivityRow)
        const rest = s.activity.filter((a) => a.id !== id)
        next = { ...s, activity: entry ? [entry, ...rest].sort((a, b) => b.at.localeCompare(a.at)).slice(0, ACTIVITY_LIMIT) : rest }
        break
      }
    }
    this.state = next
    for (const l of this.listeners) l(next)
  }

  private emit(): void {
    const s = this.state
    if (s) for (const l of this.listeners) l(s)
  }
}

function replaceById<T extends { id: string }>(list: T[], item: T | null, id: string): T[] {
  const rest = list.filter((x) => x.id !== id)
  return item ? [...rest, item] : rest
}

function dropStatuses(statuses: Record<string, ItemStatus>, itemIds: string[]): Record<string, ItemStatus> {
  if (itemIds.length === 0) return statuses
  const ids = new Set(itemIds)
  return Object.fromEntries(Object.entries(statuses).filter(([k]) => !ids.has(k.split('|')[0] ?? '')))
}
