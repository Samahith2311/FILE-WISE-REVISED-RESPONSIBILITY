import type { RealtimeChannel, RealtimePostgresChangesPayload, SupabaseClient } from '@supabase/supabase-js'
import seed from '../data/seed.json'
import { statusKey } from '../lib/scoring'
import type { AppState, ChecklistItem, CriteriaBulkPatch, CriterionPatch, DeptFile, Domain, Faculty, FacultyPatch, FilePatch, ItemPatch, ItemStatus, NewFileInput, Period, ReassignChange, Semester, User } from '../types'
import { STATE_VERSION } from './initialState'
import { ACTIVITY_LIMIT, PermissionError, type Repo } from './Repo'
import { toActivity, toCriterion, toFaculty, toFile, toItem, type ActivityRow, type CriterionRow, type FacultyRow, type FileRow, type ItemRow, type StatusRow } from './supabaseMap'
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

  async updateFile(_fileId: string, _patch: FilePatch, _actor: User): Promise<void> {
    throw new Error('Not implemented yet.')
  }

  async setStatus(_itemId: string, _period: Period, _status: ItemStatus, _actor: User): Promise<void> {
    throw new Error('Not implemented yet.')
  }

  async addItem(_fileId: string, _label: string, _actor: User): Promise<ChecklistItem> {
    throw new Error('Not implemented yet.')
  }

  async updateItem(_itemId: string, _patch: ItemPatch, _actor: User): Promise<void> {
    throw new Error('Not implemented yet.')
  }

  async deleteItem(_itemId: string, _actor: User): Promise<void> {
    throw new Error('Not implemented yet.')
  }

  async addFile(_input: NewFileInput, _actor: User): Promise<DeptFile> {
    throw new Error('Not implemented yet.')
  }

  async deleteFile(_fileId: string, _actor: User): Promise<void> {
    throw new Error('Not implemented yet.')
  }

  async addAcademicYear(_ay: string, _actor: User): Promise<void> {
    throw new Error('Not implemented yet.')
  }

  async addFaculty(_name: string, _designation: string, _actor: User): Promise<Faculty> {
    throw new Error('Not implemented yet.')
  }

  async updateFaculty(_facultyId: string, _patch: FacultyPatch, _actor: User): Promise<void> {
    throw new Error('Not implemented yet.')
  }

  async renameFaculty(_facultyId: string, _newName: string, _actor: User): Promise<void> {
    throw new Error('Not implemented yet.')
  }

  async reassignFaculty(_changes: ReassignChange[], _recordPrevious: boolean, _actor: User): Promise<void> {
    throw new Error('Not implemented yet.')
  }

  async updateCriterion(_criterionId: string, _patch: CriterionPatch, _actor: User): Promise<void> {
    throw new Error('Not implemented yet.')
  }

  async bulkUpdateFileCriteria(_fileIds: string[], _patch: CriteriaBulkPatch, _actor: User): Promise<void> {
    throw new Error('Not implemented yet.')
  }

  // ---------------------------------------------------------------------------

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
