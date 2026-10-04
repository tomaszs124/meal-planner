import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import type { Product } from '@/lib/supabase/client'
import { loadContext, type McpContext } from '../context'
import { UNIT_LABELS_PL } from '../nutrition'
import { DESTRUCTIVE, fail, ok, READ_ONLY, run, WRITE } from '../respond'

export const UNIT_TYPES = ['100g', 'piece', 'tablespoon', 'teaspoon', 'leaf', 'cube', 'slice'] as const

const UNIT_TYPE_DESCRIPTION =
  'Preferred unit of the product: "100g" (amounts in grams, label "g"), "piece" (szt.), "tablespoon" (łyżka), "teaspoon" (łyżeczka), "leaf" (liść), "cube" (kostka), "slice" (plaster).'

export type ProductOut = {
  id: string
  name: string
  category: string
  unit_type: Product['unit_type']
  unit_label: string
  unit_weight_grams: number | null
  package_size: number | null
  kcal_per_100g: number
  protein: number | null
  fat: number | null
  carbs: number | null
  notes: string | null
}

export function productOut(p: Product): ProductOut {
  return {
    id: p.id,
    name: p.name,
    category: p.category,
    unit_type: p.unit_type,
    unit_label: UNIT_LABELS_PL[p.unit_type] || p.unit_type,
    unit_weight_grams: p.unit_weight_grams,
    package_size: p.package_size ?? null,
    kcal_per_100g: p.kcal_per_unit,
    protein: p.protein,
    fat: p.fat,
    carbs: p.carbs,
    notes: p.notes,
  }
}

async function loadCategoryNames(ctx: McpContext): Promise<string[]> {
  const { data, error } = await ctx.db
    .from('product_categories')
    .select('name')
    .eq('household_id', ctx.householdId)
    .order('name')
  if (error) throw new Error(`product_categories: ${error.message}`)
  return ((data || []) as { name: string }[]).map((c) => c.name)
}

/** Returns the canonical category name (as stored) or throws listing valid names. */
async function requireCategory(ctx: McpContext, category: string): Promise<string> {
  const names = await loadCategoryNames(ctx)
  const match = names.find((n) => n.toLowerCase() === category.trim().toLowerCase())
  if (!match) {
    throw new Error(
      `Unknown product category "${category}". Valid categories: ${names.length > 0 ? names.join(', ') : '(none defined)'}`
    )
  }
  return match
}

async function findProductByName(ctx: McpContext, name: string, excludeId?: string): Promise<Product | null> {
  const { data, error } = await ctx.db.from('products').select('*').eq('household_id', ctx.householdId)
  if (error) throw new Error(`products: ${error.message}`)
  const needle = name.trim().toLowerCase()
  return ((data || []) as Product[]).find((p) => p.name.toLowerCase() === needle && p.id !== excludeId) || null
}

async function requireOwnProduct(ctx: McpContext, id: string): Promise<Product> {
  const { data, error } = await ctx.db
    .from('products')
    .select('*')
    .eq('id', id)
    .eq('household_id', ctx.householdId)
    .maybeSingle()
  if (error) throw new Error(`products: ${error.message}`)
  if (!data) throw new Error(`Product ${id} not found in this household. Use list_products to find valid ids.`)
  return data as Product
}

const nutritionFields = {
  kcal_per_100g: z.number().min(0).describe('Calories per 100 g of the product (kcal / 100 g), regardless of unit_type.'),
  protein: z.number().min(0).optional().describe('Protein in grams per 100 g (białko).'),
  fat: z.number().min(0).optional().describe('Fat in grams per 100 g (tłuszcz).'),
  carbs: z.number().min(0).optional().describe('Carbohydrates in grams per 100 g (węglowodany).'),
}

export function registerProductTools(server: McpServer) {
  server.registerTool(
    'list_products',
    {
      title: 'List products',
      description:
        'Lists products (produkty) of the household with nutrition per 100 g, preferred unit and retail package size. Amounts in meals are expressed in the product unit (grams for unit_type "100g", pieces/slices/etc. otherwise). Use it to find product ids before building a meal.',
      inputSchema: {
        search: z.string().optional().describe('Case-insensitive substring of the product name, e.g. "tofu".'),
        category: z.string().optional().describe('Exact product category name (case-insensitive), see list_product_categories.'),
        missing_package_size: z
          .boolean()
          .optional()
          .describe('true = only products without package_size (rozmiar opakowania) filled in.'),
        limit: z.number().int().positive().optional().describe('Maximum number of products returned (default 200).'),
      },
      annotations: READ_ONLY,
    },
    async ({ search, category, missing_package_size, limit }) =>
      run(async () => {
        const ctx = await loadContext()
        const { data, error } = await ctx.db
          .from('products')
          .select('*')
          .eq('household_id', ctx.householdId)
          .order('name')
        if (error) throw new Error(`products: ${error.message}`)
        let products = (data || []) as Product[]
        if (search?.trim()) {
          const s = search.trim().toLowerCase()
          products = products.filter((p) => p.name.toLowerCase().includes(s))
        }
        if (category?.trim()) {
          const c = category.trim().toLowerCase()
          products = products.filter((p) => (p.category || '').toLowerCase() === c)
        }
        if (missing_package_size) products = products.filter((p) => p.package_size == null)
        const max = limit ?? 200
        return ok({
          count: products.length,
          ...(products.length > max ? { truncated_to: max } : {}),
          products: products.slice(0, max).map(productOut),
        })
      })
  )

  server.registerTool(
    'list_product_categories',
    {
      title: 'List product categories',
      description:
        'Lists the product category names (kategorie produktów) defined in the household. A product category must be one of these names.',
      inputSchema: {},
      annotations: READ_ONLY,
    },
    async () =>
      run(async () => {
        const ctx = await loadContext()
        const names = await loadCategoryNames(ctx)
        return ok({ count: names.length, categories: names })
      })
  )

  server.registerTool(
    'create_product',
    {
      title: 'Create product',
      description:
        'Creates a new product (produkt) in the household. Nutrition values are per 100 g. Fails if a product with the same name already exists (returns its id) or if the category is not one of list_product_categories. Always fill package_size when the retail package is known — recipes are balanced against it.',
      inputSchema: {
        name: z.string().min(1).describe('Product name in Polish, e.g. "Tofu naturalne".'),
        ...nutritionFields,
        unit_type: z.enum(UNIT_TYPES).describe(UNIT_TYPE_DESCRIPTION),
        unit_weight_grams: z
          .number()
          .positive()
          .describe("1 for '100g', grams of one piece/slice/etc. otherwise (e.g. one egg = 60)."),
        package_size: z
          .number()
          .positive()
          .optional()
          .describe('Amount in one retail package, in the product unit (e.g. 180 for 180 g tofu, 10 for 10 eggs).'),
        category: z.string().min(1).describe('Product category name; must exist in list_product_categories.'),
        notes: z.string().optional().describe('Optional free-text notes (notatki).'),
      },
      annotations: WRITE,
    },
    async (args) =>
      run(async () => {
        const ctx = await loadContext()
        const name = args.name.trim()
        const existing = await findProductByName(ctx, name)
        if (existing) {
          return fail(
            `A product named "${existing.name}" already exists (id ${existing.id}). Use update_product to change it instead.`
          )
        }
        const category = await requireCategory(ctx, args.category)
        const { data, error } = await ctx.db
          .from('products')
          .insert({
            household_id: ctx.householdId,
            created_by: ctx.actingUserId,
            name,
            kcal_per_unit: args.kcal_per_100g,
            protein: args.protein ?? null,
            fat: args.fat ?? null,
            carbs: args.carbs ?? null,
            unit_type: args.unit_type,
            unit_weight_grams: args.unit_weight_grams,
            package_size: args.package_size ?? null,
            category,
            notes: args.notes?.trim() || null,
          })
          .select('*')
          .single()
        if (error || !data) throw new Error(`Could not create product: ${error?.message || 'no data returned'}`)
        return ok({ created: true, product: productOut(data as Product) })
      })
  )

  server.registerTool(
    'update_product',
    {
      title: 'Update product',
      description:
        'Updates a product of the household. Only the provided fields change. Nutrition values are per 100 g. Changing nutrition or units affects every meal using the product.',
      inputSchema: {
        id: z.string().describe('Product id (from list_products).'),
        name: z.string().min(1).optional().describe('New product name; must not collide with another product.'),
        kcal_per_100g: nutritionFields.kcal_per_100g.optional(),
        protein: nutritionFields.protein,
        fat: nutritionFields.fat,
        carbs: nutritionFields.carbs,
        unit_type: z.enum(UNIT_TYPES).optional().describe(UNIT_TYPE_DESCRIPTION),
        unit_weight_grams: z
          .number()
          .positive()
          .optional()
          .describe("1 for '100g', grams of one piece/slice/etc. otherwise."),
        package_size: z
          .number()
          .positive()
          .optional()
          .describe('Amount in one retail package, in the product unit (rozmiar opakowania).'),
        category: z.string().optional().describe('Product category name; must exist in list_product_categories.'),
        notes: z.string().optional().describe('Free-text notes; pass an empty string to clear.'),
      },
      annotations: WRITE,
    },
    async (args) =>
      run(async () => {
        const ctx = await loadContext()
        await requireOwnProduct(ctx, args.id)

        const patch: Record<string, unknown> = {}
        if (args.name !== undefined) {
          const name = args.name.trim()
          const clash = await findProductByName(ctx, name, args.id)
          if (clash) return fail(`Another product named "${clash.name}" already exists (id ${clash.id}).`)
          patch.name = name
        }
        if (args.kcal_per_100g !== undefined) patch.kcal_per_unit = args.kcal_per_100g
        if (args.protein !== undefined) patch.protein = args.protein
        if (args.fat !== undefined) patch.fat = args.fat
        if (args.carbs !== undefined) patch.carbs = args.carbs
        if (args.unit_type !== undefined) patch.unit_type = args.unit_type
        if (args.unit_weight_grams !== undefined) patch.unit_weight_grams = args.unit_weight_grams
        if (args.package_size !== undefined) patch.package_size = args.package_size
        if (args.category !== undefined) patch.category = await requireCategory(ctx, args.category)
        if (args.notes !== undefined) patch.notes = args.notes.trim() || null

        if (Object.keys(patch).length === 0) return fail('Nothing to update: pass at least one field besides id.')

        const { data, error } = await ctx.db
          .from('products')
          .update(patch)
          .eq('id', args.id)
          .eq('household_id', ctx.householdId)
          .select('*')
          .single()
        if (error || !data) throw new Error(`Could not update product: ${error?.message || 'no data returned'}`)
        return ok({ updated: true, product: productOut(data as Product) })
      })
  )

  server.registerTool(
    'delete_product',
    {
      title: 'Delete product',
      description:
        'Permanently deletes a product of the household. Refuses when the product is still used in any meal (base recipe or member variant) and lists those meals.',
      inputSchema: {
        id: z.string().describe('Product id (from list_products).'),
      },
      annotations: DESTRUCTIVE,
    },
    async ({ id }) =>
      run(async () => {
        const ctx = await loadContext()
        const product = await requireOwnProduct(ctx, id)

        const [{ data: itemRows, error: itemsError }, { data: overrideRows, error: overridesError }] = await Promise.all([
          ctx.db.from('meal_items').select('meal_id').eq('product_id', id),
          ctx.db.from('meal_item_overrides').select('meal_id').eq('product_id', id),
        ])
        if (itemsError) throw new Error(`meal_items: ${itemsError.message}`)
        if (overridesError) throw new Error(`meal_item_overrides: ${overridesError.message}`)

        const mealIds = Array.from(
          new Set([...((itemRows || []) as { meal_id: string }[]), ...((overrideRows || []) as { meal_id: string }[])].map((r) => r.meal_id))
        )
        if (mealIds.length > 0) {
          const { data: meals } = await ctx.db.from('meals').select('id, name').in('id', mealIds)
          const names = ((meals || []) as { id: string; name: string }[]).map((m) => `${m.name} (${m.id})`)
          return fail(
            `Product "${product.name}" is used in ${mealIds.length} meal(s): ${names.join(', ')}. Remove it from these meals first.`
          )
        }

        const { error } = await ctx.db.from('products').delete().eq('id', id).eq('household_id', ctx.householdId)
        if (error) throw new Error(`Could not delete product: ${error.message}`)
        return ok({ deleted: true, id, name: product.name })
      })
  )
}
