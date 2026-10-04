import { describe, expect, it } from 'vitest'
import type { Meal, MealImage, Product, Tag } from '@/lib/supabase/client'
import { assembleMeals, inChunks, type MealItemWithProduct, type MealTagRow } from './meals-data'

const product = (id: string, kcal: number, unitWeight = 1): Product => ({
  id,
  household_id: 'h1',
  name: id,
  kcal_per_unit: kcal,
  unit_type: '100g',
  unit_weight_grams: unitWeight,
  package_size: null,
  category: 'Pozostałe',
  image_url: null,
  protein: null,
  fat: null,
  carbs: null,
  notes: null,
  created_by: null,
  created_at: '',
  updated_at: '',
})

const meal = (id: string): Meal => ({
  id,
  name: `Meal ${id}`,
  user_id: 'u1',
  household_id: 'h1',
  is_shared: true,
  description: null,
  primary_category: 'lunch',
  alternative_categories: [],
  created_at: '',
  updated_at: '',
})

const rice = product('rice', 350)
const egg = product('egg', 140, 60)

const baseItems: MealItemWithProduct[] = [
  { id: 'i1', meal_id: 'm1', product_id: 'rice', amount: 100, unit_type: '100g', product: rice },
  { id: 'i2', meal_id: 'm1', product_id: 'egg', amount: 1, unit_type: 'piece', product: egg },
  { id: 'i3', meal_id: 'm2', product_id: 'rice', amount: 50, unit_type: '100g', product: rice },
]

const overrides: MealItemWithProduct[] = [
  { id: 'o1', meal_id: 'm2', product_id: 'rice', amount: 200, unit_type: '100g', user_id: 'u1', product: rice },
]

const tag: Tag = { id: 't1', household_id: 'h1', name: 'szybkie', color: '#000', text_color: '#fff', created_at: '', updated_at: '' }
const tagRows: MealTagRow[] = [
  { meal_id: 'm1', tag_id: 't1', tags: tag },
  { meal_id: 'm1', tag_id: 't-missing', tags: null },
]

const images: MealImage[] = [{ id: 'img1', meal_id: 'm2', image_url: 'x', uploaded_by: null, uploaded_at: '' }]

describe('assembleMeals', () => {
  const result = assembleMeals([meal('m1'), meal('m2'), meal('m3')], baseItems, overrides, images, tagRows)

  it('keeps meal order and returns one entry per meal', () => {
    expect(result.map((m) => m.id)).toEqual(['m1', 'm2', 'm3'])
  })

  it('uses the base recipe when the user has no override', () => {
    const m1 = result[0]
    expect(m1.isUserVariant).toBe(false)
    expect(m1.items.map((i) => i.id)).toEqual(['i1', 'i2'])
    expect(m1.totalKcal).toBeCloseTo(350 + 84)
  })

  it('replaces the base recipe with the user override and keeps baseItems', () => {
    const m2 = result[1]
    expect(m2.isUserVariant).toBe(true)
    expect(m2.items.map((i) => i.id)).toEqual(['o1'])
    expect(m2.baseItems.map((i) => i.id)).toEqual(['i3'])
    expect(m2.totalKcal).toBeCloseTo(700)
  })

  it('attaches tags (skipping dangling rows) and images', () => {
    expect(result[0].tags.map((t) => t.name)).toEqual(['szybkie'])
    expect(result[1].images).toHaveLength(1)
  })

  it('returns empty collections and zero totals for a meal without data', () => {
    const m3 = result[2]
    expect(m3.items).toEqual([])
    expect(m3.tags).toEqual([])
    expect(m3.images).toEqual([])
    expect(m3.totalKcal).toBe(0)
  })
})

describe('inChunks', () => {
  it('splits ids into chunks and concatenates results', async () => {
    const calls: string[][] = []
    const ids = Array.from({ length: 7 }, (_, i) => `id${i}`)
    const rows = await inChunks(
      ids,
      async (chunk) => {
        calls.push(chunk)
        return { data: chunk.map((id) => ({ id })), error: null }
      },
      3
    )
    expect(calls.map((c) => c.length)).toEqual([3, 3, 1])
    expect(rows).toHaveLength(7)
  })

  it('throws on the first error', async () => {
    await expect(
      inChunks(['a'], async () => ({ data: null, error: { message: 'boom' } }))
    ).rejects.toEqual({ message: 'boom' })
  })
})
