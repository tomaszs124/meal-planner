import { describe, expect, it } from 'vitest'
import type { Product, ProductCategoryRecord } from '@/lib/supabase/client'
import {
  DEFAULT_CATEGORY_NAME,
  PACKAGE_UNIT_LABEL,
  defaultUnitWeight,
  emptyProductForm,
  getDefaultCategoryName,
  isProductFormValid,
  packageSizePlaceholder,
  productToFormValues,
  toProductPayload,
  unitLabel,
  unitWeightPlaceholder,
  type ProductFormValues,
} from './productFormHelpers'

const category = (name: string): ProductCategoryRecord => ({
  id: `c-${name}`,
  household_id: 'h1',
  name,
  created_by: null,
  created_at: '',
  updated_at: '',
})

const product = (overrides: Partial<Product> = {}): Product => ({
  id: 'p1',
  household_id: 'h1',
  name: 'Ser żółty gouda',
  kcal_per_unit: 356,
  unit_type: 'slice',
  unit_weight_grams: 20,
  package_size: 150,
  category: 'Nabiał',
  image_url: null,
  protein: 25,
  fat: 27.4,
  carbs: 0,
  notes: 'Kupować w plastrach',
  created_by: null,
  created_at: '',
  updated_at: '',
  ...overrides,
})

const form = (overrides: Partial<ProductFormValues> = {}): ProductFormValues => ({
  ...emptyProductForm('Warzywa'),
  name: 'Pomidor',
  kcal: '18',
  ...overrides,
})

describe('unit helpers', () => {
  it('returns the default unit weight in grams for each unit', () => {
    expect(defaultUnitWeight('100g')).toBe('1')
    expect(defaultUnitWeight('tablespoon')).toBe('15')
    expect(defaultUnitWeight('teaspoon')).toBe('5')
    expect(defaultUnitWeight('leaf')).toBe('2')
    expect(defaultUnitWeight('cube')).toBe('10')
    expect(defaultUnitWeight('slice')).toBe('30')
    expect(defaultUnitWeight('piece')).toBe('100')
  })

  it('returns a placeholder per unit', () => {
    expect(unitWeightPlaceholder('100g')).toBe('1 (dla gramów)')
    expect(unitWeightPlaceholder('piece')).toBe('np. 300 dla sztuki')
    expect(unitWeightPlaceholder('tablespoon')).toBe('15')
    expect(unitWeightPlaceholder('slice')).toBe('30')
  })

  it('labels package sizes and picks a package placeholder per unit', () => {
    expect(PACKAGE_UNIT_LABEL['100g']).toBe('g')
    expect(PACKAGE_UNIT_LABEL.piece).toBe('szt.')
    expect(PACKAGE_UNIT_LABEL.slice).toBe('plastrów')
    expect(packageSizePlaceholder('100g')).toBe('np. 180 (g w opakowaniu)')
    expect(packageSizePlaceholder('piece')).toBe('np. 10 (szt. w opakowaniu)')
    expect(packageSizePlaceholder('cube')).toBe('ile jednostek w opakowaniu')
  })

  it('labels units and passes unknown ones through', () => {
    expect(unitLabel('piece')).toBe('Sztuka')
    expect(unitLabel('cube')).toBe('Kostka')
    expect(unitLabel('szklanka')).toBe('szklanka')
  })
})

describe('getDefaultCategoryName', () => {
  it('prefers Pozostałe when it exists', () => {
    expect(getDefaultCategoryName([category('Nabiał'), category(DEFAULT_CATEGORY_NAME)])).toBe('Pozostałe')
  })

  it('falls back to the first category, then to empty string', () => {
    expect(getDefaultCategoryName([category('Pieczywo'), category('Mięso')])).toBe('Pieczywo')
    expect(getDefaultCategoryName([])).toBe('')
  })
})

describe('emptyProductForm', () => {
  it('starts with grams, unit weight 1 and the given category', () => {
    expect(emptyProductForm('Owoce')).toMatchObject({ name: '', kcal: '', unit: '100g', unitWeight: '1', packageSize: '', category: 'Owoce' })
    expect(emptyProductForm().category).toBe('')
  })
})

describe('isProductFormValid', () => {
  it('accepts a form with name, kcal, unit weight and category', () => {
    expect(isProductFormValid(form())).toBe(true)
  })

  it('rejects a missing or whitespace-only name', () => {
    expect(isProductFormValid(form({ name: '   ' }))).toBe(false)
  })

  it('rejects missing kcal, unit weight or category', () => {
    expect(isProductFormValid(form({ kcal: '' }))).toBe(false)
    expect(isProductFormValid(form({ unitWeight: '' }))).toBe(false)
    expect(isProductFormValid(form({ category: '' }))).toBe(false)
  })

  it('does not require macros or notes', () => {
    expect(isProductFormValid(form({ protein: '', fat: '', carbs: '', notes: '' }))).toBe(true)
  })
})

describe('toProductPayload', () => {
  it('parses numbers and trims name and notes', () => {
    const payload = toProductPayload(form({
      name: '  Jogurt naturalny ',
      kcal: '61.5',
      unit: 'tablespoon',
      unitWeight: '15',
      category: 'Nabiał',
      protein: '4.3',
      fat: '3',
      carbs: '4.7',
      notes: '  2% tłuszczu  ',
    }))
    expect(payload).toEqual({
      name: 'Jogurt naturalny',
      kcal_per_unit: 61.5,
      unit_type: 'tablespoon',
      unit_weight_grams: 15,
      package_size: null,
      category: 'Nabiał',
      protein: 4.3,
      fat: 3,
      carbs: 4.7,
      notes: '2% tłuszczu',
    })
  })

  it('turns empty macros and blank notes into null', () => {
    const payload = toProductPayload(form({ notes: '   ' }))
    expect(payload.protein).toBeNull()
    expect(payload.fat).toBeNull()
    expect(payload.carbs).toBeNull()
    expect(payload.notes).toBeNull()
  })

  it('keeps an explicit zero macro', () => {
    expect(toProductPayload(form({ carbs: '0' })).carbs).toBe(0)
  })

  it('sends package size as a number, or null when empty', () => {
    expect(toProductPayload(form({ packageSize: '180' })).package_size).toBe(180)
    expect(toProductPayload(form({ packageSize: '0.5' })).package_size).toBe(0.5)
    expect(toProductPayload(form()).package_size).toBeNull()
  })
})

describe('productToFormValues', () => {
  it('stringifies numeric fields', () => {
    expect(productToFormValues(product())).toEqual({
      name: 'Ser żółty gouda',
      kcal: '356',
      unit: 'slice',
      unitWeight: '20',
      packageSize: '150',
      category: 'Nabiał',
      protein: '25',
      fat: '27.4',
      carbs: '0',
      notes: 'Kupować w plastrach',
    })
  })

  it('maps null macros and notes to empty strings', () => {
    const values = productToFormValues(product({ protein: null, fat: null, carbs: null, notes: null }))
    expect([values.protein, values.fat, values.carbs, values.notes]).toEqual(['', '', '', ''])
  })

  it('maps a missing package size to an empty string', () => {
    expect(productToFormValues(product({ package_size: null })).packageSize).toBe('')
  })

  it('falls back to the default unit weight when the product has none', () => {
    expect(productToFormValues(product({ unit_type: 'tablespoon', unit_weight_grams: null })).unitWeight).toBe('15')
  })

  it('round-trips through toProductPayload', () => {
    const p = product()
    expect(toProductPayload(productToFormValues(p))).toMatchObject({
      name: p.name,
      kcal_per_unit: p.kcal_per_unit,
      unit_weight_grams: p.unit_weight_grams,
      package_size: p.package_size,
      protein: p.protein,
      fat: p.fat,
      carbs: p.carbs,
      notes: p.notes,
    })
  })
})
