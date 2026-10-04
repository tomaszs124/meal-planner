import type { SupabaseClient } from '@supabase/supabase-js'
import type { Meal, MealImage, Product, Tag } from '@/lib/supabase/client'
import { sumNutrition } from '@/lib/nutrition'

/**
 * Batched loading of meals with their ingredients, per-user overrides, tags and
 * images. Replaces the per-meal N+1 pattern (4 queries per meal) with 5 queries
 * per household regardless of how many meals exist.
 */

export type MealItemWithProduct = {
  id: string
  meal_id: string
  product_id: string
  amount: number
  unit_type: string
  /** Present on override rows only */
  user_id?: string
  product?: Product
}

export type MealWithDetails = Meal & {
  /** Effective ingredients for the requested user: their override if any, else the base recipe. */
  items: MealItemWithProduct[]
  /** Base recipe (meal_items) regardless of overrides. */
  baseItems: MealItemWithProduct[]
  tags: Tag[]
  images: MealImage[]
  /** true when `items` comes from the user's meal_item_overrides */
  isUserVariant: boolean
  totalKcal: number
  totalProtein: number
  totalFat: number
  totalCarbs: number
}

export type MealTagRow = { meal_id: string; tag_id: string; tags: Tag | null }

/** Pure assembly step, exported for tests. */
export function assembleMeals(
  meals: Meal[],
  baseItems: MealItemWithProduct[],
  userOverrides: MealItemWithProduct[],
  images: MealImage[],
  tagRows: MealTagRow[]
): MealWithDetails[] {
  const itemsByMeal = groupBy(baseItems, (i) => i.meal_id)
  const overridesByMeal = groupBy(userOverrides, (i) => i.meal_id)
  const imagesByMeal = groupBy(images, (i) => i.meal_id)
  const tagsByMeal = groupBy(tagRows, (t) => t.meal_id)

  return meals.map((meal) => {
    const base = itemsByMeal.get(meal.id) || []
    const overrides = overridesByMeal.get(meal.id) || []
    const isUserVariant = overrides.length > 0
    const items = isUserVariant ? overrides : base
    const totals = sumNutrition(items)

    return {
      ...meal,
      items,
      baseItems: base,
      tags: (tagsByMeal.get(meal.id) || []).map((t) => t.tags).filter((t): t is Tag => Boolean(t)),
      images: imagesByMeal.get(meal.id) || [],
      isUserVariant,
      totalKcal: totals.kcal,
      totalProtein: totals.protein,
      totalFat: totals.fat,
      totalCarbs: totals.carbs,
    }
  })
}

export type FetchMealsOptions = {
  householdId: string
  /** User whose overrides should be applied. Omit to get base recipes only. */
  userId?: string | null
  /** 'created_desc' (default) or 'name' */
  order?: 'created_desc' | 'name'
}

export async function fetchMealsWithDetails(
  supabase: SupabaseClient,
  { householdId, userId, order = 'created_desc' }: FetchMealsOptions
): Promise<MealWithDetails[]> {
  let mealsQuery = supabase.from('meals').select('*').eq('household_id', householdId)
  mealsQuery = order === 'name' ? mealsQuery.order('name') : mealsQuery.order('created_at', { ascending: false })

  const { data: mealsData, error } = await mealsQuery
  if (error) throw error
  const meals = (mealsData || []) as Meal[]
  if (meals.length === 0) return []

  const mealIds = meals.map((m) => m.id)

  const [baseItems, overrides, images, tagRows] = await Promise.all([
    inChunks(mealIds, (ids) =>
      supabase.from('meal_items').select('*, product:products(*)').in('meal_id', ids)
    ),
    userId
      ? inChunks(mealIds, (ids) =>
          supabase.from('meal_item_overrides').select('*, product:products(*)').in('meal_id', ids).eq('user_id', userId)
        )
      : Promise.resolve([]),
    // Images and tags are decoration: if their query fails (e.g. a policy change)
    // still show the meals, just without them, instead of an empty list.
    inChunks(mealIds, (ids) =>
      supabase.from('meal_images').select('*').in('meal_id', ids).order('uploaded_at', { ascending: false })
    ).catch((err: unknown) => {
      console.error('meal_images query failed, continuing without images', err)
      return [] as unknown[]
    }),
    inChunks(mealIds, (ids) => supabase.from('meal_tags').select('meal_id, tag_id, tags(*)').in('meal_id', ids)).catch(
      (err: unknown) => {
        console.error('meal_tags query failed, continuing without tags', err)
        return [] as unknown[]
      }
    ),
  ])

  return assembleMeals(
    meals,
    baseItems as unknown as MealItemWithProduct[],
    overrides as unknown as MealItemWithProduct[],
    images as unknown as MealImage[],
    tagRows as unknown as MealTagRow[]
  )
}

/** Runs an `.in()` query in chunks so very large households do not exceed URL length limits. */
export async function inChunks<T>(
  ids: string[],
  query: (chunk: string[]) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
  size = 150
): Promise<T[]> {
  const out: T[] = []
  for (let i = 0; i < ids.length; i += size) {
    const { data, error } = await query(ids.slice(i, i + size))
    if (error) throw error
    if (data) out.push(...data)
  }
  return out
}

function groupBy<T>(rows: T[], key: (row: T) => string): Map<string, T[]> {
  const map = new Map<string, T[]>()
  for (const row of rows) {
    const k = key(row)
    const list = map.get(k)
    if (list) list.push(row)
    else map.set(k, [row])
  }
  return map
}
