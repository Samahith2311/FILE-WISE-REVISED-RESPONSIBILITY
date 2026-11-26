/**
 * Checks the scoring rules on small sample data and on the real seed.
 * Run: npm run check:scoring
 */
import assert from 'node:assert/strict'
import { applyBulkCriteria, applyReassign, applyRename, replacePerson } from '../src/lib/faculty'
import { bandColor, bandFor, computeScores, statusKey } from '../src/lib/scoring'
import { initialState } from '../src/repo/initialState'
import type { AppState, ChecklistItem, DeptFile, DomainId, ItemStatus, Period } from '../src/types'

const ODD: Period = { ay: '2026-27', sem: 'Odd' }
const EVEN: Period = { ay: '2026-27', sem: 'Even' }

let passed = 0
function check(name: string, fn: () => void) {
  fn()
  passed++
  console.log(`  ok  ${name}`)
}

function file(code: string, domain: DomainId, container: DomainId | null = null): DeptFile {
  return {
    id: code,
    code,
    domain,
    order: 0,
    title: code,
    proposedTitle: false,
    group: null,
    container,
    maintainer: '',
    previousMaintainer: '',
    presentedIn: { criteria: '', person: '', proposed: false },
    previousPresentation: '',
    relatedCriteria: [],
    physicalLocation: '',
    notes: '',
  }
}

/** Builds a state where each file gets one item per status listed for it. */
function sample(spec: Array<[DeptFile, ItemStatus[]]>, period: Period = ODD): AppState {
  const items: ChecklistItem[] = []
  const statuses: Record<string, ItemStatus> = {}
  for (const [f, list] of spec) {
    list.forEach((st, n) => {
      const id = `${f.code}-i${n + 1}`
      items.push({ id, fileId: f.id, order: n + 1, label: id, repeating: false, note: '' })
      if (st !== 'not_completed') statuses[statusKey(id, period)] = st
    })
  }
  return {
    version: 1,
    academicYears: ['2026-27'],
    domains: [],
    files: spec.map(([f]) => f),
    items,
    faculty: [],
    criteria: [],
    statuses,
    activity: [],
  }
}

const close = (a: number | null | undefined, b: number) =>
  assert.ok(a !== null && a !== undefined && Math.abs(a - b) < 1e-9, `expected ${b}, got ${a}`)

console.log('Scoring rules')

const state = sample([
  [file('D01', 'D'), ['completed', 'partial', 'not_completed', 'na']], // (1 + 0.5 + 0) / 3 = 50
  [file('D02', 'D'), ['na', 'na', 'na']], // all N/A -> null
  [file('D13', 'D', 'A'), []], // container -> average of A
  [file('A01', 'A'), ['completed', 'completed']], // 100
  [file('A02', 'A'), ['partial', 'not_completed']], // 25
  [file('A03', 'A'), []], // no items -> null
  [file('P01', 'P'), ['completed', 'completed', 'completed', 'partial']], // 87.5
])
const s = computeScores(state, ODD)

check('mixed file: completed 1, partial 0.5, not completed 0, N/A excluded', () => close(s.file.get('D01'), 50))
check('all-N/A file scores null', () => assert.equal(s.file.get('D02'), null))
check('file with no items scores null', () => assert.equal(s.file.get('A03'), null))
check('D13 = average of the A files (nulls skipped)', () => close(s.file.get('D13'), (100 + 25) / 2))
check('domain A = average of its files', () => close(s.domain.A, 62.5))
check('domain D = average of D01 and D13 (D02 null is skipped)', () => close(s.domain.D, (50 + 62.5) / 2))
check('domain P', () => close(s.domain.P, 87.5))
check('overall = average of D and P only', () => close(s.overall, ((50 + 62.5) / 2 + 87.5) / 2))

check('statuses are separate per semester', () => {
  const even = computeScores(state, EVEN)
  close(even.file.get('D01'), 0) // nothing set for Even, N/A not set either
  close(even.file.get('A01'), 0)
})

check('missing status defaults to not completed', () => {
  const st = sample([[file('D01', 'D'), ['not_completed', 'not_completed']]])
  close(computeScores(st, ODD).file.get('D01'), 0)
})

check('domain with no scorable files is null; overall uses the rest', () => {
  const st = sample([
    [file('D01', 'D'), ['na']],
    [file('P01', 'P'), ['completed']],
  ])
  const r = computeScores(st, ODD)
  assert.equal(r.domain.D, null)
  close(r.overall, 100)
})

check('bands: 95+, 80 to 94, 70 to 79, below 70, none', () => {
  assert.equal(bandFor(100)?.label, 'Excellence')
  assert.equal(bandFor(95)?.label, 'Excellence')
  assert.equal(bandFor(94.5)?.label, 'Excellence') // rounds to 95
  assert.equal(bandFor(94.4)?.label, 'Compliant')
  assert.equal(bandFor(80)?.label, 'Compliant')
  assert.equal(bandFor(79)?.label, 'Moderate gaps')
  assert.equal(bandFor(70)?.label, 'Moderate gaps')
  assert.equal(bandFor(69)?.label, 'Intensive intervention')
  assert.equal(bandFor(0)?.label, 'Intensive intervention')
  assert.equal(bandFor(null), null)
  assert.equal(bandColor(null), 'grey')
  assert.equal(bandColor(96), 'green')
  assert.equal(bandColor(85), 'blue')
  assert.equal(bandColor(75), 'amber')
  assert.equal(bandColor(10), 'red')
})

console.log('Seed')
const seed = initialState()
const codes = (d: DomainId) => seed.files.filter((f) => f.domain === d).sort((a, b) => a.order - b.order).map((f) => f.code)

check('D has 33 entries in order D01..D12, D13, D14..D33', () => {
  const expected = Array.from({ length: 33 }, (_, i) => `D${String(i + 1).padStart(2, '0')}`)
  assert.deepEqual(codes('D'), expected)
})
check('A has 52 entries A01..A52', () => {
  assert.deepEqual(codes('A'), Array.from({ length: 52 }, (_, i) => `A${String(i + 1).padStart(2, '0')}`))
})
check('P has 31 rows including P08.1-3 and P11.1-2 with group set', () => {
  const p = codes('P')
  assert.equal(p.length, 31)
  assert.deepEqual(p.slice(7, 10), ['P08.1', 'P08.2', 'P08.3'])
  assert.deepEqual(p.slice(12, 14), ['P11.1', 'P11.2'])
  assert.ok(seed.files.filter((f) => f.code.startsWith('P08.')).every((f) => f.group === 'P08'))
})
check('D13 is a container with no checklist', () => {
  const d13 = seed.files.find((f) => f.code === 'D13')
  assert.equal(d13?.container, 'A')
  assert.equal(seed.items.filter((i) => i.fileId === 'D13').length, 0)
})
check('every other file has four starter items', () => {
  for (const f of seed.files) if (!f.container) assert.equal(seed.items.filter((i) => i.fileId === f.id).length, 4, f.code)
})
check('fresh seed scores 0 everywhere (default not completed)', () => {
  const r = computeScores(seed, ODD)
  close(r.overall, 0)
  close(r.file.get('D13'), 0)
})

console.log('Faculty and criteria')

check('replacePerson ignores honorifics, keeps notes, drops duplicates', () => {
  assert.equal(replacePerson('Mr. Sharath', 'Sharath', 'Sagar'), 'Sagar')
  assert.equal(replacePerson('Akshatha M (proposed)', 'Akshatha M', 'Gagan P'), 'Gagan P (proposed)')
  assert.equal(replacePerson('Bhavya H S, Shalini M K', 'Bhavya H S', 'Shalini M K'), 'Shalini M K')
  assert.equal(replacePerson('C7 Team', 'Akshatha M', 'Gagan P'), 'C7 Team')
})

check('rename updates maintainer, previous maintainer, presenter and coordinator', () => {
  const st = initialState()
  const codes = applyRename(st, 'Akshatha M', 'Akshatha M R')
  assert.equal(st.files.find((f) => f.code === 'D32')!.maintainer, 'Akshatha M R (proposed)')
  assert.ok(codes.includes('A03') && codes.includes('D32'))
  assert.equal(st.criteria.find((c) => c.id === 'C7')?.coordinator, 'Akshatha M R')
  assert.ok(st.files.every((f) => !/\bAkshatha M\b(?! R)/.test(f.maintainer + f.presentedIn.person)))
})

check('reassign moves only ticked files and can record the previous maintainer', () => {
  const st = initialState()
  const codes = applyReassign(
    st,
    [
      { fileId: 'A13', from: 'Akshatha M', to: 'Gagan P' },
      { fileId: 'A01', from: 'Akshatha M', to: 'Gagan P' }, // A01 is not hers: skipped
    ],
    true,
  )
  assert.deepEqual(codes, ['A13'])
  const a13 = st.files.find((f) => f.code === 'A13')!
  assert.equal(a13.maintainer, 'Gagan P')
  assert.equal(a13.previousMaintainer, 'Akshatha M')
  assert.equal(st.files.find((f) => f.code === 'A14')!.maintainer, 'Akshatha M')
})

check('bulk criteria sets presented-in and edits related criteria, skipping containers', () => {
  const st = initialState()
  const codes = applyBulkCriteria(st, ['D01', 'D02', 'D13'], { criteria: 'C8', addRelated: ['C2', 'C1'], removeRelated: ['C9'] })
  assert.deepEqual(codes, ['D01', 'D02'])
  const d01 = st.files.find((f) => f.code === 'D01')!
  assert.equal(d01.presentedIn.criteria, 'C8')
  assert.equal(d01.presentedIn.person, 'Meenakshi H') // untouched
  assert.deepEqual(d01.relatedCriteria, ['C1', 'C2'])
})

check('seed has 31 faculty and C1 to C9 with coordinators', () => {
  const st = initialState()
  assert.equal(st.faculty.length, 31)
  assert.deepEqual(st.criteria.map((c) => c.id), ['C1', 'C2', 'C3', 'C4', 'C5', 'C6', 'C7', 'C8', 'C9'])
  assert.ok(st.criteria.every((c) => c.title && c.coordinator))
})

console.log(`\nAll ${passed} checks passed.`)
