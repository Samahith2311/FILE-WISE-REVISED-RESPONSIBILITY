import { getStatus, STATUS_LABELS, STATUS_ORDER } from '../lib/scoring'
import { useStore } from '../store'
import type { ChecklistItem, ItemStatus } from '../types'
import { Badge } from './ui'

const SELECTED: Record<ItemStatus, string> = {
  completed: 'border-emerald-600 bg-emerald-600 text-white',
  partial: 'border-amber-500 bg-amber-500 text-white',
  not_completed: 'border-rose-600 bg-rose-600 text-white',
  na: 'border-stone-500 bg-stone-500 text-white',
}

const PILL: Record<ItemStatus, string> = {
  completed: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
  partial: 'bg-amber-50 text-amber-800 ring-amber-200',
  not_completed: 'bg-rose-50 text-rose-800 ring-rose-200',
  na: 'bg-stone-100 text-stone-600 ring-stone-200',
}

export function StatusPill({ status }: { status: ItemStatus }) {
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${PILL[status]}`}>
      {STATUS_LABELS[status]}
    </span>
  )
}

export function StatusChips({ value, onChange, label }: { value: ItemStatus; onChange: (s: ItemStatus) => void; label: string }) {
  return (
    <div className="flex flex-wrap gap-1" role="radiogroup" aria-label={`Status of ${label}`}>
      {STATUS_ORDER.map((s) => {
        const on = value === s
        return (
          <button
            key={s}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => !on && onChange(s)}
            className={`rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-400 ${
              on ? SELECTED[s] : 'border-stone-300 bg-white text-stone-600 hover:border-stone-400 hover:text-stone-900'
            }`}
          >
            {STATUS_LABELS[s]}
          </button>
        )
      })}
    </div>
  )
}

export function Checklist({ items }: { items: ChecklistItem[]; fileId: string }) {
  const { state, period, isAdmin, actions } = useStore()
  if (!state) return null

  if (items.length === 0) {
    return <p className="text-sm text-stone-500">No checklist items yet.</p>
  }

  return (
    <ul className="divide-y divide-stone-100 rounded-md border border-stone-200 bg-white">
      {items.map((item) => {
        const status = getStatus(state, item.id, period)
        return (
          <li key={item.id} className="flex flex-col gap-2 px-3 py-2.5 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <p className="text-sm text-stone-800">
                {item.label} {item.repeating && <Badge tone="outline">Repeating</Badge>}
              </p>
              {item.note && <p className="mt-0.5 text-xs text-stone-500">{item.note}</p>}
            </div>
            <div className="shrink-0">
              {isAdmin ? (
                <StatusChips value={status} label={item.label} onChange={(s) => void actions.setStatus(item.id, s)} />
              ) : (
                <StatusPill status={status} />
              )}
            </div>
          </li>
        )
      })}
    </ul>
  )
}
