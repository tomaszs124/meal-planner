import { addDays, format, startOfWeek } from 'date-fns'
import type { MealCategory, UserSettings } from '@/lib/supabase/client'

/** Minimal meal_plan shape needed to copy a day (one meal per slot). */
export type MealPlanRow = {
  meal_id: string
  meal_type: MealCategory
}

/** meal_plan row as returned by the week range query. */
export type WeekPlanRow = {
  date: string
  meal_id: string
  is_consumed: boolean
}

export type DayProgress = {
  dateString: string
  consumedKcal: number
  plannedKcal: number
}

/** Meal shape needed for random selection. */
export type CategorizedMeal = {
  primary_category: MealCategory | null
  alternative_categories?: MealCategory[] | null
}

/**
 * Keeps one row per meal_type. When several rows share a meal_type the LAST one
 * in input order wins, while the output order follows the first occurrence of
 * each meal_type (Map insertion order).
 */
export function getUniquePlansByMealType<T extends MealPlanRow>(plans: T[]): T[] {
  const latestByType = new Map<MealCategory, T>()
  plans.forEach((plan) => {
    latestByType.set(plan.meal_type, plan)
  })
  return Array.from(latestByType.values())
}

/** The 7 dates (yyyy-MM-dd) of the Monday-based week containing `date`. */
export function getWeekDays(date: Date): string[] {
  const weekStart = startOfWeek(date, { weekStartsOn: 1 })
  return Array.from({ length: 7 }, (_, i) => format(addDays(weekStart, i), 'yyyy-MM-dd'))
}

/**
 * Turns the single week range query result into one entry per day.
 * Planned kcal counts every row of the day, consumed kcal only `is_consumed` rows.
 * Unknown meal ids count as 0 kcal.
 */
export function buildWeekProgress(
  rows: WeekPlanRow[] | null | undefined,
  mealKcalById: Map<string, number>,
  weekDays: string[]
): DayProgress[] {
  const plansByDate = new Map<string, WeekPlanRow[]>()
  for (const plan of rows || []) {
    const list = plansByDate.get(plan.date)
    if (list) list.push(plan)
    else plansByDate.set(plan.date, [plan])
  }

  return weekDays.map((dateStr) => {
    const plans = plansByDate.get(dateStr) || []

    const plannedKcal = plans.reduce((sum, plan) => sum + (mealKcalById.get(plan.meal_id) || 0), 0)

    const consumedKcal = plans
      .filter((plan) => plan.is_consumed)
      .reduce((sum, plan) => sum + (mealKcalById.get(plan.meal_id) || 0), 0)

    return { dateString: dateStr, consumedKcal, plannedKcal }
  })
}

/** djb2-style hash of `${dateSeed}-${category}`, reduced to an index in [0, length). */
function seededIndex(seed: string, length: number): number {
  let hash = 5381
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 33) ^ seed.charCodeAt(i)
  }
  return Math.abs(hash) % length
}

/**
 * Deterministic "random" meal for a slot: the same date + category always yields
 * the same meal. Prefers meals whose primary category matches, then meals listing
 * the category as an alternative, then any meal. Returns null for an empty list.
 */
export function pickRandomMeal<T extends CategorizedMeal & { id: string }>(
  mealsInput: T[],
  category: MealCategory,
  dateSeed: string
): T | null {
  // Index by a stable order (id) so the pick for a given day does not depend on
  // fetch ordering or change every time a meal is added at the top of the list.
  const meals = [...mealsInput].sort((a, b) => a.id.localeCompare(b.id))
  const primaryMeals = meals.filter((m) => m.primary_category === category)
  const alternativeMeals = meals.filter(
    (m) => m.primary_category !== category && m.alternative_categories?.includes(category)
  )

  const hashSeed = `${dateSeed}-${category}`

  if (primaryMeals.length > 0) {
    return primaryMeals[seededIndex(hashSeed, primaryMeals.length)]
  }
  if (alternativeMeals.length > 0) {
    return alternativeMeals[seededIndex(hashSeed, alternativeMeals.length)]
  }
  if (meals.length > 0) {
    return meals[seededIndex(hashSeed, meals.length)]
  }
  return null
}

/**
 * Visible meal slots for the given settings. Breakfast is always on;
 * second_breakfast/lunch/dinner must be present and not `false` (missing fields from
 * pre-migration rows count as off), snack requires `snack_enabled === true`.
 */
export function getEnabledCategories(userSettings: Partial<UserSettings> | null | undefined): MealCategory[] {
  const cats: MealCategory[] = ['breakfast']

  const settings = (userSettings || {}) as Partial<UserSettings>
  const secondBreakfastEnabled = settings.second_breakfast_enabled !== false && settings.second_breakfast_enabled !== undefined
  const lunchEnabled = settings.lunch_enabled !== false && settings.lunch_enabled !== undefined
  const dinnerEnabled = settings.dinner_enabled !== false && settings.dinner_enabled !== undefined
  const snackEnabled = settings.snack_enabled === true

  if (secondBreakfastEnabled) cats.push('second_breakfast')
  if (lunchEnabled) cats.push('lunch')
  if (dinnerEnabled) cats.push('dinner')
  if (snackEnabled) cats.push('snack')

  return cats
}

/** New meal_plan insert rows copying `plans` to `userId` on `date` (status reset). */
export function toCopiedPlanRows(
  plans: MealPlanRow[],
  target: { userId: string; householdId: string; date: string }
) {
  return plans.map((plan) => ({
    user_id: target.userId,
    household_id: target.householdId,
    date: target.date,
    meal_id: plan.meal_id,
    meal_type: plan.meal_type,
    is_consumed: false,
    is_skipped: false,
  }))
}

/** Rows whose meal_type is not yet taken by `existing`. */
export function filterMissingMealTypes<T extends { meal_type: MealCategory }>(
  rows: T[],
  existing: { meal_type: MealCategory }[]
): T[] {
  const existingMealTypes = existing.map((m) => m.meal_type)
  return rows.filter((plan) => !existingMealTypes.includes(plan.meal_type))
}
