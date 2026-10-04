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

/**
 * Per-request client acting as a signed-in user (OAuth flow): publishable key plus
 * the user's access token, so every query is subject to RLS exactly like the web app.
 */
export function getUserClient(accessToken: string): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  if (!url || !key) {
    throw new Error('MCP: missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY')
  }
  return createClient(url, key, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })
}
