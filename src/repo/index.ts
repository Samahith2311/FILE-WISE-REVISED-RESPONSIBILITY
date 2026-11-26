import { LocalRepo } from './LocalRepo'
import type { Repo } from './Repo'

/**
 * The single place the app picks its data source.
 *
 * SUPABASE SWAP: write src/repo/SupabaseRepo.ts implementing `Repo`, then change
 * the line below to `export const repo: Repo = new SupabaseRepo(supabaseClient)`.
 * No component imports LocalRepo directly.
 */
export const repo: Repo = new LocalRepo()

export type { Repo } from './Repo'
export { PermissionError, ACTIVITY_LIMIT } from './Repo'
