import { BACKEND, getSupabase } from '../lib/supabase'
import type { AuthService } from './AuthService'
import { MockAuth } from './mockAuth'
import { SupabaseAuth } from './supabaseAuth'

/**
 * The single place the app picks its auth provider, from VITE_DATA_BACKEND in .env.
 * With Supabase, row-level security enforces "read: any signed-in user, write: admin
 * only"; the UI checks are for display only.
 */
export const auth: AuthService = BACKEND === 'supabase' ? new SupabaseAuth(getSupabase()) : new MockAuth()

export type { AuthService } from './AuthService'
