import type { ReactNode } from 'react'
import { useStore } from '../store'
import type { Semester } from '../types'
import { BACKEND } from '../lib/supabase'
import { AddYearControl, ExportButton } from './AdminForms'
import { BandLabel, Badge, Button, Pct, ProgressBar } from './ui'

const SEMESTERS: Semester[] = ['Odd', 'Even']

/** Thin navy strip above everything, as on mitmysore.in. */
export function TopStrip() {
  return (
    <div className="bg-navy text-white print:hidden">
      <p className="mx-auto max-w-6xl px-4 py-1.5 text-[11px] leading-snug sm:text-xs">
        Maharaja Institute of Technology Mysore
        <span className="px-1.5 text-white/60" aria-hidden="true">
          |
        </span>
        Department of Computer Science &amp; Engineering
      </p>
    </div>
  )
}

/** College emblem and name. The name banner already carries the emblem, so small screens show the emblem alone. */
function Brand() {
  return (
    <div className="flex shrink-0 items-center">
      <img
        src="/brand/mit-name.webp"
        width={1600}
        height={207}
        alt="Maharaja Institute of Technology Mysore"
        className="hidden h-12 w-auto md:block lg:h-14"
      />
      <span className="flex items-center gap-2 md:hidden">
        <img src="/brand/mit-logo.jpg" width={331} height={331} alt="" className="h-10 w-10" />
        <span className="font-serif text-base font-bold leading-tight text-navy">MIT Mysore</span>
      </span>
    </div>
  )
}

export function Header({ children }: { children?: ReactNode }) {
  const { state, user, isAdmin, period, setPeriod, scores, signOut } = useStore()
  if (!state || !user) return null

  return (
    <>
      <TopStrip />
      <header className="bg-white print:hidden">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
          <Brand />
          <div className="flex min-w-0 items-center gap-2 sm:gap-3">
            <div className="min-w-0 text-right">
              <p className="truncate text-sm font-semibold leading-tight" title={user.name}>
                {user.name}
              </p>
              <Badge tone={isAdmin ? 'dark' : 'outline'}>{isAdmin ? 'Admin' : 'View only'}</Badge>
            </div>
            <Button variant="secondary" onClick={() => void signOut()}>
              Sign out
            </Button>
          </div>
        </div>

        <div className="border-t border-stone-200">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-3 px-4 py-3">
            <div className="mr-auto">
              <h1 className="text-lg font-bold leading-tight text-navy">Department Files</h1>
              <p className="text-xs text-stone-600">QAR / NBA file tracking</p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <label className="sr-only" htmlFor="ay">
                Academic year
              </label>
              <select
                id="ay"
                className="rounded-md border border-stone-300 bg-white px-2 py-1.5 text-sm text-navy-deep focus:border-navy focus:outline-none focus:ring-2 focus:ring-orange/50"
                value={period.ay}
                onChange={(e) => setPeriod({ ...period, ay: e.target.value })}
              >
                {state.academicYears.map((ay) => (
                  <option key={ay} value={ay}>
                    AY {ay}
                  </option>
                ))}
              </select>
              <div className="inline-flex rounded-md border border-stone-300 bg-white p-0.5" role="group" aria-label="Semester">
                {SEMESTERS.map((sem) => (
                  <button
                    key={sem}
                    type="button"
                    aria-pressed={period.sem === sem}
                    onClick={() => setPeriod({ ...period, sem })}
                    className={`rounded px-2.5 py-1 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange ${
                      period.sem === sem ? 'bg-navy font-semibold text-white' : 'text-stone-700 hover:bg-surface hover:text-navy'
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
                <span className="text-xs text-stone-600">Overall</span>
                <Pct score={scores?.overall ?? null} className="font-serif text-lg" />
              </div>
              <ProgressBar score={scores?.overall ?? null} />
              <BandLabel score={scores?.overall ?? null} />
            </div>
          </div>
        </div>
      </header>
      {children && (
        <div className="sticky top-0 z-20 bg-navy shadow-md print:hidden">
          <div className="mx-auto max-w-6xl px-2 sm:px-4">{children}</div>
        </div>
      )}
    </>
  )
}

export function Footer() {
  return (
    <footer className="bg-navy-deep text-white print:hidden">
      <div className="mx-auto flex max-w-6xl flex-col gap-1 px-4 py-4 text-xs sm:flex-row sm:items-center sm:justify-between">
        <p className="font-semibold">Maharaja Institute of Technology Mysore, Department of CSE</p>
        <p className="text-slate-300">
          Accreditation file tracking <span aria-hidden="true">&middot;</span> {new Date().getFullYear()}
        </p>
      </div>
    </footer>
  )
}
