import type { User } from '../types'

/** Everything the app needs from authentication. MockAuth implements it today. */
export interface AuthService {
  /** The signed-in user for this tab, or null. */
  current(): User | null
  signIn(username: string, password: string): Promise<User>
  signOut(): Promise<void>
  /** Called whenever the signed-in user changes. Returns an unsubscribe function. */
  onChange(listener: (user: User | null) => void): () => void
}
