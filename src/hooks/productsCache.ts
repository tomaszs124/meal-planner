import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js'
import type { Product } from '@/lib/supabase/client'

// Pure helpers backing the shared products cache in `useProducts`.
// Kept free of the Supabase client so they can be unit tested in isolation.

/** Cached data is revalidated in the background when older than this. */
export const PRODUCTS_STALE_MS = 60_000

const collator = new Intl.Collator('pl', { sensitivity: 'base' })

/** Case-insensitive Polish ordering by name (ties broken by id for stability). */
export function compareProductsByName(a: Product, b: Product): number {
  return collator.compare(a.name, b.name) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
}

export function sortProducts(products: readonly Product[]): Product[] {
  return [...products].sort(compareProductsByName)
}

/** Insert or replace a product by id. */
export function upsertProduct(products: readonly Product[], product: Product): Product[] {
  const index = products.findIndex((p) => p.id === product.id)
  if (index === -1) return [...products, product]
  const next = [...products]
  next[index] = product
  return next
}

/**
 * Applies a realtime `postgres_changes` event for the `products` table to the
 * list and returns a new, name-sorted list (or the same reference when the
 * event does not affect the list).
 */
export function applyRealtimeEvent(
  products: readonly Product[],
  payload: RealtimePostgresChangesPayload<Product>,
  householdId: string
): Product[] {
  switch (payload.eventType) {
    case 'INSERT':
    case 'UPDATE': {
      const row = payload.new as Product
      if (!row?.id) return products as Product[]
      // A product moved out of this household: drop it.
      if (row.household_id && row.household_id !== householdId) {
        return products.some((p) => p.id === row.id)
          ? products.filter((p) => p.id !== row.id)
          : (products as Product[])
      }
      return sortProducts(upsertProduct(products, row))
    }
    case 'DELETE': {
      const id = (payload.old as Partial<Product>)?.id
      if (!id || !products.some((p) => p.id === id)) return products as Product[]
      return products.filter((p) => p.id !== id)
    }
    default:
      return products as Product[]
  }
}

/** React-style state updater: a value or a function of the previous value. */
export type ProductsUpdater = Product[] | ((current: Product[]) => Product[])

export function resolveUpdater(current: Product[], updater: ProductsUpdater): Product[] {
  return typeof updater === 'function' ? updater(current) : updater
}

export function isStale(fetchedAt: number, now: number, staleMs = PRODUCTS_STALE_MS): boolean {
  return fetchedAt === 0 || now - fetchedAt > staleMs
}
