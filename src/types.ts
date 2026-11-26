export type DomainId = 'D' | 'A' | 'P'
export type Semester = 'Odd' | 'Even'
export type ItemStatus = 'completed' | 'partial' | 'not_completed' | 'na'

export interface Domain {
  id: DomainId
  name: string
  range: string
}

export interface Presentation {
  /** C1 to C9, or empty. */
  criteria: string
  person: string
  proposed: boolean
}

export interface DeptFile {
  id: string
  code: string
  domain: DomainId
  order: number
  title: string
  proposedTitle: boolean
  /** Parent code for sub-parts, e.g. "P08" for P08.1. */
  group: string | null
  /** Set on D13: the domain whose files it holds. A container has no checklist. */
  container: DomainId | null
  maintainer: string
  previousMaintainer: string
  presentedIn: Presentation
  previousPresentation: string
  relatedCriteria: string[]
  physicalLocation: string
  notes: string
}

export interface ChecklistItem {
  id: string
  fileId: string
  order: number
  label: string
  /** Repeats per batch or instance (e.g. one row per project batch). */
  repeating: boolean
  note: string
  template?: string
}

export interface Period {
  ay: string
  sem: Semester
}

export interface ActivityEntry {
  id: string
  /** ISO timestamp. */
  at: string
  who: string
  what: string
  fileId?: string
}

export interface AppState {
  version: number
  academicYears: string[]
  domains: Domain[]
  files: DeptFile[]
  items: ChecklistItem[]
  /** Keyed `${itemId}|${ay}|${sem}`. A missing key means not completed. */
  statuses: Record<string, ItemStatus>
  /** Newest first, capped at ACTIVITY_LIMIT. */
  activity: ActivityEntry[]
}

export type Role = 'admin' | 'viewer'

export interface User {
  id: string
  name: string
  role: Role
}

/** Fields of a file the admin can edit. */
export type FilePatch = Partial<
  Pick<
    DeptFile,
    | 'title'
    | 'maintainer'
    | 'previousMaintainer'
    | 'presentedIn'
    | 'previousPresentation'
    | 'relatedCriteria'
    | 'physicalLocation'
    | 'notes'
  >
>

export type ItemPatch = Partial<Pick<ChecklistItem, 'label' | 'repeating' | 'note'>>

export interface NewFileInput {
  code: string
  domain: DomainId
  title: string
  maintainer?: string
}
