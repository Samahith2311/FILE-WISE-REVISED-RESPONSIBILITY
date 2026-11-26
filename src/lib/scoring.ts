import type { AppState, ChecklistItem, DeptFile, DomainId, ItemStatus, Period } from '../types'

/**
 * Score bands, highest first. A score falls in the first band whose `min` it reaches.
 *
 * TODO(confirm): the top two bands (Excellence at 95+, Compliant at 80 to 94) are assumed.
 * Confirm them against the QAR sheet. The lower two (70 to 79, below 70) come from the brief.
 */
export const SCORE_BANDS = [
  { id: 'excellence', min: 95, label: 'Excellence', color: 'green' },
  { id: 'compliant', min: 80, label: 'Compliant', color: 'blue' },
  { id: 'moderate', min: 70, label: 'Moderate gaps', color: 'amber' },
  { id: 'intensive', min: 0, label: 'Intensive intervention', color: 'red' },
] as const

export type ScoreBand = (typeof SCORE_BANDS)[number]
export type BandColor = ScoreBand['color'] | 'grey'

/** Files below this score are listed under "needs attention". */
export const ATTENTION_THRESHOLD = 70

export const DEFAULT_STATUS: ItemStatus = 'not_completed'

export const STATUS_LABELS: Record<ItemStatus, string> = {
  completed: 'Completed',
  partial: 'Partial',
  not_completed: 'Not completed',
  na: 'N/A',
}

export const STATUS_ORDER: ItemStatus[] = ['completed', 'partial', 'not_completed', 'na']

/** Points for one item. N/A returns null, which drops the item from the average. */
export function itemPoints(status: ItemStatus): number | null {
  switch (status) {
    case 'completed':
      return 1
    case 'partial':
      return 0.5
    case 'not_completed':
      return 0
    case 'na':
      return null
  }
}

export function statusKey(itemId: string, period: Period): string {
  return `${itemId}|${period.ay}|${period.sem}`
}

export function getStatus(state: Pick<AppState, 'statuses'>, itemId: string, period: Period): ItemStatus {
  return state.statuses[statusKey(itemId, period)] ?? DEFAULT_STATUS
}

/** Average of non-null values, or null when there are none. */
export function average(values: Array<number | null>): number | null {
  const nums = values.filter((v): v is number => v !== null)
  if (nums.length === 0) return null
  return nums.reduce((a, b) => a + b, 0) / nums.length
}

/** Rounds for display and banding. */
export function roundScore(score: number | null): number | null {
  return score === null ? null : Math.round(score)
}

export function bandFor(score: number | null): ScoreBand | null {
  const rounded = roundScore(score)
  if (rounded === null) return null
  return SCORE_BANDS.find((b) => rounded >= b.min) ?? null
}

export function bandColor(score: number | null): BandColor {
  return bandFor(score)?.color ?? 'grey'
}

export interface Scores {
  /** File id to percentage 0..100, or null when the file has no scorable items. */
  file: Map<string, number | null>
  domain: Record<DomainId, number | null>
  /** Average of the D and P domain scores. A is counted once, through D13. */
  overall: number | null
}

export function itemsByFile(items: ChecklistItem[]): Map<string, ChecklistItem[]> {
  const map = new Map<string, ChecklistItem[]>()
  for (const item of items) {
    const list = map.get(item.fileId)
    if (list) list.push(item)
    else map.set(item.fileId, [item])
  }
  for (const list of map.values()) list.sort((a, b) => a.order - b.order)
  return map
}

function checklistScore(
  items: ChecklistItem[],
  state: Pick<AppState, 'statuses'>,
  period: Period,
): number | null {
  const avg = average(items.map((i) => itemPoints(getStatus(state, i.id, period))))
  return avg === null ? null : avg * 100
}

/**
 * Computes every file, domain and overall score for one period.
 *
 * Rules:
 * - completed = 1, partial = 0.5, not completed = 0, N/A is excluded.
 * - File % = average of its scorable items (null if none).
 * - Container files (D13) score as the average of the files of the domain they hold (A).
 * - Domain % = average of its files' non-null scores.
 * - Overall = average of the D and P domain scores.
 */
export function computeScores(
  state: Pick<AppState, 'files' | 'items' | 'statuses'>,
  period: Period,
): Scores {
  const byFile = itemsByFile(state.items)
  const file = new Map<string, number | null>()

  for (const f of state.files) {
    if (!f.container) file.set(f.id, checklistScore(byFile.get(f.id) ?? [], state, period))
  }

  const domainAverage = (d: DomainId) =>
    average(state.files.filter((f) => f.domain === d).map((f) => file.get(f.id) ?? null))

  // Containers hold another domain, so score them after the plain files.
  const containedScore: Partial<Record<DomainId, number | null>> = {}
  for (const f of state.files) {
    if (f.container) {
      containedScore[f.container] ??= domainAverage(f.container)
      file.set(f.id, containedScore[f.container] ?? null)
    }
  }

  const domain: Record<DomainId, number | null> = {
    D: domainAverage('D'),
    A: domainAverage('A'),
    P: domainAverage('P'),
  }

  return { file, domain, overall: average([domain.D, domain.P]) }
}

export function sortFiles(files: DeptFile[]): DeptFile[] {
  return [...files].sort((a, b) => a.order - b.order)
}
