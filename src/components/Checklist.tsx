import { useState, type FormEvent } from 'react'
import { getStatus, STATUS_LABELS, STATUS_ORDER } from '../lib/scoring'
import { useStore } from '../store'
import type { ChecklistItem, ItemPatch, ItemStatus } from '../types'
import { Badge, Button, inputClass } from './ui'

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

export function Checklist({ items, fileId }: { items: ChecklistItem[]; fileId: string }) {
  const { state, period, isAdmin, actions } = useStore()
  if (!state) return null

  return (
    <div className="space-y-2">
      {items.length === 0 ? (
        <p className="text-sm text-stone-500">No checklist items yet.</p>
      ) : (
        <ul className="divide-y divide-stone-100 rounded-md border border-stone-200 bg-white">
          {items.map((item) => {
            const status = getStatus(state, item.id, period)
            return isAdmin ? (
              <AdminItem key={item.id} item={item} status={status} onStatus={(s) => void actions.setStatus(item.id, s)} />
            ) : (
              <li key={item.id} className="flex flex-col gap-2 px-3 py-2.5 sm:flex-row sm:items-start sm:justify-between">
                <ItemText item={item} />
                <StatusPill status={status} />
              </li>
            )
          })}
        </ul>
      )}
      {isAdmin && <AddItemForm fileId={fileId} />}
    </div>
  )
}

function ItemText({ item }: { item: ChecklistItem }) {
  return (
    <div className="min-w-0">
      <p className="text-sm text-stone-800">
        {item.label} {item.repeating && <Badge tone="outline">Repeating</Badge>}
      </p>
      {item.note && <p className="mt-0.5 whitespace-pre-wrap text-xs text-stone-500">{item.note}</p>}
    </div>
  )
}

function AdminItem({ item, status, onStatus }: { item: ChecklistItem; status: ItemStatus; onStatus: (s: ItemStatus) => void }) {
  const { actions } = useStore()
  const [editing, setEditing] = useState(false)
  const [label, setLabel] = useState(item.label)
  const [note, setNote] = useState(item.note)
  const [confirmDelete, setConfirmDelete] = useState(false)

  function startEdit() {
    setLabel(item.label)
    setNote(item.note)
    setConfirmDelete(false)
    setEditing(true)
  }

  async function save(e: FormEvent) {
    e.preventDefault()
    const patch: ItemPatch = {}
    if (label.trim() && label.trim() !== item.label) patch.label = label.trim()
    if (note.trim() !== item.note) patch.note = note.trim()
    if (Object.keys(patch).length) await actions.updateItem(item.id, patch)
    setEditing(false)
  }

  return (
    <li className="px-3 py-2.5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <ItemText item={item} />
        <div className="flex shrink-0 items-center gap-2">
          <StatusChips value={status} label={item.label} onChange={onStatus} />
          <Button variant="ghost" className="px-2 py-0.5 text-xs" onClick={() => (editing ? setEditing(false) : startEdit())} aria-expanded={editing}>
            {editing ? 'Close' : 'Edit'}
          </Button>
        </div>
      </div>
      {editing && (
        <form onSubmit={save} className="mt-3 space-y-2 rounded-md border border-stone-200 bg-stone-50 p-3">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-stone-600">Item</span>
            <input className={inputClass} value={label} onChange={(e) => setLabel(e.target.value)} required />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-stone-600">Note</span>
            <textarea className={`${inputClass} min-h-16`} value={note} onChange={(e) => setNote(e.target.value)} />
          </label>
          <label className="flex items-center gap-2 text-sm text-stone-700">
            <input type="checkbox" checked={item.repeating} onChange={(e) => void actions.updateItem(item.id, { repeating: e.target.checked })} />
            Repeating item (for example, one row per project batch)
          </label>
          <div className="flex flex-wrap gap-2">
            <Button type="submit" variant="primary">
              Save
            </Button>
            <Button onClick={() => setEditing(false)}>Cancel</Button>
            <span className="flex-1" />
            {confirmDelete ? (
              <>
                <Button variant="danger" onClick={() => void actions.deleteItem(item.id)}>
                  Delete item
                </Button>
                <Button variant="ghost" onClick={() => setConfirmDelete(false)}>
                  Keep
                </Button>
              </>
            ) : (
              <Button variant="ghost" className="text-rose-700" onClick={() => setConfirmDelete(true)}>
                Delete
              </Button>
            )}
          </div>
        </form>
      )}
    </li>
  )
}

function AddItemForm({ fileId }: { fileId: string }) {
  const { actions } = useStore()
  const [label, setLabel] = useState('')

  async function add(e: FormEvent) {
    e.preventDefault()
    if (!label.trim()) return
    const created = await actions.addItem(fileId, label)
    if (created) setLabel('')
  }

  return (
    <form onSubmit={add} className="flex gap-2">
      <input
        className={inputClass}
        placeholder="New checklist item"
        aria-label="New checklist item"
        value={label}
        onChange={(e) => setLabel(e.target.value)}
      />
      <Button type="submit" disabled={!label.trim()}>
        Add item
      </Button>
    </form>
  )
}
