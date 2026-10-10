import { describe, expect, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { isAuthorized, runKeepAlive } from './keep-alive'

describe('isAuthorized', () => {
  it('accepts the bearer token matching CRON_SECRET', () => {
    expect(isAuthorized('Bearer s3cret', 's3cret')).toBe(true)
  })

  it('rejects a wrong token, wrong scheme, missing header or unset secret', () => {
    expect(isAuthorized('Bearer other', 's3cret')).toBe(false)
    expect(isAuthorized('Basic s3cret', 's3cret')).toBe(false)
    expect(isAuthorized(null, 's3cret')).toBe(false)
    expect(isAuthorized('Bearer s3cret', undefined)).toBe(false)
    expect(isAuthorized('Bearer ', '')).toBe(false)
  })
})

type Row = { id: string; created_at: string }

/** Minimal in-memory stand-in for the three query shapes runKeepAlive uses. */
function fakeClient(rows: Row[], failInsert = false) {
  let counter = 0
  const from = vi.fn(() => ({
    insert: () => ({
      select: () => ({
        single: async () => {
          if (failInsert) return { data: null, error: { message: 'boom' } }
          const row = { id: `id-${++counter}`, created_at: new Date().toISOString() }
          rows.push(row)
          return { data: { id: row.id }, error: null }
        },
      }),
    }),
    delete: () => ({
      eq: (_col: string, id: string) => ({
        select: async () => {
          const removed = rows.filter((r) => r.id === id)
          rows.splice(0, rows.length, ...rows.filter((r) => r.id !== id))
          return { data: removed.map((r) => ({ id: r.id })), error: null }
        },
      }),
      lt: (_col: string, before: string) => ({
        select: async () => {
          const removed = rows.filter((r) => r.created_at < before)
          rows.splice(0, rows.length, ...rows.filter((r) => r.created_at >= before))
          return { data: removed.map((r) => ({ id: r.id })), error: null }
        },
      }),
    }),
  }))
  return { client: { from } as unknown as SupabaseClient, from }
}

describe('runKeepAlive', () => {
  it('inserts a row, deletes it and leaves the table empty', async () => {
    const rows: Row[] = []
    const { client, from } = fakeClient(rows)
    const result = await runKeepAlive(client)
    expect(result.ok).toBe(true)
    expect(result.deleted).toBe(1)
    expect(result.swept_stale).toBe(0)
    expect(rows).toHaveLength(0)
    expect(from).toHaveBeenCalledWith('keep_alive')
  })

  it('sweeps rows left over from a failed earlier run', async () => {
    const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()
    const rows: Row[] = [{ id: 'old', created_at: twoDaysAgo }]
    const { client } = fakeClient(rows)
    const result = await runKeepAlive(client)
    expect(result.swept_stale).toBe(1)
    expect(rows).toHaveLength(0)
  })

  it('throws a readable error when the insert fails', async () => {
    const { client } = fakeClient([], true)
    await expect(runKeepAlive(client)).rejects.toThrow(/insert failed: boom/)
  })
})
