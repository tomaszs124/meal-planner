/**
 * Central access to environment variables with readable failures.
 *
 * `NEXT_PUBLIC_*` values are inlined by Next.js at build time, so they must be
 * referenced literally (not via dynamic keys). Server-only secrets go through
 * `requireServerEnv`, which throws a clear message instead of leaking `undefined`
 * into a Supabase client.
 */

function required(name: string, value: string | undefined): string {
  if (!value || value.trim() === '') {
    throw new Error(`Missing environment variable ${name}. Copy .env.example to .env.local and fill it in.`)
  }
  return value
}

export const publicEnv = {
  get supabaseUrl(): string {
    return required('NEXT_PUBLIC_SUPABASE_URL', process.env.NEXT_PUBLIC_SUPABASE_URL)
  },
  get supabasePublishableKey(): string {
    return required('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY)
  },
  /** Public base URL of the app (links in e-mails, MCP results). Falls back to localhost. */
  get appUrl(): string {
    return process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  },
}

/** Reads a server-only variable; never call from client components. */
export function requireServerEnv(name: string): string {
  return required(name, process.env[name])
}
