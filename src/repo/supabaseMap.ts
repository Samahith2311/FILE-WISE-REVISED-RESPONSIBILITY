/** Database rows (snake_case) <-> app types (camelCase). The only place column names appear. */
import type {
  ActivityEntry,
  ChecklistItem,
  Criterion,
  DeptFile,
  DomainId,
  Faculty,
  FilePatch,
  ItemPatch,
  ItemStatus,
  Semester,
} from '../types'

export interface FileRow {
  id: string
  code: string
  domain: DomainId
  sort_order: number
  title: string
  proposed_title: boolean
  group_code: string | null
  container: DomainId | null
  maintainer: string
  previous_maintainer: string
  presented_criteria: string
  presented_person: string
  presented_proposed: boolean
  previous_presentation: string
  related_criteria: string[]
  physical_location: string
  notes: string
}

export interface ItemRow {
  id: string
  file_id: string
  sort_order: number
  label: string
  repeating: boolean
  note: string
  template: string | null
}

export interface StatusRow {
  item_id: string
  ay: string
  sem: Semester
  status: ItemStatus
}

export interface ActivityRow {
  id: number | string
  at: string
  who: string
  what: string
  file_id: string | null
  file_codes: string[] | null
}

export type FacultyRow = Faculty
export type CriterionRow = Criterion

/** P08.2 -> 8002. Gives every file a fixed place without renumbering others. */
export function codeSortKey(code: string): number {
  const m = /^[ADP](\d+)(?:\.(\d+))?$/.exec(code)
  return m ? Number(m[1]) * 1000 + Number(m[2] ?? 0) : 999999
}

export function toFile(r: FileRow): DeptFile {
  return {
    id: r.id,
    code: r.code,
    domain: r.domain,
    order: r.sort_order,
    title: r.title,
    proposedTitle: r.proposed_title,
    group: r.group_code,
    container: r.container,
    maintainer: r.maintainer,
    previousMaintainer: r.previous_maintainer,
    presentedIn: { criteria: r.presented_criteria, person: r.presented_person, proposed: r.presented_proposed },
    previousPresentation: r.previous_presentation,
    relatedCriteria: r.related_criteria ?? [],
    physicalLocation: r.physical_location,
    notes: r.notes,
  }
}

export function fileToRow(f: DeptFile): FileRow {
  return {
    id: f.id,
    code: f.code,
    domain: f.domain,
    sort_order: codeSortKey(f.code),
    title: f.title,
    proposed_title: f.proposedTitle,
    group_code: f.group,
    container: f.container,
    ...filePatchToRow(f),
  } as FileRow
}

export function filePatchToRow(p: FilePatch): Partial<FileRow> {
  const row: Partial<FileRow> = {}
  if (p.title !== undefined) row.title = p.title
  if (p.maintainer !== undefined) row.maintainer = p.maintainer
  if (p.previousMaintainer !== undefined) row.previous_maintainer = p.previousMaintainer
  if (p.presentedIn !== undefined) {
    row.presented_criteria = p.presentedIn.criteria
    row.presented_person = p.presentedIn.person
    row.presented_proposed = p.presentedIn.proposed
  }
  if (p.previousPresentation !== undefined) row.previous_presentation = p.previousPresentation
  if (p.relatedCriteria !== undefined) row.related_criteria = p.relatedCriteria
  if (p.physicalLocation !== undefined) row.physical_location = p.physicalLocation
  if (p.notes !== undefined) row.notes = p.notes
  return row
}

export function toItem(r: ItemRow): ChecklistItem {
  return {
    id: r.id,
    fileId: r.file_id,
    order: r.sort_order,
    label: r.label,
    repeating: r.repeating,
    note: r.note,
    ...(r.template ? { template: r.template } : {}),
  }
}

export function itemToRow(i: ChecklistItem): ItemRow {
  return {
    id: i.id,
    file_id: i.fileId,
    sort_order: i.order,
    label: i.label,
    repeating: i.repeating,
    note: i.note,
    template: i.template ?? null,
  }
}

export function itemPatchToRow(p: ItemPatch): Partial<ItemRow> {
  const row: Partial<ItemRow> = {}
  if (p.label !== undefined) row.label = p.label
  if (p.repeating !== undefined) row.repeating = p.repeating
  if (p.note !== undefined) row.note = p.note
  return row
}

export function toActivity(r: ActivityRow): ActivityEntry {
  return {
    id: String(r.id),
    at: r.at,
    who: r.who,
    what: r.what,
    ...(r.file_id ? { fileId: r.file_id } : {}),
    ...(r.file_codes?.length ? { fileCodes: r.file_codes } : {}),
  }
}

export function toFaculty(r: FacultyRow): Faculty {
  return { id: r.id, name: r.name, designation: r.designation, active: r.active }
}

export function toCriterion(r: CriterionRow): Criterion {
  return { id: r.id, title: r.title, coordinator: r.coordinator }
}
