import { useMemo, useState, type ReactNode } from 'react'
import { CRITERIA } from '../data/criteria'
import { HONORIFIC, nameKey, splitPeople } from '../lib/faculty'
import { BulkCriteriaEditor, CriterionForm } from './CriteriaAdmin'
import { ATTENTION_THRESHOLD, average, roundScore } from '../lib/scoring'
import { useStore } from '../store'
import type { DeptFile } from '../types'
import { BandLabel, Chevron, Collapse, Pct, ProgressBar } from './ui'

export function Panel({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <section className="overflow-hidden rounded-lg border border-stone-200 bg-white shadow-sm">
      <header className="border-b border-stone-200 px-4 py-3">
        <h2 className="font-semibold">{title}</h2>
        {subtitle && <p className="text-xs text-stone-500">{subtitle}</p>}
      </header>
      {children}
    </section>
  )
}

/** Compact, non-expanding file line used by the summary views. */
export function FileLine({ file, score }: { file: DeptFile; score: number | null }) {
  return (
    <li className="grid grid-cols-[4.5rem_minmax(0,1fr)_3.5rem] items-center gap-x-3 px-4 py-2 sm:grid-cols-[4.5rem_minmax(0,1fr)_12rem_9rem_3.5rem]">
      <span className="font-bold">{file.code}</span>
      <span className="truncate text-sm text-stone-600" title={file.title}>
        {file.title}
      </span>
      <span className="hidden truncate text-sm text-stone-600 sm:block" title={file.maintainer}>
        {file.maintainer}
      </span>
      <span className="hidden sm:block">
        <ProgressBar score={score} />
        <BandLabel score={score} />
      </span>
      <Pct score={score} className="text-right" />
    </li>
  )
}

/** Plain files only: containers (D13) repeat the A scores. */
export function useScoredFiles() {
  const { state, scores } = useStore()
  return useMemo(
    () =>
      (state?.files ?? [])
        .filter((f) => !f.container)
        .map((file) => ({ file, score: scores?.file.get(file.id) ?? null })),
    [state?.files, scores],
  )
}

export function NeedsAttention() {
  const scored = useScoredFiles()
  const list = scored
    .filter((x): x is { file: DeptFile; score: number } => x.score !== null && roundScore(x.score)! < ATTENTION_THRESHOLD)
    .sort((a, b) => a.score - b.score || a.file.code.localeCompare(b.file.code))

  return (
    <Panel title="Needs attention" subtitle={`${list.length} files below ${ATTENTION_THRESHOLD}%, lowest first. Files with no scorable items are not listed.`}>
      {list.length === 0 ? (
        <p className="px-4 py-6 text-center text-sm text-stone-500">Every scored file is at {ATTENTION_THRESHOLD}% or above.</p>
      ) : (
        <ul className="divide-y divide-stone-100">
          {list.map(({ file, score }) => (
            <FileLine key={file.id} file={file} score={score} />
          ))}
        </ul>
      )}
    </Panel>
  )
}

function Group({
  title,
  meta,
  score,
  files,
  extra,
}: {
  title: string
  meta: string
  score: number | null
  files: Array<{ file: DeptFile; score: number | null }>
  extra?: ReactNode
}) {
  const [open, setOpen] = useState(false)
  return (
    <li>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="grid w-full grid-cols-[auto_minmax(0,1fr)_3.5rem] items-center gap-x-3 px-4 py-3 text-left hover:bg-stone-50 sm:grid-cols-[auto_minmax(0,1fr)_10rem_3.5rem]"
      >
        <Chevron open={open} />
        <span className="min-w-0">
          <span className="block font-semibold">{title}</span>
          <span className="block text-xs text-stone-500">{meta}</span>
        </span>
        <span className="hidden sm:block">
          <ProgressBar score={score} />
          <BandLabel score={score} />
        </span>
        <Pct score={score} className="text-right" />
      </button>
      <Collapse open={open}>
        {extra && <div className="border-t border-stone-100 bg-stone-50/70 px-4 py-3 sm:pl-11">{extra}</div>}
        <ul className="divide-y divide-stone-100 border-t border-stone-100 bg-stone-50/70">
          {files.map(({ file, score: s }) => (
            <FileLine key={file.id} file={file} score={s} />
          ))}
        </ul>
      </Collapse>
    </li>
  )
}

export function CriteriaView() {
  const { state, isAdmin } = useStore()
  const scored = useScoredFiles()
  return (
    <div className="space-y-4">
    {isAdmin && <BulkCriteriaEditor />}
    <Panel title="Criteria" subtitle="Files presented under each criterion. Related files count toward the criterion but not its score.">
      <ul className="divide-y divide-stone-200">
        {CRITERIA.map((c) => {
          const criterion = state?.criteria.find((x) => x.id === c)
          const presented = scored.filter((x) => x.file.presentedIn.criteria === c)
          const related = scored.filter((x) => x.file.presentedIn.criteria !== c && x.file.relatedCriteria.includes(c))
          const presenters = [...new Set(presented.map((x) => x.file.presentedIn.person).filter(Boolean))]
          return (
            <Group
              key={c}
              title={criterion?.title ? `${c} · ${criterion.title}` : c}
              meta={`${criterion?.coordinator ? `Coordinator ${criterion.coordinator} · ` : ''}${presented.length} presented, ${related.length} related${presenters.length ? ` · ${presenters.join(', ')}` : ''}`}
              score={average(presented.map((x) => x.score))}
              files={[...presented, ...related]}
              extra={isAdmin && criterion ? <CriterionForm key={`${criterion.title}|${criterion.coordinator}`} criterion={criterion} /> : undefined}
            />
          )
        })}
      </ul>
    </Panel>
    </div>
  )
}

/** Splits "Bhavya H S, Shalini M K" into people and folds "Mr. Sharath" with "Sharath". */
export function peopleOf(maintainer: string): Array<{ key: string; name: string }> {
  return splitPeople(maintainer).map((p) => ({ key: nameKey(p), name: p.replace(/\(.*?\)/g, '').trim().replace(HONORIFIC, '') }))
}

export function PeopleView() {
  const scored = useScoredFiles()
  const people = useMemo(() => {
    const map = new Map<string, { name: string; files: typeof scored }>()
    for (const x of scored) {
      for (const { key, name } of peopleOf(x.file.maintainer)) {
        const entry = map.get(key) ?? { name, files: [] }
        entry.files.push(x)
        map.set(key, entry)
      }
    }
    return [...map.values()].sort((a, b) => b.files.length - a.files.length || a.name.localeCompare(b.name))
  }, [scored])

  return (
    <Panel title="People" subtitle="Each maintainer's files and average completion. Shared files count for every maintainer named.">
      <ul className="divide-y divide-stone-200">
        {people.map((p) => (
          <Group
            key={p.name}
            title={p.name}
            meta={`${p.files.length} ${p.files.length === 1 ? 'file' : 'files'}`}
            score={average(p.files.map((x) => x.score))}
            files={p.files}
          />
        ))}
      </ul>
    </Panel>
  )
}
