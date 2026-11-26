import { MotionConfig } from 'framer-motion'
import { useState, type ReactNode } from 'react'
import { ActivityLog } from './components/ActivityLog'
import { DomainBoxes } from './components/DomainBoxes'
import { FacultyView } from './components/FacultyView'
import { Footer, Header } from './components/Header'
import { CriteriaView, NeedsAttention, PeopleView } from './components/Insights'
import { LoginScreen } from './components/LoginScreen'
import { QarSheet } from './components/QarSheet'
import { useStore } from './store'

type View = 'files' | 'attention' | 'criteria' | 'faculty' | 'people' | 'qar' | 'activity'

const VIEWS: Array<{ id: View; label: string; render: () => ReactNode }> = [
  { id: 'files', label: 'Files', render: () => <DomainBoxes /> },
  { id: 'attention', label: 'Needs attention', render: () => <NeedsAttention /> },
  { id: 'criteria', label: 'Criteria', render: () => <CriteriaView /> },
  { id: 'faculty', label: 'Faculty', render: () => <FacultyView /> },
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
      <div className="flex min-h-screen flex-col print:block print:min-h-0">
        <Header>
          <nav className="flex overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" aria-label="Views">
            {VIEWS.map((v) => (
              <button
                key={v.id}
                type="button"
                onClick={() => setView(v.id)}
                aria-current={v.id === view ? 'page' : undefined}
                className={`whitespace-nowrap border-b-[3px] px-3 pb-2 pt-2.5 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-orange ${
                  v.id === view
                    ? 'border-orange font-semibold text-white'
                    : 'border-transparent text-white/85 hover:border-orange/70 hover:text-white'
                }`}
              >
                {v.label}
              </button>
            ))}
          </nav>
        </Header>
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 print:max-w-none print:p-0">
          {state ? current.render() : <p className="text-sm text-stone-600">Loading files</p>}
        </main>
        <Footer />
      </div>
      {error && (
        <div
          role="alert"
          className="fixed bottom-4 left-1/2 z-30 flex w-max max-w-[calc(100%-2rem)] -translate-x-1/2 items-center gap-3 rounded-md border-l-4 border-orange bg-navy-deep px-4 py-2 text-sm text-white shadow-lg print:hidden"
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
