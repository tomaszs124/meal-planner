import { describe, expect, it } from 'vitest'
import type { Product } from '@/lib/supabase/client'
import {
  appendRow,
  defaultAmountFor,
  filterProducts,
  formatAmountInput,
  normalizeSearch,
  parseAmount,
  removeRow,
  setRowAmount,
  setRowProduct,
} from './mealFormHelpers'

const product = (overrides: Partial<Product>): Product => ({
  id: 'p1',
  household_id: 'h1',
  name: 'Płatki owsiane',
  kcal_per_unit: 370,
  unit_type: '100g',
  unit_weight_grams: 1,
  package_size: null,
  category: 'other' as Product['category'],
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

const oats = product({ id: 'oats', name: 'Płatki owsiane', unit_type: '100g' })
const egg = product({ id: 'egg', name: 'Jajko', unit_type: 'piece', unit_weight_grams: 60 })
const cheese = product({ id: 'cheese', name: 'Ser żółty gouda', unit_type: 'slice', unit_weight_grams: 15 })
const products = [oats, egg, cheese]

describe('defaultAmountFor', () => {
  it('starts weight-based products at 100 g and unit products at 1', () => {
    expect(defaultAmountFor(oats)).toBe(100)
    expect(defaultAmountFor(egg)).toBe(1)
    expect(defaultAmountFor(undefined)).toBe(1)
  })
})

describe('parseAmount', () => {
  it('accepts dot and comma decimals', () => {
    expect(parseAmount('0.5')).toBe(0.5)
    expect(parseAmount('0,25')).toBe(0.25)
    expect(parseAmount(' 70 ')).toBe(70)
  })

  it('returns null for empty, partial or invalid input', () => {
    expect(parseAmount('')).toBeNull()
    expect(parseAmount('.')).toBeNull()
    expect(parseAmount('abc')).toBeNull()
    expect(parseAmount('-1')).toBeNull()
    expect(parseAmount('1e3')).toBeNull()
  })
})

describe('normalizeSearch / filterProducts', () => {
  it('ignores case and Polish diacritics', () => {
    expect(normalizeSearch('Żółty')).toBe('zolty')
    expect(normalizeSearch('Łosoś')).toBe('losos')
  })

  it('matches every word of the query in any order', () => {
    expect(filterProducts(products, 'gouda ser').map((p) => p.id)).toEqual(['cheese'])
    expect(filterProducts(products, 'zolty').map((p) => p.id)).toEqual(['cheese'])
    expect(filterProducts(products, 'platki')).toEqual([oats])
  })

  it('returns everything for an empty query and nothing for no match', () => {
    expect(filterProducts(products, '   ')).toEqual(products)
    expect(filterProducts(products, 'tofu')).toEqual([])
  })
})

describe('row helpers', () => {
  it('appendRow adds the product with its default amount without mutating the list', () => {
    const list = [{ product_id: 'egg', amount: 2 }]
    const next = appendRow(list, oats)
    expect(next).toEqual([{ product_id: 'egg', amount: 2 }, { product_id: 'oats', amount: 100 }])
    expect(list).toHaveLength(1)
  })

  it('removeRow and setRowAmount touch only the given index', () => {
    const list = [{ product_id: 'egg', amount: 2 }, { product_id: 'oats', amount: 50 }]
    expect(removeRow(list, 0)).toEqual([{ product_id: 'oats', amount: 50 }])
    expect(setRowAmount(list, 1, 80)).toEqual([{ product_id: 'egg', amount: 2 }, { product_id: 'oats', amount: 80 }])
    expect(list[1].amount).toBe(50)
  })

  it('setRowProduct keeps the amount between unit products and resets it across unit kinds', () => {
    const list = [{ product_id: 'egg', amount: 2 }]
    expect(setRowProduct(list, 0, cheese, products)).toEqual([{ product_id: 'cheese', amount: 2 }])
    expect(setRowProduct(list, 0, oats, products)).toEqual([{ product_id: 'oats', amount: 100 }])
    const grams = [{ product_id: 'oats', amount: 40 }]
    expect(setRowProduct(grams, 0, egg, products)).toEqual([{ product_id: 'egg', amount: 1 }])
  })
})

describe('formatAmountInput', () => {
  it('drops needless decimals', () => {
    expect(formatAmountInput(2)).toBe('2')
    expect(formatAmountInput(0.5)).toBe('0.5')
    expect(formatAmountInput(0.333333)).toBe('0.33')
    expect(formatAmountInput(NaN)).toBe('')
  })
})
