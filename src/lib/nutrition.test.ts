import { describe, expect, it } from 'vitest'
import { amountToGrams, calculateNutrition, formatAmount, nutritionFor, sumNutrition } from './nutrition'

const rice = { unit_weight_grams: 1, kcal_per_unit: 350, protein: 7, fat: 1, carbs: 78 }
const egg = { unit_weight_grams: 60, kcal_per_unit: 140, protein: 12.5, fat: 10, carbs: 1 }
const legacyProduct = { unit_weight_grams: null, kcal_per_unit: 200, protein: null, fat: null, carbs: null }

describe('amountToGrams', () => {
  it('treats products measured in grams as 1 g per unit', () => {
    expect(amountToGrams(150, 1)).toBe(150)
  })

  it('multiplies pieces by the unit weight', () => {
    expect(amountToGrams(2, 60)).toBe(120)
  })

  it('falls back to 1 g per unit when the unit weight is missing (legacy rows)', () => {
    expect(amountToGrams(100, null)).toBe(100)
  })
})

describe('calculateNutrition', () => {
  it('scales the per-100 g value by the weight', () => {
    expect(calculateNutrition(150, 1, 350)).toBeCloseTo(525)
    expect(calculateNutrition(2, 60, 140)).toBeCloseTo(168)
  })

  it('returns 0 for a zero value', () => {
    expect(calculateNutrition(150, 1, 0)).toBe(0)
  })
})

describe('nutritionFor', () => {
  it('computes kcal and macros of one ingredient line', () => {
    const n = nutritionFor(2, egg)
    expect(n.kcal).toBeCloseTo(168)
    expect(n.protein).toBeCloseTo(15)
    expect(n.fat).toBeCloseTo(12)
    expect(n.carbs).toBeCloseTo(1.2)
  })

  it('treats missing macros as 0', () => {
    const n = nutritionFor(50, legacyProduct)
    expect(n.kcal).toBeCloseTo(100)
    expect(n.protein).toBe(0)
    expect(n.fat).toBe(0)
    expect(n.carbs).toBe(0)
  })
})

describe('sumNutrition', () => {
  it('adds up all lines and skips lines without a product', () => {
    const totals = sumNutrition([
      { amount: 100, product: rice },
      { amount: 2, product: egg },
      { amount: 999, product: null },
      { amount: 999 },
    ])
    expect(totals.kcal).toBeCloseTo(350 + 168)
    expect(totals.protein).toBeCloseTo(7 + 15)
    expect(totals.fat).toBeCloseTo(1 + 12)
    expect(totals.carbs).toBeCloseTo(78 + 1.2)
  })

  it('returns zeros for an empty list', () => {
    expect(sumNutrition([])).toEqual({ kcal: 0, protein: 0, fat: 0, carbs: 0 })
  })
})

describe('formatAmount', () => {
  it('drops trailing zeros and rounds to 2 decimals', () => {
    expect(formatAmount(1.5)).toBe('1.5')
    expect(formatAmount(2)).toBe('2')
    expect(formatAmount(0.333)).toBe('0.33')
    expect(formatAmount(12.999)).toBe('13')
  })
})
