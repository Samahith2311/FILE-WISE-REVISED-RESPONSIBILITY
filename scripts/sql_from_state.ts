/** Turns an AppState into SQL for Supabase. Used by build_seed_sql.ts and import_local_export.ts. */
import { fileToRow, itemToRow } from '../src/repo/supabaseMap'
import type { AppState } from '../src/types'

type Val = string | number | boolean | null | string[]

function lit(v: Val): string {
  if (v === null) return 'null'
  if (typeof v === 'boolean' || typeof v === 'number') return String(v)
  if (Array.isArray(v)) return v.length ? `array[${v.map(lit).join(', ')}]::text[]` : `'{}'::text[]`
  return `'${v.replace(/'/g, "''")}'`
}

function insert(table: string, rows: Array<Record<string, Val>>, tail: string): string {
  if (rows.length === 0) return ''
  const cols = Object.keys(rows[0]!)
  const out: string[] = []
  for (let i = 0; i < rows.length; i += 200) {
    const values = rows.slice(i, i + 200).map((r) => `  (${cols.map((c) => lit(r[c] ?? null)).join(', ')})`)
    out.push(`insert into public.${table} (${cols.join(', ')}) values\n${values.join(',\n')}${tail ? `\n${tail}` : ''};`)
  }
  return out.join('\n')
}

/**
 * seed:    adds the starting data; rows that already exist are left alone.
 * replace: deletes all file data (not profiles or users) and loads the state, statuses and log included.
 */
export function stateToSql(s: AppState, mode: 'seed' | 'replace'): string {
  const tail = mode === 'seed' ? 'on conflict do nothing' : ''
  const itemIds = new Set(s.items.map((i) => i.id))
  const fileIds = new Set(s.files.map((f) => f.id))
  const parts: string[] = ['begin;']

  if (mode === 'replace') {
    parts.push(
      '-- Replaces all file data. Profiles and sign-in accounts are not touched.',
      'delete from public.activity_log;',
      'delete from public.item_status;',
      'delete from public.checklist_items;',
      'delete from public.files;',
      'delete from public.criteria;',
      'delete from public.faculty;',
      'delete from public.academic_years;',
    )
  }

  parts.push(
    insert('academic_years', s.academicYears.map((ay) => ({ ay })), tail),
    insert('faculty', s.faculty.map((f) => ({ id: f.id, name: f.name, designation: f.designation, active: f.active })), tail),
    insert('criteria', s.criteria.map((c) => ({ id: c.id, title: c.title, coordinator: c.coordinator })), tail),
    insert('files', s.files.map((f) => ({ ...fileToRow(f) })), tail),
    insert('checklist_items', s.items.map((i) => ({ ...itemToRow(i) })), tail),
  )

  if (mode === 'replace') {
    const years = new Set(s.academicYears)
    const statuses = Object.entries(s.statuses).flatMap(([key, status]) => {
      const [item_id = '', ay = '', sem = ''] = key.split('|')
      return itemIds.has(item_id) && years.has(ay) ? [{ item_id, ay, sem, status }] : []
    })
    parts.push(insert('item_status', statuses, ''))
    const log = [...s.activity].reverse().map((a) => ({
      at: a.at,
      who: a.who,
      what: a.what,
      file_id: a.fileId && fileIds.has(a.fileId) ? a.fileId : null,
      file_codes: a.fileCodes ?? [],
    }))
    parts.push(insert('activity_log', log, ''))
  }

  parts.push('commit;')
  return parts.filter(Boolean).join('\n\n') + '\n'
}
