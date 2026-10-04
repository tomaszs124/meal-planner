'use client'

import { useCallback, useEffect, useSyncExternalStore } from 'react'
import type { RealtimeChannel, RealtimePostgresChangesPayload } from '@supabase/supabase-js'
import { supabase, Product } from '@/lib/supabase/client'
import {
  applyRealtimeEvent,
  isStale,
  resolveUpdater,
  sortProducts,
  type ProductsUpdater,
} from './productsCache'

// Shared, in-memory products cache keyed by household id.
//
// - The first mounted consumer fetches; later consumers get cached data
//   immediately and trigger a background revalidation when it is stale.
// - One realtime channel per household while at least one consumer is mounted;
//   events are applied to the cache in place (no refetch).
// - `setProducts` writes through to the cache so optimistic updates are visible
//   in every view.
// Consumers read the cache via useSyncExternalStore, so there are no setState
// calls on unmounted components and StrictMode double effects are harmless.

type Snapshot = {
  products: Product[]
  isLoading: boolean
  error: string | null
}

type Entry = {
  snapshot: Snapshot
  fetchedAt: number
  inflight: Promise<void> | null
  /** Bumped on every local or realtime mutation; used to detect fetch races. */
  version: number
  listeners: Set<() => void>
  channel: RealtimeChannel | null
  teardownTimer: ReturnType<typeof setTimeout> | null
}

/** Delay before removing an unused channel, so quick remounts (StrictMode, tab switches) reuse it. */
const CHANNEL_TEARDOWN_DELAY_MS = 1_000

const IDLE_SNAPSHOT: Snapshot = { products: [], isLoading: false, error: null }
const LOADING_SNAPSHOT: Snapshot = { products: [], isLoading: true, error: null }

const cache = new Map<string, Entry>()
let channelSeq = 0

function getEntry(householdId: string): Entry {
  let entry = cache.get(householdId)
  if (!entry) {
    entry = {
      snapshot: LOADING_SNAPSHOT,
      fetchedAt: 0,
      inflight: null,
      version: 0,
      listeners: new Set(),
      channel: null,
      teardownTimer: null,
    }
    cache.set(householdId, entry)
  }
  return entry
}

function update(entry: Entry, patch: Partial<Snapshot>) {
  entry.snapshot = { ...entry.snapshot, ...patch }
  entry.listeners.forEach((listener) => listener())
}

function fetchProducts(householdId: string, retriesLeft = 1): Promise<void> {
  const entry = getEntry(householdId)
  if (entry.inflight) return entry.inflight

  // Only show a loading state when there is nothing cached yet.
  if (entry.fetchedAt === 0 && !entry.snapshot.isLoading) {
    update(entry, { isLoading: true })
  }

  const startVersion = entry.version
  let retry = false

  entry.inflight = (async () => {
    try {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('household_id', householdId)
        .order('name')

      if (error) {
        update(entry, { isLoading: false, error: error.message })
        return
      }
      // The cache changed while the request was in flight (optimistic update or
      // realtime event); the response may predate it, so fetch once more.
      if (entry.version !== startVersion && retriesLeft > 0) {
        retry = true
        return
      }
      entry.fetchedAt = Date.now()
      update(entry, { products: sortProducts(data ?? []), isLoading: false, error: null })
    } catch (err) {
      update(entry, {
        isLoading: false,
        error: err instanceof Error ? err.message : 'Failed to fetch products',
      })
    } finally {
      entry.inflight = null
    }
    if (retry) await fetchProducts(householdId, retriesLeft - 1)
  })()

  return entry.inflight
}

function openChannel(householdId: string, entry: Entry) {
  if (entry.teardownTimer) {
    clearTimeout(entry.teardownTimer)
    entry.teardownTimer = null
  }
  if (entry.channel) return

  entry.channel = supabase
    .channel(`products-${householdId}-${++channelSeq}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'products',
        filter: `household_id=eq.${householdId}`,
      },
      (payload: RealtimePostgresChangesPayload<Product>) => {
        const next = applyRealtimeEvent(entry.snapshot.products, payload, householdId)
        if (next === entry.snapshot.products) return
        entry.version++
        update(entry, { products: next })
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
    // Realtime events are no longer applied while nobody listens, so the cache may go
    // stale silently. Mark it stale (not empty): the next mount shows the cached list
    // immediately and revalidates in the background instead of flashing a skeleton.
    if (entry.fetchedAt > 0) entry.fetchedAt = 1
    void supabase.removeChannel(channel)
  }, CHANNEL_TEARDOWN_DELAY_MS)
}

function subscribe(householdId: string, listener: () => void): () => void {
  const entry = getEntry(householdId)
  entry.listeners.add(listener)
  openChannel(householdId, entry)

  return () => {
    entry.listeners.delete(listener)
    if (entry.listeners.size === 0) scheduleChannelTeardown(entry)
  }
}

type UseProductsReturn = Snapshot & {
  /** Force a refetch from the database. */
  refresh: () => Promise<void>
  /** Write-through setter (value or functional updater); the list is kept sorted by name. */
  setProducts: (updater: ProductsUpdater) => void
}

/** Products of a household, sorted by name (case-insensitive, Polish collation). */
export function useProducts(householdId: string | null | undefined): UseProductsReturn {
  const id = householdId || null

  const subscribeToStore = useCallback(
    (listener: () => void) => (id ? subscribe(id, listener) : () => {}),
    [id]
  )
  const getSnapshot = useCallback(() => (id ? getEntry(id).snapshot : IDLE_SNAPSHOT), [id])
  const getServerSnapshot = useCallback(() => (id ? LOADING_SNAPSHOT : IDLE_SNAPSHOT), [id])

  const snapshot = useSyncExternalStore(subscribeToStore, getSnapshot, getServerSnapshot)

  // Fetch on first use, revalidate in the background when stale.
  useEffect(() => {
    if (!id) return
    const entry = getEntry(id)
    if (isStale(entry.fetchedAt, Date.now())) void fetchProducts(id)
  }, [id])

  const refresh = useCallback(async () => {
    if (!id) return
    const entry = getEntry(id)
    // Wait for a running fetch, then fetch again so the result reflects the latest state.
    if (entry.inflight) await entry.inflight
    await fetchProducts(id)
  }, [id])

  const setProducts = useCallback(
    (updater: ProductsUpdater) => {
      if (!id) return
      const entry = getEntry(id)
      const next = resolveUpdater(entry.snapshot.products, updater)
      entry.version++
      update(entry, { products: sortProducts(next) })
    },
    [id]
  )

  return { ...snapshot, refresh, setProducts }
}
