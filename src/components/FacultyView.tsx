import { useState, type FormEvent } from 'react'
import { hasPerson } from '../lib/faculty'
import { average } from '../lib/scoring'
import { useStore } from '../store'
import type { Faculty } from '../types'
import { StaffDatalist } from './FileEditor'
import { FileLine, Panel, useScoredFiles } from './Insights'
import { Badge, Button, Chevron, Collapse, inputClass, Pct } from './ui'

export function FacultyView() {
  const { state, isAdmin } = useStore()
  const scored = useScoredFiles()
  if (!state) return null

  return (
    <Panel title="Faculty" subtitle="Files each person maintains or presents. Names match ignoring titles such as Prof. or Mr.">
      <StaffDatalist />
      {isAdmin && <AddFacultyForm />}
      <ul className="divide-y divide-stone-200">
        {state.faculty.map((person) => {
          const maintains = scored.filter((x) => hasPerson(x.file.maintainer, person.name))
          const presents = scored.filter((x) => hasPerson(x.file.presentedIn.person, person.name))
          return <FacultyRow key={person.id} person={person} maintains={maintains} presents={presents.length} />
        })}
      </ul>
    </Panel>
  )
}

type Scored = ReturnType<typeof useScoredFiles>

function FacultyRow({ person, maintains, presents }: { person: Faculty; maintains: Scored; presents: number }) {
  const { isAdmin } = useStore()
  const [open, setOpen] = useState(false)
  const score = average(maintains.map((x) => x.score))

  return (
    <li>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="grid w-full grid-cols-[auto_minmax(0,1fr)_3.5rem] items-center gap-x-3 px-4 py-3 text-left hover:bg-stone-50 sm:grid-cols-[auto_minmax(0,1fr)_14rem_3.5rem]"
      >
        <Chevron open={open} />
        <span className="min-w-0">
          <span className="flex items-center gap-2 font-semibold">
            {person.name} {!person.active && <Badge tone="outline">Inactive</Badge>}
          </span>
          <span className="block text-xs text-stone-500">{person.designation || 'No designation'}</span>
        </span>
        <span className="hidden text-sm text-stone-600 sm:block">
          Maintains {maintains.length}, presents {presents}
        </span>
        <Pct score={score} className="text-right" />
      </button>
      <Collapse open={open}>
        <div className="space-y-3 border-t border-stone-100 bg-stone-50/70 px-4 py-3 sm:pl-11">
          {isAdmin && <EditFacultyForm key={`${person.name}|${person.designation}|${person.active}`} person={person} />}
          {maintains.length === 0 ? (
            <p className="text-sm text-stone-500">Maintains no files.</p>
          ) : isAdmin ? (
            <ReassignForm person={person} files={maintains} />
          ) : (
            <ul className="divide-y divide-stone-100 rounded-md border border-stone-200 bg-white">
              {maintains.map(({ file, score: s }) => (
                <FileLine key={file.id} file={file} score={s} />
              ))}
            </ul>
          )}
        </div>
      </Collapse>
    </li>
  )
}

function AddFacultyForm() {
  const { actions } = useStore()
  const [name, setName] = useState('')
  const [designation, setDesignation] = useState('')

  async function add(e: FormEvent) {
    e.preventDefault()
    if (await actions.addFaculty(name, designation)) {
      setName('')
      setDesignation('')
    }
  }

  return (
    <form onSubmit={add} className="grid gap-2 border-b border-stone-200 bg-stone-50 px-4 py-3 sm:grid-cols-[1fr_1fr_auto]">
      <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" aria-label="New faculty name" required />
      <input
        className={inputClass}
        value={designation}
        onChange={(e) => setDesignation(e.target.value)}
        placeholder="Designation"
        aria-label="New faculty designation"
      />
      <Button type="submit">Add faculty</Button>
    </form>
  )
}

function EditFacultyForm({ person }: { person: Faculty }) {
  const { actions } = useStore()
  const [name, setName] = useState(person.name)
  const [designation, setDesignation] = useState(person.designation)
  const [active, setActive] = useState(person.active)
  const [saving, setSaving] = useState(false)

  async function save(e: FormEvent) {
    e.preventDefault()
    setSaving(true)
    let ok = true
    if (name.trim() !== person.name) ok = await actions.renameFaculty(person.id, name)
    if (ok && (designation.trim() !== person.designation || active !== person.active)) {
      await actions.updateFaculty(person.id, { designation: designation.trim(), active })
    }
    setSaving(false)
  }

  return (
    <form onSubmit={save} className="grid gap-2 rounded-md border border-stone-200 bg-white p-3 sm:grid-cols-[1fr_1fr_auto_auto] sm:items-center">
      <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} aria-label="Name" required />
      <input className={inputClass} value={designation} onChange={(e) => setDesignation(e.target.value)} placeholder="Designation" aria-label="Designation" />
      <label className="flex items-center gap-2 text-sm text-stone-700">
        <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
        Active
      </label>
      <Button type="submit" variant="primary" disabled={saving} title="Renaming also updates every file and criterion that names this person">
        Save
      </Button>
    </form>
  )
}

function ReassignForm({ person, files }: { person: Faculty; files: Scored }) {
  const { actions } = useStore()
  const [ticked, setTicked] = useState<Set<string>>(() => new Set())
  const [to, setTo] = useState('')
  const [recordPrevious, setRecordPrevious] = useState(true)
  const [busy, setBusy] = useState(false)

  const toggle = (id: string) =>
    setTicked((cur) => {
      const next = new Set(cur)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  async function apply(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    const changes = [...ticked].map((fileId) => ({ fileId, from: person.name, to }))
    if (await actions.reassignFaculty(changes, recordPrevious)) {
      setTicked(new Set())
      setTo('')
    }
    setBusy(false)
  }

  const allTicked = ticked.size === files.length

  return (
    <form onSubmit={apply} className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-stone-700">Files maintained ({files.length})</p>
        <Button variant="ghost" className="text-xs" onClick={() => setTicked(allTicked ? new Set() : new Set(files.map((x) => x.file.id)))}>
          {allTicked ? 'Untick all' : 'Tick all'}
        </Button>
      </div>
      <ul className="divide-y divide-stone-100 rounded-md border border-stone-200 bg-white">
        {files.map(({ file, score }) => (
          <li key={file.id} className="flex items-center">
            <input
              type="checkbox"
              className="ml-4"
              checked={ticked.has(file.id)}
              onChange={() => toggle(file.id)}
              aria-label={`Reassign ${file.code}`}
            />
            <ul className="min-w-0 flex-1">
              <FileLine file={file} score={score} />
            </ul>
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap items-center gap-2">
        <input
          className={`${inputClass} sm:w-64`}
          list="staff-suggestions"
          value={to}
          onChange={(e) => setTo(e.target.value)}
          placeholder="Reassign ticked files to"
          aria-label="New maintainer"
          required
        />
        <label className="flex items-center gap-2 text-sm text-stone-700">
          <input type="checkbox" checked={recordPrevious} onChange={(e) => setRecordPrevious(e.target.checked)} />
          Record {person.name} as previous maintainer
        </label>
        <Button type="submit" variant="primary" disabled={busy || ticked.size === 0 || !to.trim()}>
          Reassign {ticked.size || ''} {ticked.size === 1 ? 'file' : 'files'}
        </Button>
      </div>
    </form>
  )
}
