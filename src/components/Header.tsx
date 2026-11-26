import type { ReactNode } from 'react'
import { useStore } from '../store'
import type { Semester } from '../types'
import { BACKEND } from '../lib/supabase'
import { AddYearControl, ExportButton } from './AdminForms'
import { BandLabel, Badge, Button, Pct, ProgressBar } from './ui'

const SEMESTERS: Semester[] = ['Odd', 'Even']

export function Header({ children }: { children?: ReactNode }) {
  const { state, user, isAdmin, period, setPeriod, scores, signOut } = useStore()
  if (!state || !user) return null

  return (
    <header className="sticky top-0 z-20 border-b border-stone-200 bg-white/95 backdrop-blur print:hidden">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-3 px-4 py-3">
        <div className="mr-auto">
          <h1 className="text-base font-semibold tracking-tight">Department files</h1>
          <p className="text-xs text-stone-500">QAR / NBA file tracking</p>
        </div>

        <div className="flex items-center gap-2">
          <label className="sr-only" htmlFor="ay">
            Academic year
          </label>
          <select
            id="ay"
            className="rounded-md border border-stone-300 bg-white px-2 py-1.5 text-sm"
            value={period.ay}
            onChange={(e) => setPeriod({ ...period, ay: e.target.value })}
          >
            {state.academicYears.map((ay) => (
              <option key={ay} value={ay}>
                AY {ay}
              </option>
            ))}
          </select>
          <div className="inline-flex rounded-md border border-stone-300 p-0.5" role="group" aria-label="Semester">
            {SEMESTERS.map((sem) => (
              <button
                key={sem}
                type="button"
                aria-pressed={period.sem === sem}
                onClick={() => setPeriod({ ...period, sem })}
                className={`rounded px-2.5 py-1 text-sm transition-colors ${
                  period.sem === sem ? 'bg-stone-900 text-white' : 'text-stone-600 hover:bg-stone-100'
                }`}
              >
                {sem}
              </button>
            ))}
          </div>
          {isAdmin && <AddYearControl />}
          {isAdmin && BACKEND === 'local' && <ExportButton />}
        </div>

        <div className="w-44">
          <div className="flex items-baseline justify-between">
            <span className="text-xs text-stone-500">Overall</span>
            <Pct score={scores?.overall ?? null} className="text-lg" />
          </div>
          <ProgressBar score={scores?.overall ?? null} />
          <BandLabel score={scores?.overall ?? null} />
        </div>

        <div className="flex items-center gap-3 border-l border-stone-200 pl-4">
          <div className="text-right">
            <p className="text-sm font-medium leading-tight">{user.name}</p>
            <Badge tone={isAdmin ? 'dark' : 'outline'}>{isAdmin ? 'Admin' : 'View only'}</Badge>
          </div>
          <Button variant="ghost" onClick={() => void signOut()}>
            Sign out
          </Button>
        </div>
      </div>
      {children && <div className="mx-auto max-w-6xl px-4">{children}</div>}
    </header>
  )
}
