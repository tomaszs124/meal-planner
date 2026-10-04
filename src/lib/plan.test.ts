import { describe, expect, it } from 'vitest'
import type { MealCategory, UserSettings } from '@/lib/supabase/client'
import {
  buildWeekProgress,
  filterMissingMealTypes,
  getEnabledCategories,
  getUniquePlansByMealType,
  getWeekDays,
  pickRandomMeal,
  toCopiedPlanRows,
} from './plan'

describe('getUniquePlansByMealType', () => {
  it('returns rows unchanged when meal types are unique', () => {
    const rows = [
      { id: 'a', meal_id: 'm1', meal_type: 'breakfast' as MealCategory },
      { id: 'b', meal_id: 'm2', meal_type: 'lunch' as MealCategory },
    ]
    expect(getUniquePlansByMealType(rows)).toEqual(rows)
  })

  it('keeps the last row per meal type, ordered by first occurrence', () => {
    const rows = [
      { id: 'a', meal_id: 'm1', meal_type: 'breakfast' as MealCategory },
      { id: 'b', meal_id: 'm2', meal_type: 'lunch' as MealCategory },
      { id: 'c', meal_id: 'm3', meal_type: 'breakfast' as MealCategory },
    ]
    expect(getUniquePlansByMealType(rows).map((r) => r.id)).toEqual(['c', 'b'])
  })

  it('handles an empty list', () => {
    expect(getUniquePlansByMealType([])).toEqual([])
  })
})

describe('getWeekDays', () => {
  it('returns Monday..Sunday of the week containing the date', () => {
    // 2026-10-04 is a Sunday
    expect(getWeekDays(new Date(2026, 9, 4))).toEqual([
      '2026-09-28',
      '2026-09-29',
      '2026-09-30',
      '2026-10-01',
      '2026-10-02',
      '2026-10-03',
      '2026-10-04',
    ])
  })
})

describe('buildWeekProgress', () => {
  const weekDays = ['2026-09-28', '2026-09-29', '2026-09-30', '2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04']
  const kcal = new Map([
    ['m1', 300],
    ['m2', 500],
  ])

  it('returns 7 zeroed entries for no rows', () => {
    const result = buildWeekProgress(null, kcal, weekDays)
    expect(result).toHaveLength(7)
    expect(result.every((d) => d.plannedKcal === 0 && d.consumedKcal === 0)).toBe(true)
    expect(result.map((d) => d.dateString)).toEqual(weekDays)
  })

  it('counts every row as planned and only consumed rows as consumed', () => {
    const result = buildWeekProgress(
      [
        { date: '2026-09-29', meal_id: 'm1', is_consumed: true },
        { date: '2026-09-29', meal_id: 'm2', is_consumed: false },
        { date: '2026-10-04', meal_id: 'm2', is_consumed: true },
      ],
      kcal,
      weekDays
    )
    expect(result[1]).toEqual({ dateString: '2026-09-29', plannedKcal: 800, consumedKcal: 300 })
    expect(result[6]).toEqual({ dateString: '2026-10-04', plannedKcal: 500, consumedKcal: 500 })
    expect(result[0]).toEqual({ dateString: '2026-09-28', plannedKcal: 0, consumedKcal: 0 })
  })

  it('treats unknown meals as 0 kcal and ignores dates outside the week', () => {
    const result = buildWeekProgress(
      [
        { date: '2026-09-28', meal_id: 'unknown', is_consumed: true },
        { date: '2026-10-05', meal_id: 'm1', is_consumed: true },
      ],
      kcal,
      weekDays
    )
    expect(result[0]).toEqual({ dateString: '2026-09-28', plannedKcal: 0, consumedKcal: 0 })
    expect(result.reduce((s, d) => s + d.plannedKcal, 0)).toBe(0)
  })
})

describe('pickRandomMeal', () => {
  const meal = (id: string, primary: MealCategory | null, alternatives: MealCategory[] = []) => ({
    id,
    primary_category: primary,
    alternative_categories: alternatives,
  })

  it('returns null for an empty list', () => {
    expect(pickRandomMeal([], 'lunch', '2026-10-04')).toBeNull()
  })

  it('prefers meals with a matching primary category', () => {
    const meals = [meal('a', 'dinner', ['lunch']), meal('b', 'lunch'), meal('c', 'lunch')]
    const picked = pickRandomMeal(meals, 'lunch', '2026-10-04')
    expect(['b', 'c']).toContain(picked?.id)
  })

  it('falls back to alternative categories, then to any meal', () => {
    const withAlt = [meal('a', 'dinner'), meal('b', 'breakfast', ['lunch'])]
    expect(pickRandomMeal(withAlt, 'lunch', '2026-10-04')?.id).toBe('b')

    const noMatch = [meal('a', 'dinner')]
    expect(pickRandomMeal(noMatch, 'lunch', '2026-10-04')?.id).toBe('a')
  })

  it('is deterministic for the same date and category', () => {
    const meals = Array.from({ length: 10 }, (_, i) => meal(`m${i}`, 'snack'))
    const first = pickRandomMeal(meals, 'snack', '2026-10-04')
    expect(pickRandomMeal(meals, 'snack', '2026-10-04')).toBe(first)
  })

  it('matches the original djb2-style hash index', () => {
    const meals = Array.from({ length: 7 }, (_, i) => meal(`m${i}`, 'breakfast'))
    const seed = '2026-10-04-breakfast'
    let hash = 5381
    for (let i = 0; i < seed.length; i += 1) hash = (hash * 33) ^ seed.charCodeAt(i)
    expect(pickRandomMeal(meals, 'breakfast', '2026-10-04')).toBe(meals[Math.abs(hash) % 7])
  })

  it('tolerates missing alternative_categories', () => {
    const meals = [{ id: 'x', primary_category: null, alternative_categories: null }]
    expect(pickRandomMeal(meals, 'lunch', '2026-10-04')?.id).toBe('x')
  })
})

describe('getEnabledCategories', () => {
  it('returns only breakfast without settings', () => {
    expect(getEnabledCategories(null)).toEqual(['breakfast'])
  })

  it('maps flags to slots in fixed order', () => {
    const settings: Partial<UserSettings> = {
      second_breakfast_enabled: true,
      lunch_enabled: true,
      dinner_enabled: true,
      snack_enabled: true,
    }
    expect(getEnabledCategories(settings)).toEqual(['breakfast', 'second_breakfast', 'lunch', 'dinner', 'snack'])
  })

  it('omits disabled and missing flags', () => {
    expect(
      getEnabledCategories({ second_breakfast_enabled: false, lunch_enabled: true, snack_enabled: false })
    ).toEqual(['breakfast', 'lunch'])
  })
})

describe('toCopiedPlanRows / filterMissingMealTypes', () => {
  it('builds insert rows with reset status for the target user and date', () => {
    expect(
      toCopiedPlanRows([{ meal_id: 'm1', meal_type: 'lunch' }], { userId: 'u2', householdId: 'h1', date: '2026-10-04' })
    ).toEqual([
      {
        user_id: 'u2',
        household_id: 'h1',
        date: '2026-10-04',
        meal_id: 'm1',
        meal_type: 'lunch',
        is_consumed: false,
        is_skipped: false,
      },
    ])
  })

  it('keeps only meal types not already planned', () => {
    const rows = [
      { meal_id: 'm1', meal_type: 'breakfast' as MealCategory },
      { meal_id: 'm2', meal_type: 'lunch' as MealCategory },
    ]
    expect(filterMissingMealTypes(rows, [{ meal_type: 'breakfast' }])).toEqual([rows[1]])
    expect(filterMissingMealTypes(rows, [])).toEqual(rows)
  })
})
