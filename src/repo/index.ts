import { BACKEND, getSupabase } from '../lib/supabase'
import { LocalRepo } from './LocalRepo'
import type { Repo } from './Repo'
import { SupabaseRepo } from './SupabaseRepo'

/**
 * The single place the app picks its data source, from VITE_DATA_BACKEND in .env:
 * local (browser storage, works offline) or supabase. No component imports a repo directly.
 */
export const repo: Repo = BACKEND === 'supabase' ? new SupabaseRepo(getSupabase()) : new LocalRepo()

export type { Repo } from './Repo'
export { PermissionError, ACTIVITY_LIMIT } from './Repo'
