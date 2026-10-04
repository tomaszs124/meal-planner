import { describe, expect, it } from 'vitest'
import type { Product } from '@/lib/supabase/client'
import type { MealItem } from './types'
import { MEAL_CATEGORIES, mealTotals, translateCategory, translateUnit } from './mealHelpers'

const product = (overrides: Partial<Product>): Product => ({
  id: 'p1',
  household_id: 'h1',
  name: 'Płatki owsiane',
  kcal_per_unit: 370,
  unit_type: '100g',
  unit_weight_grams: 1,
  category: 'Zboża',
  image_url: null,
  protein: 13,
  fat: 7,
  carbs: 60,
  notes: null,
  created_by: null,
  created_at: '',
  updated_at: '',
  ...overrides,
})

const mealItem = (amount: number, p?: Product): MealItem => ({
  id: `mi-${amount}`,
  meal_id: 'm1',
  product_id: p?.id ?? 'missing',
  amount,
  unit_type: p?.unit_type ?? '100g',
  product: p,
})

describe('translateUnit', () => {
  it('translates units to Polish and passes unknown ones through', () => {
    expect(translateUnit('100g')).toBe('g')
    expect(translateUnit('teaspoon')).toBe('łyżeczka')
    expect(translateUnit('leaf')).toBe('liść')
    expect(translateUnit('cube')).toBe('kostka')
    expect(translateUnit('szklanka')).toBe('szklanka')
  })
})

describe('MEAL_CATEGORIES / translateCategory', () => {
  it('lists the five categories in day order', () => {
    expect(MEAL_CATEGORIES.map((c) => c.value)).toEqual(['breakfast', 'second_breakfast', 'lunch', 'dinner', 'snack'])
  })

  it('translates a category and returns empty string for null', () => {
    expect(translateCategory('second_breakfast')).toBe('Drugie śniadanie')
    expect(translateCategory('dinner')).toBe('Kolacja')
    expect(translateCategory(null)).toBe('')
  })
})

describe('mealTotals', () => {
  it('sums kcal and macros over ingredients (per 100 g, scaled by unit weight)', () => {
    const owsiane = product({})
    const banan = product({ id: 'p2', name: 'Banan', unit_type: 'piece', unit_weight_grams: 120, kcal_per_unit: 89, protein: 1, fat: 0.5, carbs: 23 })
    const totals = mealTotals([mealItem(50, owsiane), mealItem(1, banan)])
    expect(totals.totalKcal).toBeCloseTo(185 + 106.8)
    expect(totals.totalProtein).toBeCloseTo(6.5 + 1.2)
    expect(totals.totalFat).toBeCloseTo(3.5 + 0.6)
    expect(totals.totalCarbs).toBeCloseTo(30 + 27.6)
  })

  it('skips items without a product and returns zeros for an empty meal', () => {
    const zeros = { totalKcal: 0, totalProtein: 0, totalFat: 0, totalCarbs: 0 }
    expect(mealTotals([mealItem(100)])).toEqual(zeros)
    expect(mealTotals([])).toEqual(zeros)
  })

  it('treats missing macros as zero', () => {
    const maslo = product({ id: 'p3', name: 'Masło', kcal_per_unit: 735, protein: null, fat: null, carbs: null })
    expect(mealTotals([mealItem(10, maslo)])).toEqual({ totalKcal: 73.5, totalProtein: 0, totalFat: 0, totalCarbs: 0 })
  })
})
