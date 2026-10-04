import type { Product } from '@/lib/supabase/client'

/**
 * Pure shopping-list helpers shared by the UI (ShoppingListEnhanced) and,
 * later, the MCP connector. Nothing here talks to Supabase.
 */

/** Minimal meal_plan row needed to build a shopping list. */
export type PlanRow = {
  meal_id: string
  user_id: string
}

/** A meal_items or meal_item_overrides row joined with its product. */
export type IngredientRow = {
  meal_id: string
  /** Present on meal_item_overrides rows only */
  user_id?: string | null
  product_id: string
  amount: number | string
  unit_type: string
  product?: Product | null
}

/** One shopping-list line: a product within a given (meal, user) group. */
export type AggregatedItem = {
  meal_id: string
  source_user_id: string
  product: Product
  totalAmount: number
  unit_type: string
}

export type CollectedIngredients = {
  items: AggregatedItem[]
  /** Keyed by getMealGroupKey(meal_id, source_user_id) */
  servingsByGroupKey: Record<string, number>
}

export function getMealGroupKey(mealId: string, sourceUserId: string | null | undefined): string {
  return `${mealId}:${sourceUserId || 'unknown'}`
}

/** Key used to look up overrides for a (meal, user) pair. */
export function getOverrideKey(mealId: string, userId: string): string {
  return `${mealId}:${userId}`
}

/** Indexes base items by meal_id and overrides by `${meal_id}:${user_id}`. */
export function indexIngredientRows(
  baseItems: IngredientRow[],
  overrides: IngredientRow[]
): {
  baseItemsByMeal: Map<string, IngredientRow[]>
  overridesByMealAndUser: Map<string, IngredientRow[]>
} {
  const baseItemsByMeal = new Map<string, IngredientRow[]>()
  for (const row of baseItems) pushTo(baseItemsByMeal, row.meal_id, row)

  const overridesByMealAndUser = new Map<string, IngredientRow[]>()
  for (const row of overrides) {
    if (!row.user_id) continue
    pushTo(overridesByMealAndUser, getOverrideKey(row.meal_id, row.user_id), row)
  }

  return { baseItemsByMeal, overridesByMealAndUser }
}

/**
 * For every plan row picks the user's overrides for that meal (if they have
 * any rows at all) or the base recipe, skips items without a product, and sums
 * amounts per (meal, user, product). A plan row counts as one serving of its
 * group when it contributed at least one item.
 */
export function collectPlanIngredients(
  planRows: PlanRow[],
  baseItemsByMeal: Map<string, IngredientRow[]>,
  overridesByMealAndUser: Map<string, IngredientRow[]>
): CollectedIngredients {
  const servingsByGroupKey: Record<string, number> = {}
  const byKey = new Map<string, AggregatedItem>()

  for (const plan of planRows) {
    const overrides = overridesByMealAndUser.get(getOverrideKey(plan.meal_id, plan.user_id)) || []
    const source = overrides.length > 0 ? overrides : baseItemsByMeal.get(plan.meal_id) || []

    let added = 0
    for (const item of source) {
      const product = item.product
      if (!product) continue
      added += 1

      const key = `${plan.meal_id}:${plan.user_id}:${product.id}`
      const amount = parseFloat(String(item.amount))
      const existing = byKey.get(key)
      if (existing) {
        existing.totalAmount = Math.round((existing.totalAmount + amount) * 10000) / 10000
      } else {
        byKey.set(key, {
          meal_id: plan.meal_id,
          source_user_id: plan.user_id,
          product,
          totalAmount: amount,
          unit_type: item.unit_type,
        })
      }
    }

    if (added > 0) {
      const groupKey = getMealGroupKey(plan.meal_id, plan.user_id)
      servingsByGroupKey[groupKey] = (servingsByGroupKey[groupKey] || 0) + 1
    }
  }

  return { items: Array.from(byKey.values()), servingsByGroupKey }
}

/** Maps aggregated items to shopping_list_items insert rows (amount rounded to 2 decimals). */
export function toShoppingListInsertRows(items: AggregatedItem[], householdId: string, addedBy: string | null) {
  return items.map(({ meal_id, source_user_id, product, totalAmount, unit_type }) => ({
    household_id: householdId,
    meal_id,
    source_user_id,
    product_id: product.id,
    name: product.name,
    amount: Math.round(totalAmount * 100) / 100,
    unit_type,
    custom_amount_text: null,
    is_checked: false,
    added_by: addedBy,
  }))
}

/** Scales amounts for a servings change: rounded to 2 decimals, never below 0.01. */
export function scaleAmounts<T extends { id: string; amount: number | string }>(
  items: T[],
  scale: number
): { id: string; amount: number }[] {
  return items.map((item) => ({
    id: item.id,
    amount: Math.max(0.01, Math.round(parseFloat(String(item.amount)) * scale * 100) / 100),
  }))
}

function pushTo<T>(map: Map<string, T[]>, key: string, row: T) {
  const list = map.get(key)
  if (list) list.push(row)
  else map.set(key, [row])
}
