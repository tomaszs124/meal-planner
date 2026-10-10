import { describe, expect, it } from 'vitest'
import { DEFAULT_MEAL_SORT, isMealSort, sortMeals } from './meal-sort'

const meals = [
  { name: 'Żurek', created_at: '2026-01-03T00:00:00Z', pickCount: 2 },
  { name: 'Owsianka', created_at: '2026-01-01T00:00:00Z', pickCount: 9 },
  { name: 'ananas z jogurtem', created_at: '2026-01-02T00:00:00Z' },
  { name: 'Omlet', created_at: '2026-01-04T00:00:00Z', pickCount: 2 },
]

describe('sortMeals', () => {
  it('popular: most picked first, ties by newest, then title; missing counts as 0', () => {
    expect(sortMeals(meals, 'popular').map((m) => m.name)).toEqual(['Owsianka', 'Omlet', 'Żurek', 'ananas z jogurtem'])
  })

  it('newest: by created_at descending', () => {
    expect(sortMeals(meals, 'newest').map((m) => m.name)).toEqual(['Omlet', 'Żurek', 'ananas z jogurtem', 'Owsianka'])
  })

  it('title: Polish collation, case-insensitive', () => {
    expect(sortMeals(meals, 'title').map((m) => m.name)).toEqual(['ananas z jogurtem', 'Omlet', 'Owsianka', 'Żurek'])
  })

  it('does not mutate the input', () => {
    const copy = [...meals]
    sortMeals(meals, 'title')
    expect(meals).toEqual(copy)
  })
})

describe('isMealSort', () => {
  it('accepts the three sorts and rejects anything else', () => {
    expect(isMealSort('popular')).toBe(true)
    expect(isMealSort('title')).toBe(true)
    expect(isMealSort('kcal')).toBe(false)
    expect(isMealSort(null)).toBe(false)
    expect(isMealSort(DEFAULT_MEAL_SORT)).toBe(true)
  })
})
