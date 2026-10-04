import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import type { Meal, MealCategory, MealItem, MealItemOverride, Tag } from '@/lib/supabase/client'
import { loadContext, resolveMembers, type McpContext } from '../context'
import {
  buildMealDetailed,
  loadMealDetailed,
  loadMealsDetailed,
  loadProducts,
  loadTags,
  MEAL_CATEGORIES,
  requireProducts,
  summarizeMeal,
  type MealDetailed,
  type ProductMap,
} from '../data'
import { DESTRUCTIVE, fail, ok, READ_ONLY, run, WRITE } from '../respond'

const CATEGORY_ENUM = z.enum(MEAL_CATEGORIES as [MealCategory, ...MealCategory[]])

const CATEGORY_DESCRIPTION =
  'Meal slot: "breakfast" (śniadanie), "second_breakfast" (drugie śniadanie), "lunch" (obiad), "dinner" (kolacja), "snack" (przekąska).'

const itemSchema = z.object({
  product_id: z.string().describe('Product id (from list_products).'),
  amount: z
    .number()
    .positive()
    .describe('Amount in the product unit: grams for unit_type "100g", otherwise number of pieces/slices/spoons etc.'),
})

const itemsSchema = z
  .array(itemSchema)
  .min(1)
  .describe('Ingredients of the default recipe (składniki), used by every member without their own variant.')

const memberVariantsSchema = z
  .array(
    z.object({
      user: z.string().describe('member reference: name, email, user_id, or "me"'),
      items: z
        .array(itemSchema)
        .min(1)
        .describe("This member's complete ingredient list (replaces the default recipe for them, not a diff)."),
    })
  )
  .describe(
    'Optional per-member variants (warianty dla domowników): a member listed here eats their own full ingredient list instead of the default items.'
  )

type ItemInput = z.infer<typeof itemSchema>
type VariantInput = { user: string; items: ItemInput[] }
type OverrideInput = { user_id: string; user_name: string; items: ItemInput[] }

const ALL_REFS = new Set(['all', 'everyone', 'wszyscy', 'household'])

/** Resolves each variant to exactly one household member. */
function resolveVariants(ctx: McpContext, variants?: VariantInput[]): OverrideInput[] {
  if (!variants) return []
  const seen = new Set<string>()
  return variants.map((v) => {
    if (ALL_REFS.has(v.user.trim().toLowerCase())) {
      throw new Error(`member_variants: "${v.user}" refers to several members; give one member per variant.`)
    }
    const members = resolveMembers(ctx, [v.user])
    if (members.length !== 1) {
      throw new Error(`member_variants: "${v.user}" must resolve to exactly one household member.`)
    }
    const m = members[0]
    if (seen.has(m.user_id)) {
      throw new Error(`member_variants: member "${m.name || m.user_id}" is listed more than once.`)
    }
    seen.add(m.user_id)
    return { user_id: m.user_id, user_name: m.name || m.email || m.user_id, items: v.items }
  })
}

function allProductIds(items: ItemInput[] | undefined, overrides: OverrideInput[]): string[] {
  const ids = new Set<string>()
  for (const i of items || []) ids.add(i.product_id)
  for (const o of overrides) for (const i of o.items) ids.add(i.product_id)
  return Array.from(ids)
}

function unitTypeOf(products: ProductMap, productId: string): string {
  return products.get(productId)?.unit_type || '100g'
}

/** Resolves tag names (case-insensitive) to tag ids or throws listing available tags. */
async function resolveTagIds(ctx: McpContext, names: string[]): Promise<string[]> {
  if (names.length === 0) return []
  const tags = await loadTags(ctx)
  const ids: string[] = []
  const missing: string[] = []
  for (const raw of names) {
    const t = tags.find((x) => x.name.toLowerCase() === raw.trim().toLowerCase())
    if (t) {
      if (!ids.includes(t.id)) ids.push(t.id)
    } else missing.push(raw)
  }
  if (missing.length > 0) {
    const available = tags.map((t: Tag) => t.name).join(', ') || '(none)'
    throw new Error(`Unknown tag(s): ${missing.join(', ')}. Available tags: ${available}`)
  }
  return ids
}

async function findMealByName(ctx: McpContext, name: string, excludeId?: string): Promise<{ id: string; name: string } | null> {
  const { data, error } = await ctx.db.from('meals').select('id, name').eq('household_id', ctx.householdId)
  if (error) throw new Error(`meals: ${error.message}`)
  const needle = name.trim().toLowerCase()
  return ((data || []) as { id: string; name: string }[]).find((m) => m.name.toLowerCase() === needle && m.id !== excludeId) || null
}

async function requireOwnMeal(ctx: McpContext, id: string): Promise<Meal> {
  const { data, error } = await ctx.db.from('meals').select('*').eq('id', id).eq('household_id', ctx.householdId).maybeSingle()
  if (error) throw new Error(`meals: ${error.message}`)
  if (!data) throw new Error(`Meal ${id} not found in this household. Use list_meals to find valid ids.`)
  return data as Meal
}

function fmt(n: number): string {
  return String(Math.round(n * 100) / 100)
}

/** Human-readable package warnings for the household shopping totals. */
export function packageWarnings(detail: MealDetailed): string[] {
  const out: string[] = []
  for (const t of detail.household_totals) {
    if (t.status === 'off') {
      out.push(
        `${t.product_name}: ${fmt(t.packages_used ?? 0)} opakowania, najbliższa czysta ilość: ${fmt(t.nearest_clean_amount ?? 0)} ${t.unit_label}`
      )
    } else if (t.status === 'unknown_package') {
      out.push(`${t.product_name}: brak package_size w produkcie`)
    }
  }
  return out
}

async function insertItems(ctx: McpContext, mealId: string, items: ItemInput[], products: ProductMap) {
  if (items.length === 0) return
  const { error } = await ctx.db.from('meal_items').insert(
    items.map((i) => ({
      meal_id: mealId,
      product_id: i.product_id,
      amount: i.amount,
      unit_type: unitTypeOf(products, i.product_id),
    }))
  )
  if (error) throw new Error(`meal_items insert failed: ${error.message}`)
}

async function insertOverrides(ctx: McpContext, mealId: string, overrides: OverrideInput[], products: ProductMap) {
  const rows = overrides.flatMap((o) =>
    o.items.map((i) => ({
      meal_id: mealId,
      user_id: o.user_id,
      product_id: i.product_id,
      amount: i.amount,
      unit_type: unitTypeOf(products, i.product_id),
    }))
  )
  if (rows.length === 0) return
  const { error } = await ctx.db.from('meal_item_overrides').insert(rows)
  if (error) throw new Error(`meal_item_overrides insert failed: ${error.message}`)
}

async function insertTags(ctx: McpContext, mealId: string, tagIds: string[]) {
  if (tagIds.length === 0) return
  const { error } = await ctx.db.from('meal_tags').insert(tagIds.map((tag_id) => ({ meal_id: mealId, tag_id })))
  if (error) throw new Error(`meal_tags insert failed: ${error.message}`)
}

export function registerMealTools(server: McpServer) {
  server.registerTool(
    'list_meals',
    {
      title: 'List meals',
      description:
        'Lists saved meals/recipes (posiłki) of the household with categories, tags, kcal per member and whether members have their own variants. Use get_meal for ingredients.',
      inputSchema: {
        search: z.string().optional().describe('Case-insensitive substring of the meal name or description.'),
        category: CATEGORY_ENUM.optional().describe(`${CATEGORY_DESCRIPTION} Matches primary or alternative category.`),
        tag: z.string().optional().describe('Tag name (case-insensitive).'),
        limit: z.number().int().positive().optional().describe('Maximum number of meals returned (default 100).'),
      },
      annotations: READ_ONLY,
    },
    async ({ search, category, tag, limit }) =>
      run(async () => {
        const ctx = await loadContext()
        let meals = await loadMealsDetailed(ctx)
        if (search?.trim()) {
          const s = search.trim().toLowerCase()
          meals = meals.filter((m) => m.name.toLowerCase().includes(s) || (m.description || '').toLowerCase().includes(s))
        }
        if (category) {
          meals = meals.filter((m) => m.primary_category === category || m.alternative_categories.includes(category))
        }
        if (tag?.trim()) {
          const t = tag.trim().toLowerCase()
          meals = meals.filter((m) => m.tags.some((x) => x.name.toLowerCase() === t))
        }
        const max = limit ?? 100
        return ok({
          count: meals.length,
          ...(meals.length > max ? { truncated_to: max } : {}),
          meals: meals.slice(0, max).map(summarizeMeal),
        })
      })
  )

  server.registerTool(
    'get_meal',
    {
      title: 'Get meal',
      description:
        'Returns one meal with its default ingredients, every member\'s effective variant (amounts, grams, kcal, protein/fat/carbs) and the combined household amount per product with a package-size check (status "ok" / "off" / "unknown_package").',
      inputSchema: {
        id: z.string().describe('Meal id (from list_meals).'),
      },
      annotations: READ_ONLY,
    },
    async ({ id }) =>
      run(async () => {
        const ctx = await loadContext()
        return ok(await loadMealDetailed(ctx, id))
      })
  )

  server.registerTool(
    'preview_meal_nutrition',
    {
      title: 'Preview meal nutrition',
      description:
        'Calculates nutrition (kcal, protein, fat, carbs) per member and the household package check for a proposed recipe WITHOUT saving anything. Use it to balance amounts before create_meal / update_meal. warnings list products whose combined amount is not a clean package fraction (with the nearest clean amount) or whose package size is unknown.',
      inputSchema: {
        items: itemsSchema,
        member_variants: memberVariantsSchema.optional(),
      },
      annotations: READ_ONLY,
    },
    async ({ items, member_variants }) =>
      run(async () => {
        const ctx = await loadContext()
        const overrides = resolveVariants(ctx, member_variants)
        const products = await loadProducts(ctx)
        requireProducts(products, allProductIds(items, overrides))

        const now = new Date().toISOString()
        const fakeMeal: Meal = {
          id: 'preview',
          name: 'preview',
          user_id: ctx.actingUserId,
          household_id: ctx.householdId,
          is_shared: true,
          description: null,
          primary_category: null,
          alternative_categories: [],
          created_at: now,
          updated_at: now,
        }
        const itemRows: MealItem[] = items.map((i, idx) => ({
          id: `preview-item-${idx}`,
          meal_id: 'preview',
          product_id: i.product_id,
          amount: i.amount,
          unit_type: unitTypeOf(products, i.product_id),
          created_at: now,
        }))
        const overrideRows: MealItemOverride[] = overrides.flatMap((o) =>
          o.items.map((i, idx) => ({
            id: `preview-override-${o.user_id}-${idx}`,
            meal_id: 'preview',
            user_id: o.user_id,
            product_id: i.product_id,
            amount: i.amount,
            unit_type: unitTypeOf(products, i.product_id),
            created_at: now,
            updated_at: now,
          }))
        )

        const detail = buildMealDetailed(ctx, fakeMeal, itemRows, overrideRows, [], [], products)
        return ok({
          base_totals: detail.base_totals,
          variants: detail.variants.map((v) => ({
            user_name: v.user_name,
            is_override: v.is_override,
            totals: v.totals,
            items: v.items,
          })),
          household_totals: detail.household_totals,
          warnings: packageWarnings(detail),
        })
      })
  )

  server.registerTool(
    'create_meal',
    {
      title: 'Create meal',
      description:
        'Saves a new meal/recipe (posiłek) shared with the household. Read get_recipe_rules and check amounts with preview_meal_nutrition first. Fails if a meal with the same name exists (unless allow_duplicate_name), if a product id is unknown or a tag does not exist. Returns the saved meal and package warnings.',
      inputSchema: {
        name: z.string().min(1).describe('Meal name in Polish.'),
        description: z.string().optional().describe('Optional description / preparation steps (opis, sposób przygotowania).'),
        primary_category: CATEGORY_ENUM.optional().describe(`Primary meal slot. ${CATEGORY_DESCRIPTION}`),
        alternative_categories: z
          .array(CATEGORY_ENUM)
          .optional()
          .describe('Other meal slots this meal also fits (same values as primary_category).'),
        tag_names: z
          .array(z.string())
          .optional()
          .describe('Names of existing tags (case-insensitive). Unknown names cause an error listing the available tags.'),
        items: itemsSchema,
        member_variants: memberVariantsSchema.optional(),
        allow_duplicate_name: z
          .boolean()
          .optional()
          .describe('Set true to save even if a meal with the same name already exists.'),
      },
      annotations: WRITE,
    },
    async (args) =>
      run(async () => {
        const ctx = await loadContext()
        const name = args.name.trim()

        // Validate everything before touching the database
        const overrides = resolveVariants(ctx, args.member_variants)
        const products = await loadProducts(ctx)
        requireProducts(products, allProductIds(args.items, overrides))
        const tagIds = await resolveTagIds(ctx, args.tag_names || [])
        if (!args.allow_duplicate_name) {
          const dup = await findMealByName(ctx, name)
          if (dup) {
            return fail(
              `A meal named "${dup.name}" already exists (id ${dup.id}). Use update_meal, pick another name or pass allow_duplicate_name: true.`
            )
          }
        }

        const { data: mealData, error: mealError } = await ctx.db
          .from('meals')
          .insert({
            name,
            description: args.description?.trim() || null,
            user_id: ctx.actingUserId,
            household_id: ctx.householdId,
            is_shared: true,
            primary_category: args.primary_category || null,
            alternative_categories: args.alternative_categories || [],
          })
          .select('id')
          .single()
        if (mealError || !mealData) throw new Error(`Could not create meal: ${mealError?.message || 'no data returned'}`)
        const mealId = (mealData as { id: string }).id

        try {
          await insertTags(ctx, mealId, tagIds)
          await insertItems(ctx, mealId, args.items, products)
          await insertOverrides(ctx, mealId, overrides, products)
        } catch (err) {
          // Roll back the half-saved meal (child rows cascade)
          await ctx.db.from('meals').delete().eq('id', mealId)
          throw err
        }

        const detail = await loadMealDetailed(ctx, mealId)
        return ok({ created: true, meal: detail, warnings: packageWarnings(detail) })
      })
  )

  server.registerTool(
    'update_meal',
    {
      title: 'Update meal',
      description:
        'Updates a meal of the household. Only provided fields change. tag_names replaces all tags; items replaces the whole default ingredient list; member_variants replaces EVERY member\'s variant (all existing variants are deleted first) — so always pass the complete list of variants you want to keep, or [] to remove all variants. Returns the updated meal and package warnings.',
      inputSchema: {
        id: z.string().describe('Meal id (from list_meals).'),
        name: z.string().min(1).optional().describe('New meal name.'),
        description: z.string().optional().describe('New description; empty string clears it.'),
        primary_category: CATEGORY_ENUM.optional().describe(`Primary meal slot. ${CATEGORY_DESCRIPTION}`),
        alternative_categories: z.array(CATEGORY_ENUM).optional().describe('Replaces the list of alternative meal slots.'),
        tag_names: z.array(z.string()).optional().describe('Replaces all tags with these existing tag names (case-insensitive).'),
        items: itemsSchema.optional(),
        member_variants: memberVariantsSchema.optional(),
      },
      annotations: WRITE,
    },
    async (args) =>
      run(async () => {
        const ctx = await loadContext()
        await requireOwnMeal(ctx, args.id)

        // Validate before mutating
        const overrides = args.member_variants !== undefined ? resolveVariants(ctx, args.member_variants) : []
        const products = await loadProducts(ctx)
        requireProducts(products, allProductIds(args.items, overrides))
        const tagIds = args.tag_names !== undefined ? await resolveTagIds(ctx, args.tag_names) : null

        const patch: Record<string, unknown> = {}
        if (args.name !== undefined) patch.name = args.name.trim()
        if (args.description !== undefined) patch.description = args.description.trim() || null
        if (args.primary_category !== undefined) patch.primary_category = args.primary_category
        if (args.alternative_categories !== undefined) patch.alternative_categories = args.alternative_categories

        if (Object.keys(patch).length > 0) {
          const { error } = await ctx.db.from('meals').update(patch).eq('id', args.id).eq('household_id', ctx.householdId)
          if (error) throw new Error(`Could not update meal: ${error.message}`)
        }

        if (tagIds !== null) {
          const { error } = await ctx.db.from('meal_tags').delete().eq('meal_id', args.id)
          if (error) throw new Error(`meal_tags delete failed: ${error.message}`)
          await insertTags(ctx, args.id, tagIds)
        }

        if (args.items !== undefined) {
          const { error } = await ctx.db.from('meal_items').delete().eq('meal_id', args.id)
          if (error) throw new Error(`meal_items delete failed: ${error.message}`)
          await insertItems(ctx, args.id, args.items, products)
        }

        if (args.member_variants !== undefined) {
          const { error } = await ctx.db.from('meal_item_overrides').delete().eq('meal_id', args.id)
          if (error) throw new Error(`meal_item_overrides delete failed: ${error.message}`)
          await insertOverrides(ctx, args.id, overrides, products)
        }

        const detail = await loadMealDetailed(ctx, args.id)
        return ok({ updated: true, meal: detail, warnings: packageWarnings(detail) })
      })
  )

  server.registerTool(
    'delete_meal',
    {
      title: 'Delete meal',
      description:
        'Permanently deletes a meal of the household together with its ingredients, variants, tags and every meal plan entry (jadłospis) that uses it. Returns how many plan entries were removed.',
      inputSchema: {
        id: z.string().describe('Meal id (from list_meals).'),
      },
      annotations: DESTRUCTIVE,
    },
    async ({ id }) =>
      run(async () => {
        const ctx = await loadContext()
        const meal = await requireOwnMeal(ctx, id)

        const { count, error: countError } = await ctx.db
          .from('meal_plan')
          .select('id', { count: 'exact', head: true })
          .eq('meal_id', id)
        if (countError) throw new Error(`meal_plan: ${countError.message}`)

        const { error } = await ctx.db.from('meals').delete().eq('id', id).eq('household_id', ctx.householdId)
        if (error) throw new Error(`Could not delete meal: ${error.message}`)
        return ok({ deleted: true, name: meal.name, removed_plan_entries: count ?? 0 })
      })
  )
}
