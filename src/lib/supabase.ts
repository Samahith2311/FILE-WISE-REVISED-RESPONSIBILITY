import { createClient, type SupabaseClient } from '@supabase/supabase-js'

/** Which data and auth backend the app uses. Set VITE_DATA_BACKEND in .env. */
export const BACKEND: 'local' | 'supabase' = import.meta.env.VITE_DATA_BACKEND === 'supabase' ? 'supabase' : 'local'

let client: SupabaseClient | null = null

/** The shared Supabase client. Created on first use, so local mode never needs the keys. */
export function getSupabase(): SupabaseClient {
  if (client) return client
  const url = import.meta.env.VITE_SUPABASE_URL
  const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY
  if (!url || !key) {
    throw new Error('VITE_DATA_BACKEND=supabase needs VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY in .env.')
  }
  client = createClient(url, key)
  return client
}
