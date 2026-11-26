import { useMemo, useState } from 'react'
import { itemsByFile, sortFiles } from '../lib/scoring'
import { useStore } from '../store'
import type { DeptFile } from '../types'
import { Checklist } from './Checklist'
import { FileDetails } from './FileDetails'
import { Badge, BandLabel, Chevron, Collapse, Pct, ProgressBar } from './ui'

export function matchesQuery(file: DeptFile, query: string): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return true
  return [file.code, file.title, file.maintainer].some((v) => v.toLowerCase().includes(q))
}

/** Ordered list of file rows. Container files (D13) expand into their own list. */
export function FileList({ files, query = '' }: { files: DeptFile[]; query?: string }) {
  const { state } = useStore()
  const byFile = useMemo(() => itemsByFile(state?.items ?? []), [state?.items])
  if (!state) return null

  type Row = { file: DeptFile; children: DeptFile[] | null; forceOpen: boolean }
  const rows = sortFiles(files).flatMap((file): Row[] => {
    if (file.container) {
      const children = sortFiles(state.files.filter((f) => f.domain === file.container))
      const matching = children.filter((f) => matchesQuery(f, query))
      const selfMatch = matchesQuery(file, query)
      if (!selfMatch && matching.length === 0) return []
      return [{ file, children: selfMatch && !query.trim() ? children : matching, forceOpen: !!query.trim() && matching.length > 0 }]
    }
    return matchesQuery(file, query) ? [{ file, children: null, forceOpen: false }] : []
  })

  if (rows.length === 0) {
    return <p className="px-4 py-6 text-center text-sm text-stone-500">No files match "{query}".</p>
  }

  return (
    <ul className="divide-y divide-stone-200">
      {rows.map(({ file, children, forceOpen }) => (
        <FileRow key={file.id} file={file} childFiles={children} forceOpen={forceOpen} query={query} itemCount={byFile.get(file.id)?.length ?? 0} />
      ))}
    </ul>
  )
}

function FileRow({
  file,
  childFiles,
  forceOpen,
  query,
  itemCount,
}: {
  file: DeptFile
  childFiles: DeptFile[] | null
  forceOpen: boolean
  query: string
  itemCount: number
}) {
  const { state, scores } = useStore()
  const [open, setOpen] = useState(false)
  const expanded = open || forceOpen
  const score = scores?.file.get(file.id) ?? null
  const items = useMemo(
    () => (state?.items ?? []).filter((i) => i.fileId === file.id).sort((a, b) => a.order - b.order),
    [state?.items, file.id],
  )
  const panelId = `file-panel-${file.id}`

  return (
    <li>
      <button
        type="button"
        onClick={() => setOpen(!expanded)}
        aria-expanded={expanded}
        aria-controls={panelId}
        className="grid w-full grid-cols-[auto_1fr] items-center gap-x-3 gap-y-2 px-4 py-3 text-left transition-colors hover:bg-stone-50 focus-visible:bg-stone-50 focus-visible:outline-none sm:grid-cols-[auto_minmax(0,1fr)_12rem_10rem_3.5rem]"
      >
        <Chevron open={expanded} />
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-lg font-bold tracking-tight text-stone-900">{file.code}</span>
            {file.group && <Badge tone="outline">Part of {file.group}</Badge>}
            {file.container && <Badge>{childFiles ? `${childFiles.length} files` : 'Container'}</Badge>}
          </div>
          <p className="truncate text-xs text-stone-500">
            {file.title}
            {file.proposedTitle && <span className="italic"> (proposed part title)</span>}
          </p>
        </div>
        <p className="col-start-2 truncate text-sm text-stone-600 sm:col-start-auto" title={file.maintainer}>
          {file.maintainer || <span className="text-stone-400">No maintainer</span>}
        </p>
        <div className="col-start-2 sm:col-start-auto">
          <ProgressBar score={score} />
          <BandLabel score={score} />
        </div>
        <Pct score={score} className="col-start-2 text-right sm:col-start-auto" />
      </button>

      <Collapse open={expanded}>
        <div id={panelId} className="space-y-4 border-t border-stone-100 bg-stone-50/70 px-4 py-4 sm:pl-11">
          <FileDetails file={file} />
          {childFiles ? (
            <div className="overflow-hidden rounded-md border border-stone-200 bg-white">
              <FileList files={childFiles} query={query} />
            </div>
          ) : (
            <section>
              <h4 className="mb-2 text-sm font-semibold text-stone-700">
                Checklist <span className="font-normal text-stone-500">({itemCount} items)</span>
              </h4>
              <Checklist items={items} fileId={file.id} />
            </section>
          )}
        </div>
      </Collapse>
    </li>
  )
}
