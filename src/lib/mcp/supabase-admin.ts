import { createClient, SupabaseClient } from '@supabase/supabase-js'

/**
 * Server-only Supabase client using the service role key.
 * It bypasses RLS, so every tool MUST scope queries to the household resolved
 * in `context.ts`. Never import this file from client components.
 */
let cached: SupabaseClient | null = null

export function getAdminClient(): SupabaseClient {
  if (cached) return cached

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !key) {
    throw new Error(
      'MCP: missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variable'
    )
  }

  cached = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })

  return cached
}
