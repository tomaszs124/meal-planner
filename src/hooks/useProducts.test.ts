import { describe, expect, it } from 'vitest'
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js'
import type { Product } from '@/lib/supabase/client'
import {
  PRODUCTS_STALE_MS,
  applyRealtimeEvent,
  isStale,
  resolveUpdater,
  sortProducts,
  upsertProduct,
} from './productsCache'

const HH = 'household-1'

function product(id: string, name: string, extra: Partial<Product> = {}): Product {
  return {
    id,
    household_id: HH,
    name,
    kcal_per_unit: 100,
    unit_type: '100g',
    unit_weight_grams: 1,
    category: 'Pozostałe',
    image_url: null,
    protein: null,
    fat: null,
    carbs: null,
    notes: null,
    created_by: null,
    created_at: '2026-01-01T00:00:00+00:00',
    updated_at: '2026-01-01T00:00:00+00:00',
    ...extra,
  }
}

function event(
  eventType: 'INSERT' | 'UPDATE' | 'DELETE',
  row: Partial<Product>
): RealtimePostgresChangesPayload<Product> {
  return {
    schema: 'public',
    table: 'products',
    commit_timestamp: '2026-01-01T00:00:00Z',
    errors: [],
    eventType,
    new: eventType === 'DELETE' ? {} : row,
    old: eventType === 'DELETE' ? row : {},
  } as RealtimePostgresChangesPayload<Product>
}

const names = (list: Product[]) => list.map((p) => p.name)

describe('sortProducts', () => {
  it('sorts case-insensitively with Polish collation', () => {
    const list = [product('1', 'żurek'), product('2', 'Banan'), product('3', 'ananas'), product('4', 'Łosoś'), product('5', 'lody')]
    expect(names(sortProducts(list))).toEqual(['ananas', 'Banan', 'lody', 'Łosoś', 'żurek'])
  })

  it('does not mutate the input', () => {
    const list = [product('1', 'b'), product('2', 'a')]
    sortProducts(list)
    expect(names(list)).toEqual(['b', 'a'])
  })
})

describe('upsertProduct', () => {
  it('replaces by id or appends', () => {
    const list = [product('1', 'a')]
    expect(upsertProduct(list, product('1', 'A2'))).toEqual([product('1', 'A2')])
    expect(upsertProduct(list, product('2', 'b'))).toHaveLength(2)
  })
})

describe('applyRealtimeEvent', () => {
  const base = sortProducts([product('1', 'Jabłko'), product('2', 'Chleb')])

  it('inserts in name order', () => {
    const next = applyRealtimeEvent(base, event('INSERT', product('3', 'Masło')), HH)
    expect(names(next)).toEqual(['Chleb', 'Jabłko', 'Masło'])
  })

  it('does not duplicate an already present (optimistically inserted) row', () => {
    const next = applyRealtimeEvent(base, event('INSERT', product('2', 'Chleb')), HH)
    expect(next).toHaveLength(2)
  })

  it('updates in place and re-sorts', () => {
    const next = applyRealtimeEvent(base, event('UPDATE', product('1', 'Awokado')), HH)
    expect(names(next)).toEqual(['Awokado', 'Chleb'])
  })

  it('drops a product moved to another household', () => {
    const next = applyRealtimeEvent(base, event('UPDATE', product('1', 'Jabłko', { household_id: 'other' })), HH)
    expect(names(next)).toEqual(['Chleb'])
  })

  it('deletes by id and ignores unknown ids', () => {
    expect(names(applyRealtimeEvent(base, event('DELETE', { id: '2' }), HH))).toEqual(['Jabłko'])
    expect(applyRealtimeEvent(base, event('DELETE', { id: 'missing' }), HH)).toBe(base)
  })
})

describe('resolveUpdater', () => {
  it('supports values and functional updaters', () => {
    const list = [product('1', 'a')]
    expect(resolveUpdater(list, [])).toEqual([])
    expect(resolveUpdater(list, (current) => [...current, product('2', 'b')])).toHaveLength(2)
  })
})

describe('isStale', () => {
  it('treats never-fetched and old data as stale', () => {
    expect(isStale(0, 1000)).toBe(true)
    expect(isStale(1000, 1000 + PRODUCTS_STALE_MS)).toBe(false)
    expect(isStale(1000, 1001 + PRODUCTS_STALE_MS)).toBe(true)
  })
})
