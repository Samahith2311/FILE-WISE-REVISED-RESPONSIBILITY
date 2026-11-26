import { useState, type FormEvent } from 'react'
import { CRITERIA } from '../data/criteria'
import { sortFiles } from '../lib/scoring'
import { useStore } from '../store'
import type { CriteriaBulkPatch, Criterion } from '../types'
import { StaffDatalist } from './FileEditor'
import { matchesQuery } from './FileList'
import { Panel } from './Insights'
import { Button, inputClass } from './ui'

/** Admin: edit one criterion's title and coordinator. */
export function CriterionForm({ criterion }: { criterion: Criterion }) {
  const { actions } = useStore()
  const [title, setTitle] = useState(criterion.title)
  const [coordinator, setCoordinator] = useState(criterion.coordinator)

  async function save(e: FormEvent) {
    e.preventDefault()
    await actions.updateCriterion(criterion.id, { title, coordinator })
  }

  const changed = title.trim() !== criterion.title || coordinator.trim() !== criterion.coordinator
  return (
    <form onSubmit={save} className="grid gap-2 sm:grid-cols-[1fr_14rem_auto]">
      <StaffDatalist />
      <input className={inputClass} value={title} onChange={(e) => setTitle(e.target.value)} aria-label={`${criterion.id} title`} required />
      <input
        className={inputClass}
        list="staff-suggestions"
        value={coordinator}
        onChange={(e) => setCoordinator(e.target.value)}
        placeholder="Coordinator"
        aria-label={`${criterion.id} coordinator`}
      />
      <Button type="submit" variant="primary" disabled={!changed}>
        Save
      </Button>
    </form>
  )
}

const NO_CHANGE = ''
const CLEAR = 'none'

/** Admin: set presented-in and add or remove related criteria on many files in one step. */
export function BulkCriteriaEditor() {
  const { state, actions } = useStore()
  const [query, setQuery] = useState('')
  const [ticked, setTicked] = useState<Set<string>>(() => new Set())
  const [criteria, setCriteria] = useState(NO_CHANGE)
  const [person, setPerson] = useState('')
  const [add, setAdd] = useState<string[]>([])
  const [remove, setRemove] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  if (!state) return null

  const files = sortFiles(state.files.filter((f) => !f.container && matchesQuery(f, query)))
  const flip = (list: string[], c: string) => (list.includes(c) ? list.filter((x) => x !== c) : [...list, c])
  const patch: CriteriaBulkPatch = {
    ...(criteria !== NO_CHANGE && { criteria: criteria === CLEAR ? '' : criteria }),
    ...(person.trim() && { person }),
    ...(add.length && { addRelated: add }),
    ...(remove.length && { removeRelated: remove }),
  }
  const hasChange = Object.keys(patch).length > 0

  async function apply(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    if (await actions.bulkUpdateFileCriteria([...ticked], patch)) {
      setTicked(new Set())
      setCriteria(NO_CHANGE)
      setPerson('')
      setAdd([])
      setRemove([])
    }
    setBusy(false)
  }

  return (
    <Panel title="Bulk edit file criteria" subtitle="Tick files, choose the changes, then apply them to all ticked files at once.">
      <form onSubmit={apply} className="space-y-3 p-4">
        <StaffDatalist />
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="search"
            className={`${inputClass} sm:w-72`}
            placeholder="Filter by code, title or maintainer"
            aria-label="Filter files"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <Button onClick={() => setTicked(new Set([...ticked, ...files.map((f) => f.id)]))}>Tick shown ({files.length})</Button>
          <Button variant="ghost" onClick={() => setTicked(new Set())} disabled={ticked.size === 0}>
            Clear ticks
          </Button>
          <span className="text-sm text-stone-500">{ticked.size} ticked</span>
        </div>
        <ul className="max-h-64 divide-y divide-stone-100 overflow-y-auto rounded-md border border-stone-200">
          {files.map((f) => (
            <li key={f.id}>
              <label className="flex items-center gap-3 px-3 py-1.5 text-sm hover:bg-stone-50">
                <input
                  type="checkbox"
                  checked={ticked.has(f.id)}
                  onChange={() => {
                    const next = new Set(ticked)
                    if (next.has(f.id)) next.delete(f.id)
                    else next.add(f.id)
                    setTicked(next)
                  }}
                />
                <span className="w-14 font-semibold">{f.code}</span>
                <span className="min-w-0 flex-1 truncate text-stone-600">{f.title}</span>
                <span className="hidden text-xs text-stone-500 sm:inline">
                  {f.presentedIn.criteria || 'No criterion'}
                  {f.relatedCriteria.length ? ` · related ${f.relatedCriteria.join(', ')}` : ''}
                </span>
              </label>
            </li>
          ))}
        </ul>

        <div className="grid gap-3 sm:grid-cols-[10rem_1fr]">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-stone-600">Presented in</span>
            <select className={inputClass} value={criteria} onChange={(e) => setCriteria(e.target.value)}>
              <option value={NO_CHANGE}>No change</option>
              <option value={CLEAR}>None</option>
              {CRITERIA.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-stone-600">Presenter (leave empty for no change)</span>
            <input className={inputClass} list="staff-suggestions" value={person} onChange={(e) => setPerson(e.target.value)} />
          </label>
        </div>
        {(['add', 'remove'] as const).map((kind) => (
          <fieldset key={kind}>
            <legend className="mb-1 text-xs font-medium text-stone-600">{kind === 'add' ? 'Add related criteria' : 'Remove related criteria'}</legend>
            <div className="flex flex-wrap gap-3">
              {CRITERIA.map((c) => (
                <label key={c} className="flex items-center gap-1.5 text-sm text-stone-700">
                  <input
                    type="checkbox"
                    checked={(kind === 'add' ? add : remove).includes(c)}
                    onChange={() => (kind === 'add' ? setAdd(flip(add, c)) : setRemove(flip(remove, c)))}
                  />
                  {c}
                </label>
              ))}
            </div>
          </fieldset>
        ))}
        <Button type="submit" variant="primary" disabled={busy || ticked.size === 0 || !hasChange}>
          Apply to {ticked.size} {ticked.size === 1 ? 'file' : 'files'}
        </Button>
      </form>
    </Panel>
  )
}
