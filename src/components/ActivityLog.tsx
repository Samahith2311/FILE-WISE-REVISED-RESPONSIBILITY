import { ACTIVITY_LIMIT } from '../repo'
import { useStore } from '../store'

const fmt = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' })

export function ActivityLog() {
  const { state } = useStore()
  if (!state) return null
  const entries = state.activity

  return (
    <section className="rounded-lg border border-stone-200 bg-white shadow-sm">
      <header className="flex items-baseline justify-between border-b border-stone-200 px-4 py-3">
        <h2 className="font-semibold">Recent changes</h2>
        <p className="text-xs text-stone-500">
          {entries.length} entries, newest first. The log keeps the latest {ACTIVITY_LIMIT}.
        </p>
      </header>
      {entries.length === 0 ? (
        <p className="px-4 py-6 text-center text-sm text-stone-500">No changes recorded yet.</p>
      ) : (
        <ol className="divide-y divide-stone-100">
          {entries.map((e) => (
            <li key={e.id} className="grid gap-1 px-4 py-2.5 text-sm sm:grid-cols-[11rem_9rem_1fr] sm:gap-4">
              <time dateTime={e.at} className="tabular-nums text-stone-500">
                {fmt.format(new Date(e.at))}
              </time>
              <span className="font-medium text-stone-700">{e.who}</span>
              <span className="text-stone-800">{e.what}</span>
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}
