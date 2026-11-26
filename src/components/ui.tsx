import { AnimatePresence, motion } from 'framer-motion'
import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { bandColor, bandFor, roundScore, type BandColor } from '../lib/scoring'

const BAR: Record<BandColor, string> = {
  green: 'bg-emerald-600',
  blue: 'bg-sky-600',
  amber: 'bg-amber-500',
  red: 'bg-rose-600',
  grey: 'bg-stone-300',
}

const TEXT: Record<BandColor, string> = {
  green: 'text-emerald-700',
  blue: 'text-sky-700',
  amber: 'text-amber-700',
  red: 'text-rose-700',
  grey: 'text-stone-500',
}

export function pctText(score: number | null): string {
  const r = roundScore(score)
  return r === null ? '--' : `${r}%`
}

export function ProgressBar({ score, className = '' }: { score: number | null; className?: string }) {
  const width = score === null ? 0 : Math.max(0, Math.min(100, score))
  return (
    <div
      className={`h-1.5 w-full overflow-hidden rounded-full bg-stone-200 ${className}`}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={roundScore(score) ?? undefined}
      aria-valuetext={score === null ? 'No data' : pctText(score)}
    >
      <div className={`h-full rounded-full transition-[width] duration-500 ${BAR[bandColor(score)]}`} style={{ width: `${width}%` }} />
    </div>
  )
}

export function BandLabel({ score, className = '' }: { score: number | null; className?: string }) {
  const band = bandFor(score)
  return <span className={`text-xs font-medium ${TEXT[bandColor(score)]} ${className}`}>{band?.label ?? 'No data'}</span>
}

export function Pct({ score, className = '' }: { score: number | null; className?: string }) {
  return <span className={`tabular-nums font-semibold ${TEXT[bandColor(score)]} ${className}`}>{pctText(score)}</span>
}

export function Badge({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'dark' | 'outline' }) {
  const tones = {
    neutral: 'bg-stone-100 text-stone-700',
    dark: 'bg-stone-900 text-white',
    outline: 'border border-stone-300 text-stone-600',
  }
  return <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-[11px] font-medium ${tones[tone]}`}>{children}</span>
}

/** Smooth height open/close. */
export function Collapse({ open, children }: { open: boolean; children: ReactNode }) {
  return (
    <AnimatePresence initial={false}>
      {open && (
        <motion.div
          key="collapse"
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.24, ease: [0.2, 0, 0, 1] }}
          style={{ overflow: 'hidden' }}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      viewBox="0 0 16 16"
      className={`h-4 w-4 shrink-0 text-stone-400 transition-transform duration-200 ${open ? 'rotate-90' : ''}`}
      aria-hidden="true"
    >
      <path d="M6 3.5 10.5 8 6 12.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export const inputClass =
  'w-full rounded-md border border-stone-300 bg-white px-2.5 py-1.5 text-sm text-stone-900 placeholder:text-stone-400 focus:border-stone-500 focus:outline-none focus:ring-2 focus:ring-stone-200'

export function Button({
  children,
  variant = 'secondary',
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'danger' | 'ghost' }) {
  const variants = {
    primary: 'bg-stone-900 text-white hover:bg-stone-700 disabled:bg-stone-400',
    secondary: 'border border-stone-300 bg-white text-stone-800 hover:bg-stone-100 disabled:text-stone-400',
    danger: 'border border-rose-200 bg-white text-rose-700 hover:bg-rose-50',
    ghost: 'text-stone-600 hover:bg-stone-100 hover:text-stone-900',
  }
  return (
    <button
      type="button"
      className={`inline-flex items-center justify-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-400 disabled:cursor-not-allowed ${variants[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  )
}
