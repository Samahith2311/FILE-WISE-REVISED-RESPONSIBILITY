import { useState, type FormEvent } from 'react'
import { DEMO_ACCOUNTS } from '../auth/mockAuth'
import { useStore } from '../store'
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
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <h1 className="text-xl font-semibold tracking-tight">Department files</h1>
        <p className="mt-1 text-sm text-stone-500">QAR / NBA file tracking. Sign in to continue.</p>

        <form onSubmit={submit} className="mt-6 space-y-3 rounded-lg border border-stone-200 bg-white p-5 shadow-sm">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-stone-600">Username</span>
            <input className={inputClass} value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" autoFocus required />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-stone-600">Password</span>
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
            <p className="text-sm text-rose-700" role="alert">
              {error}
            </p>
          )}
          <Button type="submit" variant="primary" className="w-full" disabled={busy}>
            {busy ? 'Signing in' : 'Sign in'}
          </Button>
        </form>

        {import.meta.env.DEV && (
          <div className="mt-4 rounded-md border border-dashed border-stone-300 p-3 text-xs text-stone-500">
            <p className="font-medium text-stone-600">Development accounts (mock auth)</p>
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
    </div>
  )
}
