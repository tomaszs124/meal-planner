import { describe, expect, it } from 'vitest'
import type { Product } from '@/lib/supabase/client'
import {
  collectPlanIngredients,
  getMealGroupKey,
  indexIngredientRows,
  scaleAmounts,
  toShoppingListInsertRows,
  type IngredientRow,
} from './shopping'

const product = (id: string): Product => ({
  id,
  household_id: 'h1',
  name: `Product ${id}`,
  kcal_per_unit: 100,
  unit_type: '100g',
  unit_weight_grams: 100,
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

const base = (meal_id: string, productId: string, amount: number | string, withProduct = true): IngredientRow => ({
  meal_id,
  product_id: productId,
  amount,
  unit_type: '100g',
  product: withProduct ? product(productId) : null,
})

const override = (meal_id: string, user_id: string, productId: string, amount: number): IngredientRow => ({
  ...base(meal_id, productId, amount),
  user_id,
  unit_type: 'piece',
})

function collect(plan: { meal_id: string; user_id: string }[], baseItems: IngredientRow[], overrides: IngredientRow[] = []) {
  const { baseItemsByMeal, overridesByMealAndUser } = indexIngredientRows(baseItems, overrides)
  return collectPlanIngredients(plan, baseItemsByMeal, overridesByMealAndUser)
}

describe('getMealGroupKey', () => {
  it('uses "unknown" for a missing user', () => {
    expect(getMealGroupKey('m1', null)).toBe('m1:unknown')
    expect(getMealGroupKey('m1', undefined)).toBe('m1:unknown')
    expect(getMealGroupKey('m1', 'u1')).toBe('m1:u1')
  })
})

describe('collectPlanIngredients', () => {
  it('uses overrides only for the user who has them', () => {
    const result = collect(
      [
        { meal_id: 'm1', user_id: 'u1' },
        { meal_id: 'm1', user_id: 'u2' },
      ],
      [base('m1', 'pA', 1), base('m1', 'pB', 2)],
      [override('m1', 'u1', 'pC', 3)]
    )

    const u1 = result.items.filter((i) => i.source_user_id === 'u1')
    const u2 = result.items.filter((i) => i.source_user_id === 'u2')
    expect(u1.map((i) => [i.product.id, i.totalAmount, i.unit_type])).toEqual([['pC', 3, 'piece']])
    expect(u2.map((i) => i.product.id).sort()).toEqual(['pA', 'pB'])
  })

  it('ignores overrides of another meal', () => {
    const result = collect([{ meal_id: 'm1', user_id: 'u1' }], [base('m1', 'pA', 1)], [override('m2', 'u1', 'pC', 3)])
    expect(result.items.map((i) => i.product.id)).toEqual(['pA'])
  })

  it('sums amounts across repeated plan rows and counts servings per group', () => {
    const result = collect(
      [
        { meal_id: 'm1', user_id: 'u1' },
        { meal_id: 'm1', user_id: 'u1' },
        { meal_id: 'm1', user_id: 'u2' },
      ],
      [base('m1', 'pA', 1.5)]
    )

    expect(result.items).toHaveLength(2)
    expect(result.items.find((i) => i.source_user_id === 'u1')?.totalAmount).toBe(3)
    expect(result.items.find((i) => i.source_user_id === 'u2')?.totalAmount).toBe(1.5)
    expect(result.servingsByGroupKey).toEqual({ 'm1:u1': 2, 'm1:u2': 1 })
  })

  it('skips items without a product and plan rows without ingredients do not count as servings', () => {
    const result = collect(
      [
        { meal_id: 'm1', user_id: 'u1' },
        { meal_id: 'm2', user_id: 'u1' },
        { meal_id: 'm3', user_id: 'u1' },
      ],
      [base('m1', 'pA', 1), base('m1', 'pX', 5, false), base('m2', 'pY', 5, false)]
    )

    expect(result.items.map((i) => i.product.id)).toEqual(['pA'])
    expect(result.servingsByGroupKey).toEqual({ 'm1:u1': 1 })
  })

  it('parses string amounts and rounds sums to 4 decimals', () => {
    const result = collect(
      [
        { meal_id: 'm1', user_id: 'u1' },
        { meal_id: 'm1', user_id: 'u1' },
        { meal_id: 'm1', user_id: 'u1' },
      ],
      [base('m1', 'pA', '0.1')]
    )
    expect(result.items[0].totalAmount).toBe(0.3)
  })

  it('returns nothing for an empty plan', () => {
    expect(collect([], [base('m1', 'pA', 1)])).toEqual({ items: [], servingsByGroupKey: {} })
  })
})

describe('toShoppingListInsertRows', () => {
  it('builds insert rows with amount rounded to 2 decimals', () => {
    const rows = toShoppingListInsertRows(
      [{ meal_id: 'm1', source_user_id: 'u1', product: product('pA'), totalAmount: 1.23456, unit_type: '100g' }],
      'h1',
      null
    )
    expect(rows).toEqual([
      {
        household_id: 'h1',
        meal_id: 'm1',
        source_user_id: 'u1',
        product_id: 'pA',
        name: 'Product pA',
        amount: 1.23,
        unit_type: '100g',
        custom_amount_text: null,
        is_checked: false,
        added_by: null,
      },
    ])
  })
})

describe('scaleAmounts', () => {
  it('scales, rounds to 2 decimals and clamps to 0.01', () => {
    expect(
      scaleAmounts(
        [
          { id: 'a', amount: 1.5 },
          { id: 'b', amount: '0.333' },
          { id: 'c', amount: 0.001 },
        ],
        2
      )
    ).toEqual([
      { id: 'a', amount: 3 },
      { id: 'b', amount: 0.67 },
      { id: 'c', amount: 0.01 },
    ])
  })
})
