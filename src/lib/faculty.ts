import type { AppState, CriteriaBulkPatch, ReassignChange } from '../types'

/**
 * People are stored as text in files ("Bhavya H S, Shalini M K", "Akshatha M (proposed)").
 * These helpers match names ignoring honorifics, case and "(...)" notes, so "Mr. Sharath"
 * and "Sharath" are the same person. supabase/migrations mirror these rules in SQL.
 */
export const HONORIFIC = /^(prof|mr|ms|mrs|dr)\.?\s+/i

export function nameKey(name: string): string {
  return name.replace(/\([^)]*\)/g, '').trim().replace(HONORIFIC, '').trim().toLowerCase()
}

export function splitPeople(text: string): string[] {
  return text
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean)
}

export function hasPerson(text: string, name: string): boolean {
  const key = nameKey(name)
  return splitPeople(text).some((p) => nameKey(p) === key)
}

/** Replaces `from` with `to` in a comma list, keeping notes like "(proposed)" and dropping duplicates. */
export function replacePerson(text: string, from: string, to: string): string {
  const fromKey = nameKey(from)
  const toKey = nameKey(to)
  const out: string[] = []
  for (const part of splitPeople(text)) {
    const key = nameKey(part)
    const next = key === fromKey ? `${to.trim()}${/\s*\([^)]*\)\s*$/.exec(part)?.[0] ?? ''}` : part
    if (key === fromKey && out.some((p) => nameKey(p) === toKey)) continue
    if (key !== fromKey && key === toKey && out.some((p) => nameKey(p) === toKey)) continue
    out.push(next)
  }
  return out.join(', ')
}

type Draft = Pick<AppState, 'files' | 'criteria'>

/** Renames a person everywhere a file or criterion mentions them. Returns the codes of changed files. */
export function applyRename(s: Draft, oldName: string, newName: string): string[] {
  const codes: string[] = []
  for (const f of s.files) {
    if (![f.maintainer, f.previousMaintainer, f.presentedIn.person].some((t) => hasPerson(t, oldName))) continue
    const before = JSON.stringify([f.maintainer, f.previousMaintainer, f.presentedIn.person])
    f.maintainer = replacePerson(f.maintainer, oldName, newName)
    f.previousMaintainer = replacePerson(f.previousMaintainer, oldName, newName)
    f.presentedIn = { ...f.presentedIn, person: replacePerson(f.presentedIn.person, oldName, newName) }
    if (JSON.stringify([f.maintainer, f.previousMaintainer, f.presentedIn.person]) !== before) codes.push(f.code)
  }
  for (const c of s.criteria) c.coordinator = replacePerson(c.coordinator, oldName, newName)
  return codes
}

/** Moves files from one maintainer to another. Returns the codes of changed files. */
export function applyReassign(s: Draft, changes: ReassignChange[], recordPrevious: boolean): string[] {
  const codes: string[] = []
  for (const ch of changes) {
    const f = s.files.find((x) => x.id === ch.fileId)
    if (!f || !ch.to.trim() || !hasPerson(f.maintainer, ch.from)) continue
    f.maintainer = replacePerson(f.maintainer, ch.from, ch.to)
    if (recordPrevious) f.previousMaintainer = ch.from.trim()
    codes.push(f.code)
  }
  return codes
}

/** Sets presented-in and adds or removes related criteria on many files. Returns the codes of changed files. */
export function applyBulkCriteria(s: Draft, fileIds: string[], patch: CriteriaBulkPatch): string[] {
  const ids = new Set(fileIds)
  const codes: string[] = []
  for (const f of s.files) {
    if (!ids.has(f.id) || f.container) continue
    if (patch.criteria !== undefined) f.presentedIn = { ...f.presentedIn, criteria: patch.criteria }
    if (patch.person !== undefined) f.presentedIn = { ...f.presentedIn, person: patch.person.trim() }
    if (patch.proposed !== undefined) f.presentedIn = { ...f.presentedIn, proposed: patch.proposed }
    const related = new Set(f.relatedCriteria)
    for (const c of patch.addRelated ?? []) related.add(c)
    for (const c of patch.removeRelated ?? []) related.delete(c)
    f.relatedCriteria = [...related].sort((a, b) => Number(a.slice(1)) - Number(b.slice(1)))
    codes.push(f.code)
  }
  return codes
}
