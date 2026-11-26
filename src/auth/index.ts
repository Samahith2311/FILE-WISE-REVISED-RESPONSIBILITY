import type { AuthService } from './AuthService'
import { MockAuth } from './mockAuth'

/**
 * The single place the app picks its auth provider.
 *
 * SUPABASE SWAP: write src/auth/supabaseAuth.ts implementing `AuthService` with
 * Supabase Auth (store the role in a `profiles` table or a JWT claim), then change
 * the line below. Enforce "read: any signed-in user, write: admin only" with
 * row-level security policies; the UI checks are for display only.
 */
export const auth: AuthService = new MockAuth()

export type { AuthService } from './AuthService'
