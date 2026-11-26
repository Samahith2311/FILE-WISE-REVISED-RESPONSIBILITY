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

export interface Faculty {
  id: string
  name: string
  designation: string
  active: boolean
}

export interface Criterion {
  /** C1 to C9. */
  id: string
  title: string
  coordinator: string
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
  /** Files touched by a bulk action. */
  fileCodes?: string[]
}

export interface AppState {
  version: number
  academicYears: string[]
  domains: Domain[]
  files: DeptFile[]
  items: ChecklistItem[]
  faculty: Faculty[]
  criteria: Criterion[]
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

export type FacultyPatch = Partial<Pick<Faculty, 'designation' | 'active'>>
export type CriterionPatch = Partial<Pick<Criterion, 'title' | 'coordinator'>>

/** One ticked row in "reassign files": move `fileId` from maintainer `from` to `to`. */
export interface ReassignChange {
  fileId: string
  from: string
  to: string
}

/** Fields left undefined are not changed. */
export interface CriteriaBulkPatch {
  criteria?: string
  person?: string
  proposed?: boolean
  addRelated?: string[]
  removeRelated?: string[]
}
