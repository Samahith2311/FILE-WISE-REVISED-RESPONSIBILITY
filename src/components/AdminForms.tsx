import { useState, type FormEvent } from 'react'
import { useStore } from '../store'
import type { DomainId } from '../types'
import { StaffDatalist } from './FileEditor'
import { Button, inputClass } from './ui'

/** "2026-27" -> "2027-28". */
export function nextAcademicYear(ay: string | undefined): string {
  const start = Number(ay?.slice(0, 4))
  if (!Number.isFinite(start) || start < 2000) return ''
  return `${start + 1}-${String((start + 2) % 100).padStart(2, '0')}`
}

/** Header action: add an academic year. Checklists carry over, statuses start empty. */
export function AddYearControl() {
  const { state, actions } = useStore()
  const [open, setOpen] = useState(false)
  const [ay, setAy] = useState('')

  if (!state) return null

  if (!open) {
    return (
      <Button
        variant="ghost"
        onClick={() => {
          setAy(nextAcademicYear(state.academicYears[state.academicYears.length - 1]))
          setOpen(true)
        }}
      >
        Add year
      </Button>
    )
  }

  async function add(e: FormEvent) {
    e.preventDefault()
    if (await actions.addAcademicYear(ay)) setOpen(false)
  }

  return (
    <form onSubmit={add} className="flex items-center gap-1.5">
      <input
        className={`${inputClass} w-24`}
        value={ay}
        onChange={(e) => setAy(e.target.value)}
        placeholder="2027-28"
        aria-label="New academic year"
        pattern="\d{4}-\d{2}"
        required
        autoFocus
      />
      <Button type="submit" variant="primary" title="Keeps all checklists and starts every status at Not completed">
        Add
      </Button>
      <Button variant="ghost" onClick={() => setOpen(false)}>
        Cancel
      </Button>
    </form>
  )
}

function nextCode(codes: string[], domain: DomainId): string {
  const nums = codes.map((c) => Number(/^[ADP](\d+)/.exec(c)?.[1] ?? 0))
  return `${domain}${String(Math.max(0, ...nums) + 1).padStart(2, '0')}`
}

/** Domain panel action: add a file to the open domain. */
export function AddFileForm({ domain, onDone }: { domain: DomainId; onDone: () => void }) {
  const { state, actions } = useStore()
  const [code, setCode] = useState(() => nextCode(state?.files.filter((f) => f.domain === domain).map((f) => f.code) ?? [], domain))
  const [title, setTitle] = useState('')
  const [maintainer, setMaintainer] = useState('')

  async function add(e: FormEvent) {
    e.preventDefault()
    const created = await actions.addFile({ code, domain, title, maintainer })
    if (created) onDone()
  }

  return (
    <form onSubmit={add} className="grid gap-2 border-b border-stone-200 bg-stone-50 px-4 py-3 sm:grid-cols-[7rem_1fr_1fr_auto]">
      <StaffDatalist />
      <input className={inputClass} value={code} onChange={(e) => setCode(e.target.value)} aria-label="File code" required />
      <input className={inputClass} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" aria-label="Title" required />
      <input
        className={inputClass}
        value={maintainer}
        onChange={(e) => setMaintainer(e.target.value)}
        placeholder="Maintainer"
        aria-label="Maintainer"
        list="staff-suggestions"
      />
      <div className="flex gap-2">
        <Button type="submit" variant="primary">
          Add file
        </Button>
        <Button variant="ghost" onClick={onDone}>
          Cancel
        </Button>
      </div>
    </form>
  )
}
