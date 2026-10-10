import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Keep-alive for the Supabase project: a real write followed by a delete, so the
 * project shows activity and is not paused on the free plan. Pure logic lives here
 * (testable without HTTP); the route in src/app/api/keep-alive wires it to Vercel Cron.
 */

export const KEEP_ALIVE_TABLE = 'keep_alive'

/** Rows older than this are swept on every run in case a previous delete failed. */
const STALE_AFTER_MS = 24 * 60 * 60 * 1000

export type KeepAliveResult = {
  ok: true
  inserted_id: string
  deleted: number
  swept_stale: number
  ran_at: string
}

/**
 * Vercel Cron sends `Authorization: Bearer <CRON_SECRET>`; the GitHub Actions backup
 * sends the same header. Anything else (or an unset secret) is rejected.
 */
export function isAuthorized(authorizationHeader: string | null, cronSecret: string | undefined): boolean {
  if (!cronSecret || cronSecret.trim() === '') return false
  if (!authorizationHeader) return false
  const [scheme, token] = authorizationHeader.split(' ', 2)
  return scheme === 'Bearer' && token === cronSecret
}

export async function runKeepAlive(client: SupabaseClient, now: Date = new Date()): Promise<KeepAliveResult> {
  const ranAt = now.toISOString()

  const { data: inserted, error: insertError } = await client
    .from(KEEP_ALIVE_TABLE)
    .insert({ note: `keep-alive ${ranAt}` })
    .select('id')
    .single()
  if (insertError || !inserted) {
    throw new Error(`keep-alive insert failed: ${insertError?.message ?? 'no row returned'}`)
  }

  const { data: deletedRows, error: deleteError } = await client
    .from(KEEP_ALIVE_TABLE)
    .delete()
    .eq('id', inserted.id)
    .select('id')
  if (deleteError) {
    throw new Error(`keep-alive delete failed: ${deleteError.message}`)
  }

  const staleBefore = new Date(now.getTime() - STALE_AFTER_MS).toISOString()
  const { data: sweptRows, error: sweepError } = await client
    .from(KEEP_ALIVE_TABLE)
    .delete()
    .lt('created_at', staleBefore)
    .select('id')
  if (sweepError) {
    throw new Error(`keep-alive sweep failed: ${sweepError.message}`)
  }

  return {
    ok: true,
    inserted_id: inserted.id,
    deleted: deletedRows?.length ?? 0,
    swept_stale: sweptRows?.length ?? 0,
    ran_at: ranAt,
  }
}
