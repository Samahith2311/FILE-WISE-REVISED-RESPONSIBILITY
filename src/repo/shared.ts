/** Validation and activity-log wording shared by LocalRepo and SupabaseRepo. */
import type { ChecklistItem, DeptFile, Faculty, FacultyPatch, FilePatch, ItemPatch, NewFileInput } from '../types'

export const FIELD_LABELS: Record<keyof FilePatch, string> = {
  title: 'title',
  maintainer: 'maintainer',
  previousMaintainer: 'previous maintainer',
  presentedIn: 'presented in',
  previousPresentation: 'previous presentation',
  relatedCriteria: 'related criteria',
  physicalLocation: 'physical location',
  notes: 'notes',
}

/** Validates the input and builds the new file. `order` is set by the repo. */
export function newFile(input: NewFileInput, existing: DeptFile[]): DeptFile {
  const code = input.code.trim().toUpperCase()
  if (!/^[ADP]\d{2}(\.\d+)?$/.test(code)) throw new Error('Code must look like D34, A53 or P08.4.')
  if (code[0] !== input.domain) throw new Error(`Code ${code} does not belong to domain ${input.domain}.`)
  if (existing.some((f) => f.code === code)) throw new Error(`${code} already exists.`)
  if (!input.title.trim()) throw new Error('Enter a title.')
  return {
    id: code,
    code,
    domain: input.domain,
    order: 0,
    title: input.title.trim(),
    proposedTitle: false,
    group: /^(P\d{2})\.\d+$/.exec(code)?.[1] ?? null,
    container: null,
    maintainer: input.maintainer?.trim() ?? '',
    previousMaintainer: '',
    presentedIn: { criteria: '', person: '', proposed: false },
    previousPresentation: '',
    relatedCriteria: [],
    physicalLocation: '',
    notes: '',
  }
}

export function itemChangeText(before: ChecklistItem, patch: ItemPatch, fileCode: string): string {
  const label = patch.label ?? before.label
  const parts: string[] = []
  if (patch.label !== undefined && patch.label !== before.label) parts.push(`renamed "${before.label}" to "${label}"`)
  if (patch.repeating !== undefined) parts.push(`${patch.repeating ? 'marked' : 'unmarked'} "${label}" as repeating`)
  if (patch.note !== undefined) parts.push(`edited the note on "${label}"`)
  return `In ${fileCode}: ${parts.join('; ') || 'edited an item'}`
}

export function facultyChangeText(f: Faculty, patch: FacultyPatch): string {
  const parts = [
    patch.designation !== undefined && `designation to "${patch.designation}"`,
    patch.active !== undefined && (patch.active ? 'marked active' : 'marked inactive'),
  ].filter(Boolean)
  return `Faculty ${f.name}: ${parts.join(', ') || 'edited'}`
}
