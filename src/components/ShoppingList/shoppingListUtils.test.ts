import { describe, expect, it } from 'vitest'
import type { Product } from '@/lib/supabase/client'
import type { GroupedItem, HouseholdMember, ShoppingListItemWithProduct, ShoppingListMeal } from './types'
import {
  UNCATEGORIZED_LABEL,
  getGroupedItemAmountLabel,
  getMemberDisplayName,
  getSingleItemAmountLabel,
  groupByCategory,
  groupItems,
  groupItemsByMeal,
  translateUnit,
} from './shoppingListUtils'

const product = (overrides: Partial<Product> = {}): Product => ({
  id: 'p-jajka',
  household_id: 'h1',
  name: 'Jajka',
  kcal_per_unit: 143,
  unit_type: 'piece',
  unit_weight_grams: 60,
  category: 'Nabiał',
  image_url: null,
  protein: 12.6,
  fat: 9.9,
  carbs: 0.7,
  notes: null,
  created_by: null,
  created_at: '',
  updated_at: '',
  ...overrides,
})

const meal = (id: string, name: string): ShoppingListMeal => ({
  id,
  name,
  user_id: null,
  household_id: 'h1',
  is_shared: true,
  description: null,
  primary_category: 'breakfast',
  alternative_categories: [],
  created_at: '',
  updated_at: '',
})

let seq = 0
const item = (overrides: Partial<ShoppingListItemWithProduct> = {}): ShoppingListItemWithProduct => ({
  id: `i${++seq}`,
  household_id: 'h1',
  product_id: null,
  meal_id: null,
  source_user_id: null,
  name: 'Chleb',
  amount: 1,
  unit_type: null,
  custom_amount_text: null,
  is_checked: false,
  added_by: null,
  checked_by: null,
  checked_at: null,
  created_at: '',
  updated_at: '',
  ...overrides,
})

const grouped = (overrides: Partial<GroupedItem> = {}): GroupedItem => ({
  key: 'k',
  name: 'Jajka',
  product_id: 'p-jajka',
  product: product(),
  totalAmount: 3,
  unit_type: 'piece',
  custom_amount_text: null,
  itemIds: ['i1'],
  allChecked: false,
  anyChecked: false,
  ...overrides,
})

describe('translateUnit / UNCATEGORIZED_LABEL', () => {
  it('translates known units and passes unknown ones through', () => {
    expect(translateUnit('100g')).toBe('g')
    expect(translateUnit('piece')).toBe('szt')
    expect(translateUnit('tablespoon')).toBe('łyżka')
    expect(translateUnit('slice')).toBe('plaster')
    expect(translateUnit('opakowanie')).toBe('opakowanie')
  })

  it('labels uncategorized products as Pozostałe', () => {
    expect(UNCATEGORIZED_LABEL).toBe('Pozostałe')
  })
})

describe('amount labels', () => {
  it('prefers custom_amount_text over everything else', () => {
    expect(getGroupedItemAmountLabel(grouped({ custom_amount_text: 'garść' }))).toBe('garść')
    expect(getSingleItemAmountLabel(item({ custom_amount_text: '2 opakowania', product: product() }))).toBe('2 opakowania')
  })

  it('shows grams only for products measured in grams', () => {
    const maka = product({ unit_type: '100g', unit_weight_grams: 1, name: 'Mąka' })
    expect(getGroupedItemAmountLabel(grouped({ product: maka, unit_type: '100g', totalAmount: 250 }))).toBe('250g')
    expect(getSingleItemAmountLabel(item({ product: maka, unit_type: '100g', amount: 500 }))).toBe('500g')
  })

  it('shows unit amount with total weight for piece-based products', () => {
    expect(getGroupedItemAmountLabel(grouped({ totalAmount: 1.5 }))).toBe('1.5 szt (90g)')
    expect(getSingleItemAmountLabel(item({ product: product(), unit_type: 'piece', amount: 2 }))).toBe('2 szt (120g)')
  })

  it('falls back to a bare number for custom items and null for zero', () => {
    expect(getGroupedItemAmountLabel(grouped({ product: undefined, totalAmount: 2.5 }))).toBe('2.5')
    expect(getGroupedItemAmountLabel(grouped({ product: undefined, totalAmount: 0 }))).toBeNull()
    expect(getSingleItemAmountLabel(item({ amount: 3 }))).toBe('3')
    expect(getSingleItemAmountLabel(item({ amount: 0 }))).toBeNull()
  })
})

describe('getMemberDisplayName', () => {
  const member = (settingsName: string | null, profileName: string | null): HouseholdMember => ({
    user_id: 'u1',
    settings: settingsName === null ? undefined : { id: 's', user_id: 'u1', name: settingsName, snack_enabled: true, created_at: '', updated_at: '' },
    profile: profileName === null ? undefined : { id: 'u1', display_name: profileName, avatar_url: null, created_at: '', updated_at: '' },
  })

  it('uses settings name, then profile name, then a generic label', () => {
    expect(getMemberDisplayName(member(' Kasia ', 'Katarzyna'))).toBe('Kasia')
    expect(getMemberDisplayName(member('   ', 'Tomek'))).toBe('Tomek')
    expect(getMemberDisplayName(member(null, null))).toBe('Użytkownik')
  })
})

describe('groupItems', () => {
  it('sums amounts of the same product and collects item ids', () => {
    const p = product()
    const result = groupItems([
      item({ id: 'a', product_id: p.id, product: p, name: 'Jajka', amount: 2 }),
      item({ id: 'b', product_id: p.id, product: p, name: 'Jajka', amount: 0.1 }),
      item({ id: 'c', product_id: p.id, product: p, name: 'Jajka', amount: 0.2 }),
    ])
    expect(result).toHaveLength(1)
    expect(result[0].totalAmount).toBe(2.3)
    expect(result[0].itemIds).toEqual(['a', 'b', 'c'])
  })

  it('groups custom items by name when there is no product', () => {
    const result = groupItems([item({ name: 'Ręczniki papierowe' }), item({ name: 'Ręczniki papierowe', amount: 2 })])
    expect(result).toHaveLength(1)
    expect(result[0].totalAmount).toBe(3)
    expect(result[0].key).toBe('name:Ręczniki papierowe:unchecked')
  })

  it('splits checked and unchecked parts, unchecked first', () => {
    const result = groupItems([
      item({ id: 'x', name: 'Mleko', is_checked: true }),
      item({ id: 'y', name: 'Mleko', is_checked: false }),
    ])
    expect(result.map((g) => [g.itemIds[0], g.allChecked])).toEqual([['y', false], ['x', true]])
  })

  it('sorts by Polish collation', () => {
    const names = groupItems([item({ name: 'Żurek' }), item({ name: 'Śmietana' }), item({ name: 'Sałata' })]).map((g) => g.name)
    expect(names).toEqual(['Sałata', 'Śmietana', 'Żurek'])
  })

  it('keeps the first custom_amount_text of a group', () => {
    const result = groupItems([item({ name: 'Natka', custom_amount_text: 'pęczek' }), item({ name: 'Natka' })])
    expect(result[0].custom_amount_text).toBe('pęczek')
  })
})

describe('groupItemsByMeal', () => {
  const names: Record<string, string> = { u1: 'Tomek', u2: 'Ania' }
  const resolve = (id: string | null | undefined) => (id ? names[id] : 'Użytkownik')

  it('separates custom items and groups meal items per meal and member', () => {
    const owsianka = meal('m1', 'Owsianka')
    const { mealGroups, customItems } = groupItemsByMeal([
      item({ name: 'Płatki owsiane', meal_id: 'm1', meal: owsianka, source_user_id: 'u1' }),
      item({ name: 'Banan', meal_id: 'm1', meal: owsianka, source_user_id: 'u1', is_checked: true }),
      item({ name: 'Banan', meal_id: 'm1', meal: owsianka, source_user_id: 'u2', is_checked: true }),
      item({ name: 'Papier do pieczenia' }),
      item({ name: 'Bez posiłku', meal_id: 'm9' }),
    ], resolve)

    expect(customItems.map((i) => i.name)).toEqual(['Papier do pieczenia', 'Bez posiłku'])
    expect(mealGroups.map((g) => g.group_key)).toEqual(['m1:u2', 'm1:u1'])
    expect(mealGroups[1].items.map((i) => i.name)).toEqual(['Banan', 'Płatki owsiane'])
    expect(mealGroups[1].allChecked).toBe(false)
    expect(mealGroups[0].allChecked).toBe(true)
  })

  it('sorts groups by meal name before member name', () => {
    const { mealGroups } = groupItemsByMeal([
      item({ meal_id: 'm2', meal: meal('m2', 'Żurek'), source_user_id: 'u2' }),
      item({ meal_id: 'm1', meal: meal('m1', 'Jajecznica'), source_user_id: null }),
    ], resolve)
    expect(mealGroups.map((g) => g.group_key)).toEqual(['m1:unknown', 'm2:u2'])
  })
})

describe('groupByCategory', () => {
  const warzywa = (overrides: Partial<Product> = {}) =>
    product({ id: 'p-marchew', name: 'Marchew', category: 'Warzywa', ...overrides })

  it('groups product items by category and aggregates them with groupItems', () => {
    const groups = groupByCategory([
      item({ name: 'Jajka', product_id: 'p-jajka', product: product(), amount: 2 }),
      item({ name: 'Marchew', product_id: 'p-marchew', product: warzywa(), amount: 1 }),
      item({ name: 'Jajka', product_id: 'p-jajka', product: product(), amount: 4 }),
    ])
    expect(groups.map((g) => [g.key, g.label, g.category])).toEqual([
      ['Nabiał', 'Nabiał', 'Nabiał'],
      ['Warzywa', 'Warzywa', 'Warzywa'],
    ])
    expect(groups[0].groupedItems).toHaveLength(1)
    expect(groups[0].groupedItems[0].totalAmount).toBe(6)
    expect(groups[0].groupedItems[0].itemIds).toHaveLength(2)
  })

  it('puts custom items (no product) in the uncategorized bucket', () => {
    const groups = groupByCategory([
      item({ name: 'Papier toaletowy' }),
      item({ name: 'Chleb' }),
    ])
    expect(groups).toHaveLength(1)
    expect(groups[0]).toMatchObject({ key: '__uncategorized__', label: UNCATEGORIZED_LABEL, category: null })
    expect(groups[0].groupedItems.map((g) => g.name)).toEqual(['Chleb', 'Papier toaletowy'])
  })

  it('orders categories with Polish collation and keeps the uncategorized bucket last', () => {
    const groups = groupByCategory([
      item({ name: 'Woda' }),
      item({ name: 'Marchew', product_id: 'p-marchew', product: warzywa() }),
      item({ name: 'Szynka', product_id: 'p-szynka', product: product({ id: 'p-szynka', category: 'Śniadaniowe' }) }),
      item({ name: 'Jajka', product_id: 'p-jajka', product: product() }),
      item({ name: 'Salami', product_id: 'p-salami', product: product({ id: 'p-salami', category: 'Sery' }) }),
    ])
    expect(groups.map((g) => g.label)).toEqual(['Nabiał', 'Sery', 'Śniadaniowe', 'Warzywa', UNCATEGORIZED_LABEL])
  })

  it('returns no groups for empty input', () => {
    expect(groupByCategory([])).toEqual([])
  })

  it('drops product items whose product has no category (current behaviour)', () => {
    const groups = groupByCategory([
      item({ name: 'Sól', product_id: 'p-sol', product: product({ id: 'p-sol', category: '' }) }),
      item({ name: 'Chleb' }),
    ])
    expect(groups.map((g) => g.key)).toEqual(['__uncategorized__'])
    expect(groups[0].groupedItems.map((g) => g.name)).toEqual(['Chleb'])
  })
})
