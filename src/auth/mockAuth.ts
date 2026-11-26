/**
 * MOCK AUTH. NOT SECURE. FOR LOCAL DEVELOPMENT ONLY.
 *
 * Hardcoded accounts, checked in the browser. This module will be replaced by
 * Supabase Auth (see src/auth/index.ts and README.md), with row-level security:
 *   - read:  any signed-in user
 *   - write: the admin only
 *
 * The session is kept in sessionStorage, so each browser tab can sign in as a
 * different account (handy for watching viewer tabs update live).
 */
import type { User } from '../types'
import type { AuthService } from './AuthService'

interface MockAccount extends User {
  username: string
  password: string
}

const ACCOUNTS: MockAccount[] = [
  { id: 'u-admin', username: 'admin', password: 'admin123', name: 'Department admin', role: 'admin' },
  { id: 'u-viewer1', username: 'viewer1', password: 'view123', name: 'Viewer one', role: 'viewer' },
  { id: 'u-viewer2', username: 'viewer2', password: 'view123', name: 'Viewer two', role: 'viewer' },
]

/** Shown on the login screen in development builds only. */
export const DEMO_ACCOUNTS = /* @__PURE__ */ ACCOUNTS.map(({ username, password, role }) => ({ username, password, role }))

const SESSION_KEY = 'dept-files:session'

function toUser({ id, name, role }: MockAccount): User {
  return { id, name, role }
}

export class MockAuth implements AuthService {
  private user: User | null = null
  private readonly listeners = new Set<(user: User | null) => void>()

  constructor() {
    try {
      const id = sessionStorage.getItem(SESSION_KEY)
      const account = ACCOUNTS.find((a) => a.id === id)
      this.user = account ? toUser(account) : null
    } catch {
      this.user = null
    }
  }

  current(): User | null {
    return this.user
  }

  async signIn(username: string, password: string): Promise<User> {
    const account = ACCOUNTS.find((a) => a.username === username.trim().toLowerCase() && a.password === password)
    if (!account) throw new Error('Wrong username or password.')
    this.user = toUser(account)
    sessionStorage.setItem(SESSION_KEY, account.id)
    this.emit()
    return this.user
  }

  async signOut(): Promise<void> {
    this.user = null
    sessionStorage.removeItem(SESSION_KEY)
    this.emit()
  }

  onChange(listener: (user: User | null) => void): () => void {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  private emit() {
    for (const l of this.listeners) l(this.user)
  }
}
