import { useState, type FormEvent, type ReactNode } from 'react'
import { CRITERIA, STAFF } from '../data/staff'
import { useStore } from '../store'
import type { DeptFile, FilePatch } from '../types'
import { Button, inputClass } from './ui'

function Label({ text, children, className = '' }: { text: string; children: ReactNode; className?: string }) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1 block text-xs font-medium text-stone-600">{text}</span>
      {children}
    </label>
  )
}

const STAFF_LIST_ID = 'staff-suggestions'

export function StaffDatalist() {
  return (
    <datalist id={STAFF_LIST_ID}>
      {STAFF.map((s) => (
        <option key={s} value={s} />
      ))}
    </datalist>
  )
}

/** Admin form for every editable file attribute. Saves only the fields that changed. */
export function FileEditor({ file, onDone }: { file: DeptFile; onDone: () => void }) {
  const { actions } = useStore()
  // Snapshot at open: only fields the admin changed are saved, so edits made
  // meanwhile in another tab are not overwritten with stale values.
  const [initial] = useState(file)
  const [draft, setDraft] = useState({
    title: file.title,
    maintainer: file.maintainer,
    previousMaintainer: file.previousMaintainer,
    criteria: file.presentedIn.criteria,
    person: file.presentedIn.person,
    proposed: file.presentedIn.proposed,
    previousPresentation: file.previousPresentation,
    relatedCriteria: file.relatedCriteria,
    physicalLocation: file.physicalLocation,
    notes: file.notes,
  })
  const [saving, setSaving] = useState(false)
  const set = <K extends keyof typeof draft>(key: K, value: (typeof draft)[K]) => setDraft((d) => ({ ...d, [key]: value }))

  async function save(e: FormEvent) {
    e.preventDefault()
    const patch: FilePatch = {}
    const text = ['title', 'maintainer', 'previousMaintainer', 'previousPresentation', 'physicalLocation', 'notes'] as const
    for (const key of text) {
      const value = draft[key].trim()
      if (value !== initial[key]) patch[key] = value
    }
    const presentedIn = { criteria: draft.criteria, person: draft.person.trim(), proposed: draft.proposed }
    if (JSON.stringify(presentedIn) !== JSON.stringify(initial.presentedIn)) patch.presentedIn = presentedIn
    const related = CRITERIA.filter((c) => draft.relatedCriteria.includes(c))
    if (related.join() !== initial.relatedCriteria.join()) patch.relatedCriteria = [...related]

    if (Object.keys(patch).length === 0) return onDone()
    setSaving(true)
    const ok = await actions.updateFile(file.id, patch)
    setSaving(false)
    if (ok) onDone()
  }

  return (
    <form onSubmit={save} className="space-y-3 rounded-md border border-stone-200 bg-white p-4">
      <StaffDatalist />
      <Label text="Title">
        <input className={inputClass} value={draft.title} onChange={(e) => set('title', e.target.value)} required />
      </Label>
      <div className="grid gap-3 sm:grid-cols-2">
        <Label text="Maintainer">
          <input className={inputClass} list={STAFF_LIST_ID} value={draft.maintainer} onChange={(e) => set('maintainer', e.target.value)} />
        </Label>
        <Label text="Previous maintainer">
          <input className={inputClass} list={STAFF_LIST_ID} value={draft.previousMaintainer} onChange={(e) => set('previousMaintainer', e.target.value)} />
        </Label>
      </div>
      <div className="grid gap-3 sm:grid-cols-[8rem_1fr_auto] sm:items-end">
        <Label text="Presented in">
          <select className={inputClass} value={draft.criteria} onChange={(e) => set('criteria', e.target.value)}>
            <option value="">None</option>
            {CRITERIA.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </Label>
        <Label text="Presenter">
          <input className={inputClass} list={STAFF_LIST_ID} value={draft.person} onChange={(e) => set('person', e.target.value)} />
        </Label>
        <label className="flex items-center gap-2 pb-2 text-sm text-stone-700">
          <input type="checkbox" checked={draft.proposed} onChange={(e) => set('proposed', e.target.checked)} />
          Proposed
        </label>
      </div>
      <Label text="Previous presentation">
        <input className={inputClass} value={draft.previousPresentation} onChange={(e) => set('previousPresentation', e.target.value)} />
      </Label>
      <fieldset>
        <legend className="mb-1 text-xs font-medium text-stone-600">Related criteria</legend>
        <div className="flex flex-wrap gap-3">
          {CRITERIA.map((c) => (
            <label key={c} className="flex items-center gap-1.5 text-sm text-stone-700">
              <input
                type="checkbox"
                checked={draft.relatedCriteria.includes(c)}
                onChange={(e) =>
                  set('relatedCriteria', e.target.checked ? [...draft.relatedCriteria, c] : draft.relatedCriteria.filter((x) => x !== c))
                }
              />
              {c}
            </label>
          ))}
        </div>
      </fieldset>
      <Label text="Physical location">
        <input
          className={inputClass}
          placeholder="e.g. HoD cabin, cupboard 2, shelf 3"
          value={draft.physicalLocation}
          onChange={(e) => set('physicalLocation', e.target.value)}
        />
      </Label>
      <Label text="Notes">
        <textarea className={`${inputClass} min-h-20`} value={draft.notes} onChange={(e) => set('notes', e.target.value)} />
      </Label>
      <div className="flex gap-2">
        <Button type="submit" variant="primary" disabled={saving}>
          {saving ? 'Saving' : 'Save changes'}
        </Button>
        <Button onClick={onDone}>Cancel</Button>
      </div>
    </form>
  )
}
