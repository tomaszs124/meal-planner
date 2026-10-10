import { getAdminClient } from '@/lib/mcp/supabase-admin'
import { isAuthorized, runKeepAlive } from '@/lib/keep-alive'

/**
 * GET /api/keep-alive  with  Authorization: Bearer <CRON_SECRET>
 *
 * Writes and deletes one row in public.keep_alive so the Supabase project counts
 * as active and is not paused. Called daily by Vercel Cron (vercel.json), which
 * sends the CRON_SECRET header automatically, and by the GitHub Actions backup.
 * Setup: run docs/add-keep-alive.sql, set CRON_SECRET + SUPABASE_SERVICE_ROLE_KEY in Vercel.
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 30

export async function GET(req: Request): Promise<Response> {
  if (!isAuthorized(req.headers.get('authorization'), process.env.CRON_SECRET)) {
    return Response.json({ ok: false, error: 'unauthorized' }, { status: 401 })
  }

  try {
    const result = await runKeepAlive(getAdminClient())
    return Response.json(result)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error('keep-alive failed:', message)
    return Response.json({ ok: false, error: message }, { status: 500 })
  }
}
