import { ACTIVITY_LIMIT } from '../repo'
import { useStore } from '../store'

const fmt = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' })

export function ActivityLog() {
  const { state } = useStore()
  if (!state) return null
  const entries = state.activity

  return (
    <section className="overflow-hidden rounded-lg border border-t-4 border-stone-200 border-t-navy bg-white shadow-sm">
      <header className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-stone-200 px-4 py-3">
        <h2 className="font-bold text-navy">Recent changes</h2>
        <p className="text-xs text-stone-600">
          {entries.length} entries, newest first. The log keeps the latest {ACTIVITY_LIMIT}.
        </p>
      </header>
      {entries.length === 0 ? (
        <p className="px-4 py-6 text-center text-sm text-stone-600">No changes recorded yet.</p>
      ) : (
        <ol className="divide-y divide-stone-100">
          {entries.map((e) => (
            <li key={e.id} className="grid gap-1 px-4 py-2.5 text-sm sm:grid-cols-[11rem_9rem_1fr] sm:gap-4">
              <time dateTime={e.at} className="tabular-nums text-stone-600">
                {fmt.format(new Date(e.at))}
              </time>
              <span className="font-semibold text-stone-700">{e.who}</span>
              <span className="text-stone-800">{e.what}</span>
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}
