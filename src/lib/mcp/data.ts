import type { Meal, MealCategory, MealItem, MealItemOverride, Product, Tag } from '@/lib/supabase/client'
import type { McpContext } from './context'
import { memberLabel } from './context'
import { checkPackageUsage, describeItem, sumItems, type DescribedItem, type NutritionTotals, type PackageCheck } from './nutrition'

export const MEAL_CATEGORIES: MealCategory[] = ['breakfast', 'second_breakfast', 'lunch', 'dinner', 'snack']

export const MEAL_CATEGORY_LABELS_PL: Record<MealCategory, string> = {
  breakfast: 'śniadanie',
  second_breakfast: 'drugie śniadanie',
  lunch: 'obiad',
  dinner: 'kolacja',
  snack: 'przekąska',
}

export type ProductMap = Map<string, Product>

export async function loadProducts(ctx: McpContext): Promise<ProductMap> {
  const { data, error } = await ctx.db
    .from('products')
    .select('*')
    .eq('household_id', ctx.householdId)
    .order('name')
  if (error) throw new Error(`products: ${error.message}`)
  return new Map(((data || []) as Product[]).map((p) => [p.id, p]))
}

export async function loadTags(ctx: McpContext): Promise<Tag[]> {
  const { data, error } = await ctx.db.from('tags').select('*').eq('household_id', ctx.householdId).order('name')
  if (error) throw new Error(`tags: ${error.message}`)
  return (data || []) as Tag[]
}

export type MemberVariant = {
  user_id: string
  user_name: string
  /** true when this member has their own ingredient list (meal_item_overrides) */
  is_override: boolean
  items: DescribedItem[]
  totals: NutritionTotals
}

export type MealDetailed = {
  id: string
  name: string
  description: string | null
  primary_category: MealCategory | null
  primary_category_label: string | null
  alternative_categories: MealCategory[]
  tags: { id: string; name: string }[]
  created_at: string
  /** Default recipe (meal_items). Used by every member without an override. */
  base_items: DescribedItem[]
  base_totals: NutritionTotals
  /** Effective recipe for each household member (override or base). */
  variants: MemberVariant[]
  /** Combined shopping amount per product across all members, with package check. */
  household_totals: PackageCheck[]
}

export type MealSummary = {
  id: string
  name: string
  primary_category: MealCategory | null
  alternative_categories: MealCategory[]
  tags: string[]
  kcal_by_member: Record<string, number>
  has_member_variants: boolean
}

type MealTagRow = { meal_id: string; tag_id: string }

function describeAll(rows: { product_id: string; amount: number }[], products: ProductMap): DescribedItem[] {
  const out: DescribedItem[] = []
  for (const r of rows) {
    const p = products.get(r.product_id)
    if (!p) continue
    out.push(describeItem(Number(r.amount), p))
  }
  return out
}

export function buildMealDetailed(
  ctx: McpContext,
  meal: Meal,
  items: MealItem[],
  overrides: MealItemOverride[],
  tagRows: MealTagRow[],
  tags: Tag[],
  products: ProductMap
): MealDetailed {
  const baseItems = describeAll(items, products)
  const tagMap = new Map(tags.map((t) => [t.id, t]))

  const variants: MemberVariant[] = ctx.members.map((m) => {
    const own = overrides.filter((o) => o.user_id === m.user_id)
    const described = own.length > 0 ? describeAll(own, products) : baseItems
    return {
      user_id: m.user_id,
      user_name: memberLabel(ctx, m.user_id),
      is_override: own.length > 0,
      items: described,
      totals: sumItems(described),
    }
  })

  // Shopping total across members (what generate_shopping_list would buy for one day)
  const perProduct = new Map<string, number>()
  for (const v of variants) {
    for (const i of v.items) perProduct.set(i.product_id, (perProduct.get(i.product_id) || 0) + i.amount)
  }
  const householdTotals: PackageCheck[] = []
  for (const [pid, amount] of perProduct) {
    const p = products.get(pid)
    if (p) householdTotals.push(checkPackageUsage(amount, p))
  }

  return {
    id: meal.id,
    name: meal.name,
    description: meal.description,
    primary_category: meal.primary_category,
    primary_category_label: meal.primary_category ? MEAL_CATEGORY_LABELS_PL[meal.primary_category] : null,
    alternative_categories: meal.alternative_categories || [],
    tags: tagRows
      .filter((t) => t.meal_id === meal.id)
      .map((t) => tagMap.get(t.tag_id))
      .filter((t): t is Tag => !!t)
      .map((t) => ({ id: t.id, name: t.name })),
    created_at: meal.created_at,
    base_items: baseItems,
    base_totals: sumItems(baseItems),
    variants,
    household_totals: householdTotals,
  }
}

export function summarizeMeal(detail: MealDetailed): MealSummary {
  const kcal: Record<string, number> = {}
  for (const v of detail.variants) kcal[v.user_name] = v.totals.kcal
  return {
    id: detail.id,
    name: detail.name,
    primary_category: detail.primary_category,
    alternative_categories: detail.alternative_categories,
    tags: detail.tags.map((t) => t.name),
    kcal_by_member: kcal,
    has_member_variants: detail.variants.some((v) => v.is_override),
  }
}

/**
 * Loads meals of the household with items, overrides and tags in a handful of
 * queries (the UI does N+1, which is fine for a browser but not for a tool call).
 */
export async function loadMealsDetailed(ctx: McpContext, mealIds?: string[]): Promise<MealDetailed[]> {
  let mealsQuery = ctx.db.from('meals').select('*').eq('household_id', ctx.householdId).order('created_at', { ascending: false })
  if (mealIds && mealIds.length > 0) mealsQuery = mealsQuery.in('id', mealIds)
  const { data: mealsData, error: mealsError } = await mealsQuery
  if (mealsError) throw new Error(`meals: ${mealsError.message}`)
  const meals = (mealsData || []) as Meal[]
  if (meals.length === 0) return []

  const ids = meals.map((m) => m.id)
  const [products, tags, { data: itemsData }, { data: overridesData }, { data: tagRowsData }] = await Promise.all([
    loadProducts(ctx),
    loadTags(ctx),
    ctx.db.from('meal_items').select('*').in('meal_id', ids),
    ctx.db.from('meal_item_overrides').select('*').in('meal_id', ids),
    ctx.db.from('meal_tags').select('meal_id, tag_id').in('meal_id', ids),
  ])

  const items = (itemsData || []) as MealItem[]
  const overrides = (overridesData || []) as MealItemOverride[]
  const tagRows = (tagRowsData || []) as MealTagRow[]

  return meals.map((meal) =>
    buildMealDetailed(
      ctx,
      meal,
      items.filter((i) => i.meal_id === meal.id),
      overrides.filter((o) => o.meal_id === meal.id),
      tagRows,
      tags,
      products
    )
  )
}

export async function loadMealDetailed(ctx: McpContext, mealId: string): Promise<MealDetailed> {
  const [meal] = await loadMealsDetailed(ctx, [mealId])
  if (!meal) throw new Error(`Meal ${mealId} not found in this household`)
  return meal
}

/** Effective kcal of a meal for a given member (override if present, else base). */
export function kcalForMember(detail: MealDetailed, userId: string): number {
  return detail.variants.find((v) => v.user_id === userId)?.totals.kcal ?? detail.base_totals.kcal
}

/** Validates that every product id exists in the household; returns the products. */
export function requireProducts(products: ProductMap, ids: string[]): Product[] {
  const missing = ids.filter((id) => !products.has(id))
  if (missing.length > 0) {
    throw new Error(`Unknown product id(s): ${missing.join(', ')}. Use list_products to find valid ids.`)
  }
  return ids.map((id) => products.get(id)!)
}

export const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

export function assertDate(value: string, field = 'date'): string {
  if (!DATE_RE.test(value) || Number.isNaN(Date.parse(value))) {
    throw new Error(`${field} must be in YYYY-MM-DD format, got "${value}"`)
  }
  return value
}

export function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}

export function addDaysIso(date: string, days: number): string {
  const d = new Date(date + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

export function eachDay(start: string, end: string): string[] {
  const out: string[] = []
  let cur = start
  let guard = 0
  while (cur <= end && guard < 400) {
    out.push(cur)
    cur = addDaysIso(cur, 1)
    guard++
  }
  return out
}
