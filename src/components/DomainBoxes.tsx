import { useRef, useState } from 'react'
import { useStore } from '../store'
import type { DomainId } from '../types'
import { AddFileForm } from './AdminForms'
import { FileList } from './FileList'
import { BandLabel, Button, Collapse, inputClass, Pct, ProgressBar } from './ui'

export function DomainBoxes() {
  const { state, scores, isAdmin } = useStore()
  const [adding, setAdding] = useState(false)
  const [openDomain, setOpenDomain] = useState<DomainId | null>(null)
  const [query, setQuery] = useState('')
  // Keep the last domain rendered while the panel animates closed.
  const lastDomain = useRef<DomainId | null>(null)
  if (openDomain) lastDomain.current = openDomain
  const shown = openDomain ?? lastDomain.current
  if (!state || !scores) return null

  const toggle = (id: DomainId) => {
    setOpenDomain((cur) => (cur === id ? null : id))
    setQuery('')
    setAdding(false)
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        {state.domains.map((d) => {
          const count = state.files.filter((f) => f.domain === d.id).length
          const score = scores.domain[d.id]
          const active = openDomain === d.id
          return (
            <button
              key={d.id}
              type="button"
              onClick={() => toggle(d.id)}
              aria-expanded={active}
              aria-controls="domain-panel"
              className={`rounded-lg border bg-white p-4 text-left shadow-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-400 ${
                active ? 'border-stone-900 ring-1 ring-stone-900' : 'border-stone-200 hover:border-stone-400'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-md bg-stone-900 text-lg font-bold text-white">
                    {d.id}
                  </span>
                  <div>
                    <p className="font-semibold leading-tight">{d.name}</p>
                    <p className="text-xs text-stone-500">
                      {d.range} &middot; {count} files
                    </p>
                  </div>
                </div>
                <Pct score={score} className="text-2xl" />
              </div>
              <ProgressBar score={score} className="mt-4" />
              <BandLabel score={score} className="mt-1 block" />
            </button>
          )
        })}
      </div>

      <Collapse open={openDomain !== null}>
        {shown && (
          <section id="domain-panel" className="overflow-hidden rounded-lg border border-stone-200 bg-white shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-200 px-4 py-3">
              <h2 className="font-semibold">
                {state.domains.find((d) => d.id === shown)?.name} files
              </h2>
              <div className="flex w-full gap-2 sm:w-auto">
                <input
                  type="search"
                  className={`${inputClass} sm:w-72`}
                  placeholder="Search code, title or maintainer"
                  aria-label="Search files"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
                {isAdmin && !adding && <Button onClick={() => setAdding(true)}>Add file</Button>}
              </div>
            </div>
            {isAdmin && adding && <AddFileForm key={shown} domain={shown} onDone={() => setAdding(false)} />}
            <FileList files={state.files.filter((f) => f.domain === shown)} query={query} />
          </section>
        )}
      </Collapse>
    </div>
  )
}
