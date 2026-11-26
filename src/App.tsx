import { MotionConfig } from 'framer-motion'
import { useState, type ReactNode } from 'react'
import { ActivityLog } from './components/ActivityLog'
import { DomainBoxes } from './components/DomainBoxes'
import { Header } from './components/Header'
import { CriteriaView, NeedsAttention, PeopleView } from './components/Insights'
import { LoginScreen } from './components/LoginScreen'
import { QarSheet } from './components/QarSheet'
import { useStore } from './store'

type View = 'files' | 'attention' | 'criteria' | 'people' | 'qar' | 'activity'

const VIEWS: Array<{ id: View; label: string; render: () => ReactNode }> = [
  { id: 'files', label: 'Files', render: () => <DomainBoxes /> },
  { id: 'attention', label: 'Needs attention', render: () => <NeedsAttention /> },
  { id: 'criteria', label: 'Criteria', render: () => <CriteriaView /> },
  { id: 'people', label: 'People', render: () => <PeopleView /> },
  { id: 'qar', label: 'QAR sheet', render: () => <QarSheet /> },
  { id: 'activity', label: 'Activity log', render: () => <ActivityLog /> },
]

export default function App() {
  const { user, state, error, clearError } = useStore()
  const [view, setView] = useState<View>('files')

  if (!user) return <LoginScreen />

  const current = VIEWS.find((v) => v.id === view) ?? VIEWS[0]!

  return (
    <MotionConfig reducedMotion="user">
      <Header>
        <nav className="-mb-px flex gap-1 overflow-x-auto" aria-label="Views">
          {VIEWS.map((v) => (
            <button
              key={v.id}
              type="button"
              onClick={() => setView(v.id)}
              aria-current={v.id === view ? 'page' : undefined}
              className={`whitespace-nowrap border-b-2 px-3 py-2 text-sm transition-colors ${
                v.id === view ? 'border-stone-900 font-medium text-stone-900' : 'border-transparent text-stone-500 hover:text-stone-800'
              }`}
            >
              {v.label}
            </button>
          ))}
        </nav>
      </Header>
      <main className="mx-auto max-w-6xl px-4 py-6 print:max-w-none print:p-0">
        {state ? current.render() : <p className="text-sm text-stone-500">Loading files</p>}
      </main>
      {error && (
        <div
          role="alert"
          className="fixed bottom-4 left-1/2 z-30 flex -translate-x-1/2 items-center gap-3 rounded-md bg-stone-900 px-4 py-2 text-sm text-white shadow-lg print:hidden"
        >
          {error}
          <button type="button" onClick={clearError} className="text-stone-300 underline hover:text-white">
            Dismiss
          </button>
        </div>
      )}
    </MotionConfig>
  )
}
