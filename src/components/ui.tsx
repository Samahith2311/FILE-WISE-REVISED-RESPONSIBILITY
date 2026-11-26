import { AnimatePresence, motion } from 'framer-motion'
import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { bandColor, bandFor, roundScore, type BandColor } from '../lib/scoring'

// Band colours: Excellence green, Compliant navy, Moderate gaps amber, Intensive intervention red, no data grey.
// The red is deliberately not the brand orange, so it never reads as decoration.
const BAR: Record<BandColor, string> = {
  green: 'bg-band-green',
  blue: 'bg-navy',
  amber: 'bg-amber',
  red: 'bg-band-red',
  grey: 'bg-stone-300',
}

const TEXT: Record<BandColor, string> = {
  green: 'text-band-green-ink',
  blue: 'text-navy',
  amber: 'text-band-amber-ink',
  red: 'text-band-red',
  grey: 'text-stone-600',
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
    dark: 'bg-navy text-white',
    outline: 'border border-navy/40 text-navy',
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
      className={`h-4 w-4 shrink-0 text-navy/70 transition-transform duration-200 ${open ? 'rotate-90' : ''}`}
      aria-hidden="true"
    >
      <path d="M6 3.5 10.5 8 6 12.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export const inputClass =
  'w-full rounded-md border border-stone-300 bg-white px-2.5 py-1.5 text-sm text-navy-deep placeholder:text-stone-500 focus:border-navy focus:outline-none focus:ring-2 focus:ring-orange/50'

export function Button({
  children,
  variant = 'secondary',
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'danger' | 'ghost' }) {
  const variants = {
    primary: 'bg-navy text-white hover:bg-navy-deep disabled:bg-stone-400',
    secondary: 'border border-stone-300 bg-white text-navy-deep hover:border-orange hover:bg-surface disabled:text-stone-400 disabled:hover:border-stone-300',
    danger: 'border border-rose-200 bg-white text-band-red hover:bg-rose-50',
    ghost: 'text-stone-700 hover:bg-surface hover:text-navy',
  }
  return (
    <button
      type="button"
      className={`inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-md px-2.5 py-1.5 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange focus-visible:ring-offset-1 disabled:cursor-not-allowed ${variants[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  )
}
