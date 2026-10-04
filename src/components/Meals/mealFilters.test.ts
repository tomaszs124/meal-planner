import { describe, expect, it } from 'vitest'
import type { MealCategory, Tag } from '@/lib/supabase/client'
import type { MealWithItems } from './types'
import { filterMeals } from './mealFilterUtils'

const tag = (id: string): Tag => ({
  id,
  household_id: 'h1',
  name: id,
  color: '#fff',
  text_color: '#000',
  created_at: '',
  updated_at: '',
})

const meal = (
  id: string,
  name: string,
  overrides: Partial<MealWithItems> = {}
): MealWithItems => ({
  id,
  name,
  user_id: null,
  household_id: 'h1',
  is_shared: true,
  description: null,
  primary_category: null,
  alternative_categories: [],
  created_at: '',
  updated_at: '',
  items: [],
  baseItems: [],
  tags: [],
  images: [],
  isUserVariant: false,
  totalKcal: 0,
  totalProtein: 0,
  totalFat: 0,
  totalCarbs: 0,
  ...overrides,
})

const owsianka = meal('m1', 'Owsianka', {
  description: 'Płatki z mlekiem i owocami',
  primary_category: 'breakfast',
  alternative_categories: ['second_breakfast'],
  tags: [tag('t-szybkie'), tag('t-wege')],
})
const schabowy = meal('m2', 'Schabowy z ziemniakami', {
  primary_category: 'lunch',
  alternative_categories: ['dinner'],
  tags: [tag('t-szybkie')],
})
const salatka = meal('m3', 'Sałatka grecka', {
  description: null,
  primary_category: 'dinner',
  tags: [tag('t-wege')],
})
const meals = [owsianka, schabowy, salatka]

const noFilters = { searchQuery: '', selectedTags: [] as string[], selectedCategories: [] as MealCategory[] }
const ids = (list: MealWithItems[]) => list.map((m) => m.id)

describe('filterMeals', () => {
  it('returns all meals (same order) when no filters are set', () => {
    expect(ids(filterMeals(meals, noFilters))).toEqual(['m1', 'm2', 'm3'])
    expect(ids(filterMeals(meals, { ...noFilters, searchQuery: '   ' }))).toEqual(['m1', 'm2', 'm3'])
  })

  it('matches the name with a trimmed, case-insensitive query', () => {
    expect(ids(filterMeals(meals, { ...noFilters, searchQuery: '  SCHAB ' }))).toEqual(['m2'])
  })

  it('matches the description and tolerates a null description', () => {
    expect(ids(filterMeals(meals, { ...noFilters, searchQuery: 'mlekiem' }))).toEqual(['m1'])
  })

  it('requires every selected tag (AND)', () => {
    expect(ids(filterMeals(meals, { ...noFilters, selectedTags: ['t-szybkie'] }))).toEqual(['m1', 'm2'])
    expect(ids(filterMeals(meals, { ...noFilters, selectedTags: ['t-szybkie', 't-wege'] }))).toEqual(['m1'])
  })

  it('matches a selected category against the primary category', () => {
    expect(ids(filterMeals(meals, { ...noFilters, selectedCategories: ['lunch'] }))).toEqual(['m2'])
  })

  it('matches alternative categories and ORs multiple selected categories', () => {
    expect(ids(filterMeals(meals, { ...noFilters, selectedCategories: ['dinner'] }))).toEqual(['m2', 'm3'])
    expect(ids(filterMeals(meals, { ...noFilters, selectedCategories: ['second_breakfast', 'lunch'] }))).toEqual(['m1', 'm2'])
  })

  it('combines search, tags and categories with AND', () => {
    expect(
      ids(filterMeals(meals, { searchQuery: 'a', selectedTags: ['t-wege'], selectedCategories: ['dinner'] }))
    ).toEqual(['m3'])
  })

  it('returns an empty list when nothing matches', () => {
    expect(filterMeals(meals, { ...noFilters, searchQuery: 'pizza' })).toEqual([])
    expect(filterMeals(meals, { ...noFilters, selectedTags: ['t-nieistniejacy'] })).toEqual([])
    expect(filterMeals([], noFilters)).toEqual([])
  })
})
