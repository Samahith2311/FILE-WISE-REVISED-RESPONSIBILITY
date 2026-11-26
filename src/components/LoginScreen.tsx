import { useState, type FormEvent } from 'react'
import { DEMO_ACCOUNTS } from '../auth/mockAuth'
import { BACKEND } from '../lib/supabase'
import { useStore } from '../store'
import { Footer, TopStrip } from './Header'
import { Button, inputClass } from './ui'

export function LoginScreen() {
  const { signIn } = useStore()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await signIn(username, password)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign in failed.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex min-h-screen flex-col">
      <TopStrip />
      <main className="relative flex flex-1 items-center justify-center px-4 py-10">
        {/* Navy band behind the upper half of the card. */}
        <div className="absolute inset-x-0 top-0 h-1/2 bg-linear-to-b from-navy-deep to-navy" aria-hidden="true" />
        <div className="relative w-full max-w-sm">
          <div className="rounded-lg border-t-4 border-orange bg-white p-6 shadow-xl">
            <div className="text-center">
              <img
                src="/brand/mit-logo.jpg"
                width={331}
                height={331}
                alt="Maharaja Institute of Technology Mysore emblem"
                className="mx-auto h-20 w-20"
              />
              <p className="mt-3 font-serif text-sm font-bold leading-snug text-navy">Maharaja Institute of Technology Mysore</p>
              <p className="mt-0.5 text-xs text-stone-600">Department of Computer Science &amp; Engineering</p>
              <h1 className="mt-5 text-2xl font-bold text-navy-deep">Department Files</h1>
              <p className="mt-1 text-sm text-stone-600">QAR / NBA file tracking. Sign in to continue.</p>
            </div>

            <form onSubmit={submit} className="mt-6 space-y-3">
              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-stone-700">{BACKEND === 'supabase' ? 'Email' : 'Username'}</span>
                <input
                  className={inputClass}
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  autoComplete="username"
                  autoFocus
                  required
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-stone-700">Password</span>
                <input
                  className={inputClass}
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  required
                />
              </label>
              {error && (
                <p className="text-sm text-band-red" role="alert">
                  {error}
                </p>
              )}
              <Button type="submit" variant="primary" className="w-full py-2" disabled={busy}>
                {busy ? 'Signing in' : 'Sign in'}
              </Button>
            </form>
          </div>

          {import.meta.env.DEV && BACKEND === 'local' && (
            <div className="mt-4 rounded-md border border-dashed border-stone-300 bg-white p-3 text-xs text-stone-600">
              <p className="font-semibold text-stone-700">Development accounts (mock auth)</p>
              <ul className="mt-1 space-y-0.5 font-mono">
                {DEMO_ACCOUNTS.map((a) => (
                  <li key={a.username}>
                    {a.username} / {a.password} ({a.role})
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </main>
      <Footer />
    </div>
  )
}
