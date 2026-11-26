import type { SupabaseClient } from '@supabase/supabase-js'
import type { User } from '../types'
import type { AuthService } from './AuthService'

/**
 * Email and password sign-in with Supabase Auth. The name and role come from
 * public.profiles (never from user_metadata, which users can edit). An account
 * without a profile row is signed out again.
 */
export class SupabaseAuth implements AuthService {
  private user: User | null = null
  private readonly listeners = new Set<(user: User | null) => void>()

  constructor(private readonly sb: SupabaseClient) {
    // Restores the session on page load and follows sign-in, sign-out and token refresh.
    // Supabase asks not to await its own calls inside this callback, so defer.
    sb.auth.onAuthStateChange((_event, session) => {
      setTimeout(() => void this.sync(session?.user.id ?? null), 0)
    })
  }

  current(): User | null {
    return this.user
  }

  async signIn(email: string, password: string): Promise<User> {
    const { data, error } = await this.sb.auth.signInWithPassword({ email: email.trim(), password })
    if (error) throw new Error(error.message)
    const user = await this.profile(data.user.id)
    if (!user) {
      await this.sb.auth.signOut()
      throw new Error('This account has no profile yet. Ask the admin to add one.')
    }
    this.set(user)
    return user
  }

  async signOut(): Promise<void> {
    const { error } = await this.sb.auth.signOut()
    this.set(null)
    if (error) throw new Error(error.message)
  }

  onChange(listener: (user: User | null) => void): () => void {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  private async sync(userId: string | null): Promise<void> {
    if (!userId) return this.set(null)
    if (this.user?.id === userId) return
    try {
      this.set(await this.profile(userId))
    } catch {
      this.set(null)
    }
  }

  private async profile(userId: string): Promise<User | null> {
    const { data, error } = await this.sb.from('profiles').select('user_id, display_name, role').eq('user_id', userId).maybeSingle()
    if (error) throw new Error(error.message)
    if (!data) return null
    return { id: data.user_id as string, name: (data.display_name as string) || 'Unnamed user', role: data.role === 'admin' ? 'admin' : 'viewer' }
  }

  private set(user: User | null): void {
    if (this.user?.id === user?.id && this.user?.role === user?.role) return
    this.user = user
    for (const l of this.listeners) l(user)
  }
}
