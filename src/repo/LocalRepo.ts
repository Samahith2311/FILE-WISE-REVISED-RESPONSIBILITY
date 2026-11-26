import { STATUS_LABELS, statusKey } from '../lib/scoring'
import type {
  ActivityEntry,
  AppState,
  ChecklistItem,
  DeptFile,
  FilePatch,
  ItemPatch,
  ItemStatus,
  NewFileInput,
  Period,
  User,
} from '../types'
import { initialState, STATE_VERSION } from './initialState'
import { ACTIVITY_LIMIT, PermissionError, type Repo } from './Repo'

const STORAGE_KEY = 'dept-files:state:v1'
const CHANNEL_NAME = 'dept-files'

const FIELD_LABELS: Record<keyof FilePatch, string> = {
  title: 'title',
  maintainer: 'maintainer',
  previousMaintainer: 'previous maintainer',
  presentedIn: 'presented in',
  previousPresentation: 'previous presentation',
  relatedCriteria: 'related criteria',
  physicalLocation: 'physical location',
  notes: 'notes',
}

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
      const before = item.label
      Object.assign(item, patch)
      const parts: string[] = []
      if (patch.label !== undefined && patch.label !== before) parts.push(`renamed "${before}" to "${item.label}"`)
      if (patch.repeating !== undefined) parts.push(`${patch.repeating ? 'marked' : 'unmarked'} "${item.label}" as repeating`)
      if (patch.note !== undefined) parts.push(`edited the note on "${item.label}"`)
      return { what: `In ${file.code}: ${parts.join('; ') || 'edited an item'}`, fileId: file.id }
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
      const code = input.code.trim().toUpperCase()
      if (!/^[ADP]\d{2}(\.\d+)?$/.test(code)) throw new Error('Code must look like D34, A53 or P08.4.')
      if (code[0] !== input.domain) throw new Error(`Code ${code} does not belong to domain ${input.domain}.`)
      if (s.files.some((f) => f.code === code)) throw new Error(`${code} already exists.`)
      const group = /^(P\d{2})\.\d+$/.exec(code)?.[1] ?? null
      created = {
        id: code,
        code,
        domain: input.domain,
        order: 0,
        title: input.title.trim(),
        proposedTitle: false,
        group,
        container: null,
        maintainer: input.maintainer?.trim() ?? '',
        previousMaintainer: '',
        presentedIn: { criteria: '', person: '', proposed: false },
        previousPresentation: '',
        relatedCriteria: [],
        physicalLocation: '',
        notes: '',
      }
      s.files.push(created)
      renumber(s, input.domain)
      return { what: `Added file ${code} "${created.title}"`, fileId: code }
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

  // ---------------------------------------------------------------------------

  /** Serialises writes so two commits in the same tick cannot clone the same base state. */
  private queue: Promise<unknown> = Promise.resolve()

  private commit(actor: User, mutate: (draft: AppState) => { what: string; fileId?: string }): Promise<void> {
    if (actor.role !== 'admin') return Promise.reject(new PermissionError())
    const run = this.queue.then(async () => {
      await this.load()
      // Start from the latest saved state (another tab may have written since we last heard).
      const base = this.read() ?? this.state!
      const draft = structuredClone(base)
      const { what, fileId } = mutate(draft)
      const entry: ActivityEntry = { id: newId('log'), at: new Date().toISOString(), who: actor.name, what, fileId }
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

  private requireItem(s: AppState, itemId: string): ChecklistItem {
    const item = s.items.find((i) => i.id === itemId)
    if (!item) throw new Error(`Checklist item ${itemId} not found.`)
    return item
  }

  private read(): AppState | null {
    try {
      const raw = this.storage.getItem(STORAGE_KEY)
      if (!raw) return null
      const parsed = JSON.parse(raw) as AppState
      return parsed.version === STATE_VERSION ? parsed : null
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
