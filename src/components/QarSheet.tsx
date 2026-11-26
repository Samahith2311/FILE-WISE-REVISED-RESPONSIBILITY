import { bandFor, roundScore, sortFiles } from '../lib/scoring'
import { useStore } from '../store'
import { presentedInText } from './FileDetails'
import { Button } from './ui'

/**
 * Printable QAR sheet rebuilt from the data: S/L, query (the file), compliance status.
 * Domains print in display order (D, A, P). D13 shows the A average; the A files follow in their own section.
 */
export function QarSheet() {
  const { state, scores, period } = useStore()
  if (!state || !scores) return null

  let sl = 0
  const rows = state.domains.flatMap((d) =>
    sortFiles(state.files.filter((f) => f.domain === d.id)).map((file) => ({ domain: d, file, sl: ++sl })),
  )

  return (
    <section className="overflow-hidden rounded-lg border border-t-4 border-stone-200 border-t-navy bg-white shadow-sm print:overflow-visible print:rounded-none print:border-0 print:shadow-none">
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-stone-200 px-4 py-3 print:border-black print:px-0">
        <div className="flex min-w-0 items-start gap-3">
          <img
            src="/brand/mit-logo.jpg"
            width={331}
            height={331}
            alt="Maharaja Institute of Technology Mysore emblem"
            className="h-14 w-14 shrink-0"
          />
          <div className="min-w-0">
            <p className="font-serif text-sm font-bold leading-snug text-navy print:text-black">Maharaja Institute of Technology Mysore</p>
            <p className="text-xs text-stone-600 print:text-black">Department of Computer Science &amp; Engineering</p>
            <h2 className="mt-2 text-lg font-bold text-navy-deep print:text-black">QAR compliance sheet</h2>
            <p className="text-sm text-stone-600 print:text-black">
              Academic year {period.ay}, {period.sem} semester. Overall {roundScore(scores.overall) ?? '--'}%{' '}
              {bandFor(scores.overall) ? `(${bandFor(scores.overall)!.label})` : ''}
            </p>
          </div>
        </div>
        <Button variant="primary" onClick={() => window.print()} className="print:hidden">
          Print
        </Button>
      </header>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-stone-300 text-left text-xs text-stone-600 print:text-black">
              <th scope="col" className="w-12 px-4 py-2 font-medium print:px-1">
                S/L
              </th>
              <th scope="col" className="px-2 py-2 font-medium">
                Query
              </th>
              <th scope="col" className="hidden px-2 py-2 font-medium md:table-cell print:table-cell">
                Maintainer / presented in
              </th>
              <th scope="col" className="w-48 px-4 py-2 font-medium print:px-1">
                Compliance status
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ domain, file, sl: n }, i) => {
              const score = scores.file.get(file.id) ?? null
              const band = bandFor(score)
              const firstOfDomain = i === 0 || rows[i - 1]!.domain.id !== domain.id
              return [
                firstOfDomain && (
                  <tr key={`h-${domain.id}`} className="break-after-avoid bg-stone-100">
                    <th colSpan={4} scope="colgroup" className="px-4 py-1.5 text-left text-xs font-semibold text-stone-700 print:px-1">
                      {domain.id} · {domain.name} files ({domain.range})
                    </th>
                  </tr>
                ),
                <tr key={file.id} className="break-inside-avoid border-b border-stone-100 align-top">
                  <td className="px-4 py-1.5 tabular-nums text-stone-600 print:px-1">{n}</td>
                  <td className="px-2 py-1.5">
                    <span className="font-serif font-bold">{file.code}</span> {file.title}
                    {file.container && <span className="text-stone-600"> (average of {file.container} files)</span>}
                  </td>
                  <td className="hidden px-2 py-1.5 text-stone-600 md:table-cell print:table-cell">
                    {file.maintainer}
                    {presentedInText(file) && <span className="block text-xs text-stone-600">{presentedInText(file)}</span>}
                  </td>
                  <td className="px-4 py-1.5 print:px-1">
                    {band ? (
                      <>
                        <span className="tabular-nums font-semibold">{roundScore(score)}%</span> {band.label}
                      </>
                    ) : (
                      <span className="text-stone-600">No data</span>
                    )}
                  </td>
                </tr>,
              ]
            })}
          </tbody>
        </table>
      </div>
    </section>
  )
}
