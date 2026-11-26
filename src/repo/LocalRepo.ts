import { applyBulkCriteria, applyReassign, applyRename, nameKey } from '../lib/faculty'
import { STATUS_LABELS, statusKey } from '../lib/scoring'
import type {
  ActivityEntry,
  AppState,
  ChecklistItem,
  CriteriaBulkPatch,
  CriterionPatch,
  DeptFile,
  Faculty,
  FacultyPatch,
  FilePatch,
  ItemPatch,
  ItemStatus,
  NewFileInput,
  Period,
  ReassignChange,
  User,
} from '../types'
import { initialState, migrate } from './initialState'
import { ACTIVITY_LIMIT, PermissionError, type Repo } from './Repo'
import { FIELD_LABELS, facultyChangeText, itemChangeText, newFile } from './shared'

const STORAGE_KEY = 'dept-files:state:v1'
const CHANNEL_NAME = 'dept-files'


function newId(prefix: string): string {
  const rand =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10)
  return `${prefix}-${rand}`
}

/**
 * Browser-only repo. State lives in localStorage; other tabs hear about changes
 * through BroadcastChannel (and the `storage` event as a fallback), so viewers
 * in another tab update live without a refresh.
 *
 * Replace with a SupabaseRepo in src/repo/index.ts when the backend is ready.
 */
export class LocalRepo implements Repo {
  private state: AppState | null = null
  private readonly listeners = new Set<(state: AppState) => void>()
  private readonly channel: BroadcastChannel | null

  constructor(private readonly storage: Storage = window.localStorage) {
    this.channel = typeof BroadcastChannel === 'undefined' ? null : new BroadcastChannel(CHANNEL_NAME)
    this.channel?.addEventListener('message', () => this.reloadFromStorage())
    window.addEventListener('storage', (e) => {
      if (e.key === STORAGE_KEY) this.reloadFromStorage()
    })
  }

  async load(): Promise<AppState> {
    if (!this.state) {
      const saved = this.read()
      if (saved) {
        this.state = saved
      } else {
        // Unreadable or older-version data: keep a copy before replacing it with the seed.
        const raw = this.storage.getItem(STORAGE_KEY)
        if (raw) this.storage.setItem(`${STORAGE_KEY}:backup:${Date.now()}`, raw)
        this.state = initialState()
        this.write(this.state)
      }
    }
    return this.state
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
    await this.commit(actor, (s) => {
      const file = this.requireFile(s, fileId)
      Object.assign(file, patch)
      return { what: `Edited ${keys.map((k) => FIELD_LABELS[k]).join(', ')} of ${file.code}`, fileId }
    })
  }

  async setStatus(itemId: string, period: Period, status: ItemStatus, actor: User): Promise<void> {
    await this.commit(actor, (s) => {
      const item = this.requireItem(s, itemId)
      const file = this.requireFile(s, item.fileId)
      s.statuses[statusKey(itemId, period)] = status
      return {
        what: `Marked "${item.label}" in ${file.code} as ${STATUS_LABELS[status]} (${period.ay} ${period.sem})`,
        fileId: file.id,
      }
    })
  }

  async addItem(fileId: string, label: string, actor: User): Promise<ChecklistItem> {
    let created: ChecklistItem | undefined
    await this.commit(actor, (s) => {
      const file = this.requireFile(s, fileId)
      if (file.container) throw new Error(`${file.code} is a container and has no checklist.`)
      const order = Math.max(0, ...s.items.filter((i) => i.fileId === fileId).map((i) => i.order)) + 1
      created = { id: newId(file.code), fileId, order, label: label.trim(), repeating: false, note: '' }
      s.items.push(created)
      return { what: `Added checklist item "${created.label}" to ${file.code}`, fileId }
    })
    return created!
  }

  async updateItem(itemId: string, patch: ItemPatch, actor: User): Promise<void> {
    await this.commit(actor, (s) => {
      const item = this.requireItem(s, itemId)
      const file = this.requireFile(s, item.fileId)
      const what = itemChangeText(item, patch, file.code)
      Object.assign(item, patch)
      return { what, fileId: file.id }
    })
  }

  async deleteItem(itemId: string, actor: User): Promise<void> {
    await this.commit(actor, (s) => {
      const item = this.requireItem(s, itemId)
      const file = this.requireFile(s, item.fileId)
      s.items = s.items.filter((i) => i.id !== itemId)
      dropStatuses(s, new Set([itemId]))
      return { what: `Deleted checklist item "${item.label}" from ${file.code}`, fileId: file.id }
    })
  }

  async addFile(input: NewFileInput, actor: User): Promise<DeptFile> {
    let created: DeptFile | undefined
    await this.commit(actor, (s) => {
      created = newFile(input, s.files)
      s.files.push(created)
      renumber(s, input.domain)
      return { what: `Added file ${created.code} "${created.title}"`, fileId: created.id }
    })
    return created!
  }

  async deleteFile(fileId: string, actor: User): Promise<void> {
    await this.commit(actor, (s) => {
      const file = this.requireFile(s, fileId)
      if (file.container) throw new Error(`${file.code} holds the ${file.container} files and cannot be deleted.`)
      const itemIds = new Set(s.items.filter((i) => i.fileId === fileId).map((i) => i.id))
      s.files = s.files.filter((f) => f.id !== fileId)
      s.items = s.items.filter((i) => i.fileId !== fileId)
      dropStatuses(s, itemIds)
      renumber(s, file.domain)
      return { what: `Deleted file ${file.code} "${file.title}"` }
    })
  }

  async addAcademicYear(ay: string, actor: User): Promise<void> {
    await this.commit(actor, (s) => {
      const year = ay.trim()
      if (!/^\d{4}-\d{2}$/.test(year)) throw new Error('Academic year must look like 2027-28.')
      if (s.academicYears.includes(year)) throw new Error(`${year} already exists.`)
      s.academicYears = [...s.academicYears, year].sort()
      return { what: `Added academic year ${year} (checklists kept, statuses reset)` }
    })
  }

  async addFaculty(name: string, designation: string, actor: User): Promise<Faculty> {
    let created: Faculty | undefined
    await this.commit(actor, (s) => {
      const clean = name.trim()
      if (!clean) throw new Error('Enter a name.')
      if (s.faculty.some((f) => nameKey(f.name) === nameKey(clean))) throw new Error(`${clean} is already in the faculty list.`)
      created = { id: crypto.randomUUID(), name: clean, designation: designation.trim(), active: true }
      s.faculty.push(created)
      return { what: `Added faculty ${clean}` }
    })
    return created!
  }

  async updateFaculty(facultyId: string, patch: FacultyPatch, actor: User): Promise<void> {
    await this.commit(actor, (s) => {
      const f = this.requireFaculty(s, facultyId)
      Object.assign(f, patch)
      return { what: facultyChangeText(f, patch) }
    })
  }

  async renameFaculty(facultyId: string, newName: string, actor: User): Promise<void> {
    await this.commit(actor, (s) => {
      const f = this.requireFaculty(s, facultyId)
      const to = newName.trim()
      if (!to) throw new Error('Enter a name.')
      if (s.faculty.some((x) => x.id !== facultyId && nameKey(x.name) === nameKey(to))) throw new Error(`${to} is already in the faculty list.`)
      const from = f.name
      f.name = to
      const fileCodes = applyRename(s, from, to)
      return { what: `Renamed faculty ${from} to ${to} (${fileCodes.length} files updated)`, fileCodes }
    })
  }

  async reassignFaculty(changes: ReassignChange[], recordPrevious: boolean, actor: User): Promise<void> {
    await this.commit(actor, (s) => {
      const fileCodes = applyReassign(s, changes, recordPrevious)
      if (fileCodes.length === 0) throw new Error('No files were reassigned.')
      const pairs = [...new Set(changes.map((c) => `${c.from.trim()} to ${c.to.trim()}`))].join('; ')
      return { what: `Reassigned ${fileCodes.length} files: ${pairs}${recordPrevious ? ' (previous maintainer recorded)' : ''}`, fileCodes }
    })
  }

  async updateCriterion(criterionId: string, patch: CriterionPatch, actor: User): Promise<void> {
    await this.commit(actor, (s) => {
      const c = s.criteria.find((x) => x.id === criterionId)
      if (!c) throw new Error(`Criterion ${criterionId} not found.`)
      Object.assign(c, { ...patch, title: patch.title?.trim() ?? c.title, coordinator: patch.coordinator?.trim() ?? c.coordinator })
      return { what: `Edited criterion ${c.id}: ${c.title}${c.coordinator ? `, coordinator ${c.coordinator}` : ''}` }
    })
  }

  async bulkUpdateFileCriteria(fileIds: string[], patch: CriteriaBulkPatch, actor: User): Promise<void> {
    await this.commit(actor, (s) => {
      const fileCodes = applyBulkCriteria(s, fileIds, patch)
      if (fileCodes.length === 0) throw new Error('Select at least one file.')
      return { what: `Updated criteria on ${fileCodes.length} files`, fileCodes }
    })
  }

  // ---------------------------------------------------------------------------

  /** Serialises writes so two commits in the same tick cannot clone the same base state. */
  private queue: Promise<unknown> = Promise.resolve()

  private commit(
    actor: User,
    mutate: (draft: AppState) => { what: string; fileId?: string; fileCodes?: string[] },
  ): Promise<void> {
    if (actor.role !== 'admin') return Promise.reject(new PermissionError())
    const run = this.queue.then(async () => {
      await this.load()
      // Start from the latest saved state (another tab may have written since we last heard).
      const base = this.read() ?? this.state!
      const draft = structuredClone(base)
      const { what, fileId, fileCodes } = mutate(draft)
      const entry: ActivityEntry = { id: newId('log'), at: new Date().toISOString(), who: actor.name, what, fileId, fileCodes }
      draft.activity = [entry, ...draft.activity].slice(0, ACTIVITY_LIMIT)
      this.write(draft) // throws on quota errors before memory changes
      this.state = draft
      this.emit()
      this.channel?.postMessage({ type: 'changed', at: entry.at })
    })
    this.queue = run.catch(() => undefined)
    return run
  }

  private requireFile(s: AppState, fileId: string): DeptFile {
    const file = s.files.find((f) => f.id === fileId)
    if (!file) throw new Error(`File ${fileId} not found.`)
    return file
  }

  private requireFaculty(s: AppState, facultyId: string): Faculty {
    const f = s.faculty.find((x) => x.id === facultyId)
    if (!f) throw new Error('Faculty member not found.')
    return f
  }

  private requireItem(s: AppState, itemId: string): ChecklistItem {
    const item = s.items.find((i) => i.id === itemId)
    if (!item) throw new Error(`Checklist item ${itemId} not found.`)
    return item
  }

  private read(): AppState | null {
    try {
      const raw = this.storage.getItem(STORAGE_KEY)
      if (!raw) return null
      return migrate(JSON.parse(raw) as AppState)
    } catch {
      return null
    }
  }

  private write(state: AppState): void {
    this.storage.setItem(STORAGE_KEY, JSON.stringify(state))
  }

  private reloadFromStorage(): void {
    const next = this.read()
    if (!next) return
    this.state = next
    this.emit()
  }

  private emit(): void {
    const s = this.state
    if (s) for (const l of this.listeners) l(s)
  }
}

function dropStatuses(s: AppState, itemIds: Set<string>): void {
  for (const key of Object.keys(s.statuses)) {
    if (itemIds.has(key.split('|')[0] ?? '')) delete s.statuses[key]
  }
}

/** Re-sorts a domain by code and rewrites `order` as 1..n. */
function renumber(s: AppState, domain: DeptFile['domain']): void {
  const key = (code: string) => {
    const m = /^[ADP](\d+)(?:\.(\d+))?$/.exec(code)
    return m ? Number(m[1]) * 1000 + Number(m[2] ?? 0) : Number.MAX_SAFE_INTEGER
  }
  s.files
    .filter((f) => f.domain === domain)
    .sort((a, b) => key(a.code) - key(b.code))
    .forEach((f, i) => {
      f.order = i + 1
    })
}
