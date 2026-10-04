'use client'

import { useCallback, useEffect, useSyncExternalStore } from 'react'
import type { RealtimeChannel, RealtimePostgresChangesPayload } from '@supabase/supabase-js'
import { supabase, UserSettings } from '@/lib/supabase/client'
import {
  NO_ROWS_ERROR_CODE,
  applySettingsEvent,
  buildSaveRow,
  defaultSettingsRow,
  mergeSettings,
  type UserSettingsPatch,
} from './userSettingsCache'

// Shared, in-memory cache of the `user_settings` row, keyed by user id
// (same pattern as `useProducts`).
//
// - The first mounted consumer fetches; when the row does not exist yet, default
//   settings are inserted and cached. Later consumers get the cached row at once.
// - One realtime channel per user while at least one consumer is mounted;
//   INSERT/UPDATE events are applied to the cache in place.
// - `save()` updates the cache optimistically, writes to the database and rolls
//   back when the write fails.

type Snapshot = {
  settings: UserSettings | null
  isLoading: boolean
  error: string | null
}

type Entry = {
  snapshot: Snapshot
  /** True once a fetch succeeded; reset when the channel is torn down so the next mount revalidates. */
  loaded: boolean
  inflight: Promise<void> | null
  /** Bumped on every local or realtime mutation; used to detect fetch and save races. */
  version: number
  listeners: Set<() => void>
  channel: RealtimeChannel | null
  teardownTimer: ReturnType<typeof setTimeout> | null
}

/** Delay before removing an unused channel, so quick remounts (StrictMode, navigation) reuse it. */
const CHANNEL_TEARDOWN_DELAY_MS = 1_000

const IDLE_SNAPSHOT: Snapshot = { settings: null, isLoading: false, error: null }
const LOADING_SNAPSHOT: Snapshot = { settings: null, isLoading: true, error: null }

const cache = new Map<string, Entry>()
let channelSeq = 0

function getEntry(userId: string): Entry {
  let entry = cache.get(userId)
  if (!entry) {
    entry = {
      snapshot: LOADING_SNAPSHOT,
      loaded: false,
      inflight: null,
      version: 0,
      listeners: new Set(),
      channel: null,
      teardownTimer: null,
    }
    cache.set(userId, entry)
  }
  return entry
}

function update(entry: Entry, patch: Partial<Snapshot>) {
  entry.snapshot = { ...entry.snapshot, ...patch }
  entry.listeners.forEach((listener) => listener())
}

/** Inserts the default settings row; returns the created row or an error message. */
async function createDefaultSettings(
  userId: string
): Promise<{ settings: UserSettings | null; error: string | null }> {
  const { data, error } = await supabase
    .from('user_settings')
    .insert([defaultSettingsRow(userId)])
    .select()
    .single()

  if (error || !data) return { settings: null, error: error?.message ?? 'Failed to create settings' }
  return { settings: data as UserSettings, error: null }
}

function fetchSettings(userId: string, retriesLeft = 1): Promise<void> {
  const entry = getEntry(userId)
  if (entry.inflight) return entry.inflight

  // Only show a loading state when there is nothing cached yet.
  if (!entry.snapshot.settings && !entry.snapshot.isLoading) {
    update(entry, { isLoading: true })
  }

  const startVersion = entry.version
  let retry = false

  entry.inflight = (async () => {
    try {
      const { data, error } = await supabase
        .from('user_settings')
        .select('*')
        .eq('user_id', userId)
        .single()

      if (error && error.code === NO_ROWS_ERROR_CODE) {
        // Settings do not exist yet - create default ones
        const created = await createDefaultSettings(userId)
        if (created.settings) {
          entry.loaded = true
          entry.version++
          update(entry, { settings: created.settings, isLoading: false, error: null })
        } else {
          update(entry, { isLoading: false, error: created.error })
        }
        return
      }

      if (error || !data) {
        if (error) console.error('Error fetching settings:', error)
        update(entry, { isLoading: false, error: error?.message ?? 'Failed to fetch settings' })
        return
      }

      // The cache changed while the request was in flight (optimistic save or
      // realtime event); the response may predate it, so fetch once more.
      if (entry.version !== startVersion && retriesLeft > 0) {
        retry = true
        return
      }
      entry.loaded = true
      update(entry, { settings: data as UserSettings, isLoading: false, error: null })
    } catch (err) {
      update(entry, {
        isLoading: false,
        error: err instanceof Error ? err.message : 'Failed to fetch settings',
      })
    } finally {
      entry.inflight = null
    }
    if (retry) await fetchSettings(userId, retriesLeft - 1)
  })()

  return entry.inflight
}

function openChannel(userId: string, entry: Entry) {
  if (entry.teardownTimer) {
    clearTimeout(entry.teardownTimer)
    entry.teardownTimer = null
  }
  if (entry.channel) return

  entry.channel = supabase
    .channel(`user_settings_${userId}-${++channelSeq}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'user_settings',
        filter: `user_id=eq.${userId}`,
      },
      (payload: RealtimePostgresChangesPayload<UserSettings>) => {
        const next = applySettingsEvent(entry.snapshot.settings, payload, userId)
        if (next === entry.snapshot.settings) return
        entry.version++
        update(entry, { settings: next })
      }
    )
    .subscribe()
}

function scheduleChannelTeardown(entry: Entry) {
  if (entry.teardownTimer) clearTimeout(entry.teardownTimer)
  entry.teardownTimer = setTimeout(() => {
    entry.teardownTimer = null
    if (entry.listeners.size > 0 || !entry.channel) return
    const channel = entry.channel
    entry.channel = null
    // Realtime events are no longer applied while nobody listens: revalidate on the next mount.
    entry.loaded = false
    void supabase.removeChannel(channel)
  }, CHANNEL_TEARDOWN_DELAY_MS)
}

function subscribe(userId: string, listener: () => void): () => void {
  const entry = getEntry(userId)
  entry.listeners.add(listener)
  openChannel(userId, entry)

  return () => {
    entry.listeners.delete(listener)
    if (entry.listeners.size === 0) scheduleChannelTeardown(entry)
  }
}

async function saveSettings(userId: string, patch: UserSettingsPatch): Promise<boolean> {
  const entry = getEntry(userId)
  const previous = entry.snapshot.settings
  const row = buildSaveRow(userId, patch)

  const optimistic = mergeSettings(previous, patch)
  if (optimistic) {
    entry.version++
    update(entry, { settings: optimistic })
  }
  const optimisticVersion = entry.version

  const result = previous
    ? // Update the existing settings
      await supabase.from('user_settings').update(row).eq('user_id', userId).select().single()
    : // Create new settings
      await supabase.from('user_settings').insert(row).select().single()

  if (result.error || !result.data) {
    console.error(result.error)
    // Roll back unless something newer (realtime event, another save) replaced the optimistic value.
    if (optimistic && entry.version === optimisticVersion) {
      entry.version++
      update(entry, { settings: previous })
    }
    return false
  }

  entry.version++
  entry.loaded = true
  update(entry, { settings: result.data as UserSettings, error: null })
  return true
}

type UseUserSettingsReturn = Snapshot & {
  /** Optimistically apply the patch and persist it; resolves to false (after rollback) on failure. */
  save: (patch: UserSettingsPatch) => Promise<boolean>
  /** Force a refetch from the database. */
  refresh: () => Promise<void>
}

/** The `user_settings` row of a user, shared across components and kept in sync via realtime. */
export function useUserSettings(userId: string | null | undefined): UseUserSettingsReturn {
  const id = userId || null

  const subscribeToStore = useCallback(
    (listener: () => void) => (id ? subscribe(id, listener) : () => {}),
    [id]
  )
  const getSnapshot = useCallback(() => (id ? getEntry(id).snapshot : IDLE_SNAPSHOT), [id])
  const getServerSnapshot = useCallback(() => (id ? LOADING_SNAPSHOT : IDLE_SNAPSHOT), [id])

  const snapshot = useSyncExternalStore(subscribeToStore, getSnapshot, getServerSnapshot)

  // Fetch on first use (and again after the realtime channel was torn down).
  useEffect(() => {
    if (!id) return
    if (!getEntry(id).loaded) void fetchSettings(id)
  }, [id])

  const refresh = useCallback(async () => {
    if (!id) return
    const entry = getEntry(id)
    // Wait for a running fetch, then fetch again so the result reflects the latest state.
    if (entry.inflight) await entry.inflight
    await fetchSettings(id)
  }, [id])

  const save = useCallback(
    async (patch: UserSettingsPatch) => (id ? saveSettings(id, patch) : false),
    [id]
  )

  return { ...snapshot, save, refresh }
}
