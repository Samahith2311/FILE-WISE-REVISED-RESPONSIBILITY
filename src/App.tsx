import { MotionConfig } from 'framer-motion'
import { DomainBoxes } from './components/DomainBoxes'
import { Header } from './components/Header'
import { LoginScreen } from './components/LoginScreen'
import { useStore } from './store'

export default function App() {
  const { user, state, error, clearError } = useStore()

  if (!user) return <LoginScreen />

  return (
    <MotionConfig reducedMotion="user">
      <Header />
      <main className="mx-auto max-w-6xl px-4 py-6">
        {state ? <DomainBoxes /> : <p className="text-sm text-stone-500">Loading files</p>}
      </main>
      {error && (
        <div role="alert" className="fixed bottom-4 left-1/2 z-30 flex -translate-x-1/2 items-center gap-3 rounded-md bg-stone-900 px-4 py-2 text-sm text-white shadow-lg">
          {error}
          <button type="button" onClick={clearError} className="text-stone-300 underline hover:text-white">
            Dismiss
          </button>
        </div>
      )}
    </MotionConfig>
  )
}
