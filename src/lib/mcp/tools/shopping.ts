import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import type { MealItem, MealItemOverride, Product, ShoppingListItem } from '@/lib/supabase/client'
import { loadContext, memberLabel, resolveMembers, type McpContext } from '../context'
import { assertDate, loadProducts } from '../data'
import { checkPackageUsage, UNIT_LABELS_PL, type PackageCheck } from '../nutrition'
import { DESTRUCTIVE, fail, ok, READ_ONLY, run, WRITE } from '../respond'

type ItemRow = ShoppingListItem & {
  product: Product | null
  meal: { id: string; name: string } | null
}

type StateRow = {
  household_id: string
  generated_start_date: string | null
  generated_end_date: string | null
  meal_servings: Record<string, number> | null
}

type CustomListItemRow = {
  id: string
  list_id: string
  name: string
  quantity: string | null
  is_checked: boolean
  created_at?: string
}

type CustomListRow = {
  id: string
  household_id: string
  name: string
  visible_to: string[] | null
  created_by: string | null
  created_at: string
  items?: CustomListItemRow[]
}

type PlanRow = { id: string; user_id: string; meal_id: string; date: string }

const ITEM_SELECT = '*, product:products(*), meal:meals(id, name)'

/** Same key format as the UI (getMealGroupKey in ShoppingListEnhanced). */
function groupKey(mealId: string, sourceUserId: string | null): string {
  return `${mealId}:${sourceUserId || 'unknown'}`
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

function describeShoppingItem(item: ItemRow) {
  const unit = item.unit_type || item.product?.unit_type || null
  const packageSize = item.product?.package_size ?? null
  return {
    id: item.id,
    name: item.name || item.product?.name || '(bez nazwy)',
    product_id: item.product_id,
    amount: Number(item.amount),
    unit_type: unit,
    unit_label: unit ? UNIT_LABELS_PL[unit] || unit : null,
    custom_amount_text: item.custom_amount_text,
    is_checked: item.is_checked,
    package_size: packageSize,
    packages_needed: packageSize && !item.custom_amount_text ? round2(Number(item.amount) / packageSize) : null,
  }
}

async function loadState(ctx: McpContext): Promise<StateRow | null> {
  const { data, error } = await ctx.db
    .from('shopping_list_state')
    .select('household_id, generated_start_date, generated_end_date, meal_servings')
    .eq('household_id', ctx.householdId)
    .maybeSingle()
  if (error) throw new Error(`shopping_list_state: ${error.message}`)
  return (data as StateRow | null) || null
}

async function saveServings(ctx: McpContext, servings: Record<string, number>) {
  const { error } = await ctx.db.from('shopping_list_state').upsert({
    household_id: ctx.householdId,
    meal_servings: servings,
    updated_by: ctx.actingUserId,
  })
  if (error) throw new Error(`shopping_list_state: ${error.message}`)
}

async function resetState(ctx: McpContext) {
  const { error } = await ctx.db.from('shopping_list_state').upsert({
    household_id: ctx.householdId,
    generated_start_date: null,
    generated_end_date: null,
    meal_servings: {},
    updated_by: ctx.actingUserId,
  })
  if (error) throw new Error(`shopping_list_state: ${error.message}`)
}

async function loadItems(ctx: McpContext): Promise<ItemRow[]> {
  const { data, error } = await ctx.db
    .from('shopping_list_items')
    .select(ITEM_SELECT)
    .eq('household_id', ctx.householdId)
    .order('created_at', { ascending: false })
    .order('id', { ascending: true })
  if (error) throw new Error(`shopping_list_items: ${error.message}`)
  return (data || []) as unknown as ItemRow[]
}

/** Builds the shopping list view (same grouping as the UI: one group per meal and member). */
async function buildList(ctx: McpContext) {
  const [items, state] = await Promise.all([loadItems(ctx), loadState(ctx)])
  const servings = state?.meal_servings || {}

  type Group = {
    group_key: string
    meal_id: string
    meal_name: string | null
    source_user_id: string | null
    source_user_name: string | null
    servings: number
    items: ReturnType<typeof describeShoppingItem>[]
  }
  const groups = new Map<string, Group>()
  const customItems: ReturnType<typeof describeShoppingItem>[] = []

  for (const item of items) {
    if (!item.meal_id) {
      customItems.push(describeShoppingItem(item))
      continue
    }
    const key = groupKey(item.meal_id, item.source_user_id)
    let group = groups.get(key)
    if (!group) {
      group = {
        group_key: key,
        meal_id: item.meal_id,
        meal_name: item.meal?.name ?? null,
        source_user_id: item.source_user_id,
        source_user_name: item.source_user_id ? memberLabel(ctx, item.source_user_id) : null,
        servings: servings[key] ?? 1,
        items: [],
      }
      groups.set(key, group)
    }
    group.items.push(describeShoppingItem(item))
  }

  return {
    generated_range:
      state?.generated_start_date && state?.generated_end_date
        ? { start_date: state.generated_start_date, end_date: state.generated_end_date }
        : null,
    groups: Array.from(groups.values()),
    custom_items: customItems,
    totals: { items: items.length, checked: items.filter((i) => i.is_checked).length },
  }
}

/** Returns only those ids that belong to the household; throws on unknown ids. */
async function requireItemIds(ctx: McpContext, ids: string[]): Promise<ItemRow[]> {
  const unique = Array.from(new Set(ids))
  if (unique.length === 0) throw new Error('ids must not be empty')
  const { data, error } = await ctx.db
    .from('shopping_list_items')
    .select('*')
    .eq('household_id', ctx.householdId)
    .in('id', unique)
  if (error) throw new Error(`shopping_list_items: ${error.message}`)
  const rows = (data || []) as ItemRow[]
  const found = new Set(rows.map((r) => r.id))
  const missing = unique.filter((id) => !found.has(id))
  if (missing.length > 0) {
    throw new Error(`Unknown shopping list item id(s): ${missing.join(', ')}. Use get_shopping_list to find valid ids.`)
  }
  return rows
}

async function loadCustomLists(ctx: McpContext): Promise<CustomListRow[]> {
  const { data, error } = await ctx.db
    .from('custom_lists')
    .select('*, items:custom_list_items(*)')
    .eq('household_id', ctx.householdId)
    .order('created_at', { ascending: true })
  if (error) throw new Error(`custom_lists: ${error.message}`)
  // Same visibility rule as the UI (CustomLists.tsx): visible_to or created by the acting user
  return ((data || []) as CustomListRow[]).filter(
    (l) => (l.visible_to || []).includes(ctx.actingUserId) || l.created_by === ctx.actingUserId
  )
}

export function registerShoppingTools(server: McpServer) {
  server.registerTool(
    'get_shopping_list',
    {
      title: 'Get shopping list',
      description:
        'Returns the household shopping list grouped by meal and member (with servings), custom items added by hand, the date range it was generated for, and for each product how many retail packages are needed.',
      inputSchema: {},
      annotations: READ_ONLY,
    },
    async () =>
      run(async () => {
        const ctx = await loadContext()
        return ok(await buildList(ctx))
      })
  )

  server.registerTool(
    'generate_shopping_list',
    {
      title: 'Generate shopping list from meal plan',
      description:
        'Builds the shopping list from the meal plan for a date range (like the "Generuj" button in the app): each member gets their own ingredient variant, amounts are summed per meal and member, and servings are counted. By default the existing list is cleared first. Returns the new list plus a per-product package summary.',
      inputSchema: {
        start_date: z.string().describe('First day of the plan to shop for, YYYY-MM-DD'),
        end_date: z.string().describe('Last day (inclusive), YYYY-MM-DD'),
        users: z
          .array(z.string())
          .optional()
          .describe('Member references: "me", "all", a name, email or user_id. Default here: all members'),
        clear_existing: z
          .boolean()
          .optional()
          .describe('Delete the current shopping list (including custom items) before generating (default true)'),
      },
      annotations: WRITE,
    },
    async ({ start_date, end_date, users, clear_existing }) =>
      run(async () => {
        const ctx = await loadContext()
        assertDate(start_date, 'start_date')
        assertDate(end_date, 'end_date')
        if (end_date < start_date) return fail('end_date must not be before start_date')
        const members = users && users.length > 0 ? resolveMembers(ctx, users) : ctx.members
        const clearExisting = clear_existing ?? true

        const { data: planData, error: planError } = await ctx.db
          .from('meal_plan')
          .select('id, user_id, meal_id, date')
          .eq('household_id', ctx.householdId)
          .in(
            'user_id',
            members.map((m) => m.user_id)
          )
          .gte('date', start_date)
          .lte('date', end_date)
        if (planError) throw new Error(`meal_plan: ${planError.message}`)
        const planRows = (planData || []) as PlanRow[]
        if (planRows.length === 0) return fail(`No meals planned between ${start_date} and ${end_date}`)

        const mealIds = Array.from(new Set(planRows.map((r) => r.meal_id)))
        const [products, { data: mealsData, error: mealsError }, { data: itemsData }, { data: overridesData }] =
          await Promise.all([
            loadProducts(ctx),
            ctx.db.from('meals').select('id').eq('household_id', ctx.householdId).in('id', mealIds),
            ctx.db.from('meal_items').select('*').in('meal_id', mealIds),
            ctx.db.from('meal_item_overrides').select('*').in('meal_id', mealIds),
          ])
        if (mealsError) throw new Error(`meals: ${mealsError.message}`)
        const householdMealIds = new Set(((mealsData || []) as { id: string }[]).map((m) => m.id))
        const mealItems = (itemsData || []) as MealItem[]
        const overrides = (overridesData || []) as MealItemOverride[]

        // Aggregate exactly like the UI: key = meal:source_user:product
        const servings: Record<string, number> = {}
        const aggregated = new Map<
          string,
          { meal_id: string; source_user_id: string; product: Product; amount: number; unit_type: string }
        >()

        for (const plan of planRows) {
          if (!householdMealIds.has(plan.meal_id)) continue // mirrors meals!inner
          const own = overrides.filter((o) => o.meal_id === plan.meal_id && o.user_id === plan.user_id)
          const source: { product_id: string; amount: number; unit_type: string }[] =
            own.length > 0 ? own : mealItems.filter((i) => i.meal_id === plan.meal_id)

          let added = 0
          for (const item of source) {
            const product = products.get(item.product_id)
            if (!product) continue
            const key = `${plan.meal_id}:${plan.user_id}:${product.id}`
            const amount = parseFloat(String(item.amount))
            const existing = aggregated.get(key)
            if (existing) {
              existing.amount = Math.round((existing.amount + amount) * 10000) / 10000
            } else {
              aggregated.set(key, {
                meal_id: plan.meal_id,
                source_user_id: plan.user_id,
                product,
                amount,
                unit_type: item.unit_type,
              })
            }
            added += 1
          }
          if (added > 0) {
            const gk = groupKey(plan.meal_id, plan.user_id)
            servings[gk] = (servings[gk] || 0) + 1
          }
        }

        if (aggregated.size === 0) return fail('The planned meals have no ingredients')

        if (clearExisting) {
          const { error } = await ctx.db.from('shopping_list_items').delete().eq('household_id', ctx.householdId)
          if (error) throw new Error(`shopping_list_items delete: ${error.message}`)
        }

        const rows = Array.from(aggregated.values()).map((a) => ({
          household_id: ctx.householdId,
          meal_id: a.meal_id,
          source_user_id: a.source_user_id,
          product_id: a.product.id,
          name: a.product.name,
          amount: round2(a.amount),
          unit_type: a.unit_type,
          custom_amount_text: null,
          is_checked: false,
          added_by: ctx.actingUserId,
        }))
        const { error: insertError } = await ctx.db.from('shopping_list_items').insert(rows)
        if (insertError) throw new Error(`shopping_list_items insert: ${insertError.message}`)

        const { error: stateError } = await ctx.db.from('shopping_list_state').upsert({
          household_id: ctx.householdId,
          generated_start_date: start_date,
          generated_end_date: end_date,
          meal_servings: servings,
          updated_by: ctx.actingUserId,
        })
        if (stateError) throw new Error(`shopping_list_state: ${stateError.message}`)

        // How the generated amounts fall on retail packages, per product
        const perProduct = new Map<string, number>()
        for (const a of aggregated.values()) {
          perProduct.set(a.product.id, (perProduct.get(a.product.id) || 0) + a.amount)
        }
        const packageSummary: PackageCheck[] = []
        for (const [pid, amount] of perProduct) {
          const p = products.get(pid)
          if (p) packageSummary.push(checkPackageUsage(amount, p))
        }
        packageSummary.sort((a, b) => a.product_name.localeCompare(b.product_name, 'pl'))

        return ok({
          inserted: rows.length,
          cleared_existing: clearExisting,
          servings,
          package_summary: packageSummary,
          list: await buildList(ctx),
        })
      })
  )

  server.registerTool(
    'add_shopping_list_item',
    {
      title: 'Add item to shopping list',
      description:
        'Adds a single item to the shopping list, either a product from the database (product_id) or a free-text item (name). Use custom_amount_text for non-numeric amounts like "garść" or "2 opakowania".',
      inputSchema: {
        product_id: z.string().optional().describe('Product id from list_products / search_products'),
        name: z.string().optional().describe('Item name; required when product_id is not given'),
        amount: z.number().positive().optional().describe('Amount in unit_type (default 1)'),
        unit_type: z
          .string()
          .optional()
          .describe('Unit: 100g, piece, tablespoon, teaspoon, leaf, cube, slice (default: product unit)'),
        custom_amount_text: z
          .string()
          .optional()
          .describe('Free-form amount, e.g. "garść", "2 opakowania"; when given amount is stored as 1'),
      },
      annotations: WRITE,
    },
    async ({ product_id, name, amount, unit_type, custom_amount_text }) =>
      run(async () => {
        const ctx = await loadContext()
        let product: Product | null = null
        if (product_id) {
          const products = await loadProducts(ctx)
          product = products.get(product_id) || null
          if (!product) return fail(`Unknown product id ${product_id}. Use list_products to find valid ids.`)
        }
        const itemName = name?.trim() || product?.name
        if (!itemName) return fail('Provide product_id or name')

        const customText = custom_amount_text?.trim() || null
        const { data, error } = await ctx.db
          .from('shopping_list_items')
          .insert({
            household_id: ctx.householdId,
            product_id: product?.id ?? null,
            meal_id: null,
            source_user_id: null,
            name: itemName,
            amount: customText ? 1 : (amount ?? 1),
            unit_type: unit_type || product?.unit_type || null,
            custom_amount_text: customText,
            is_checked: false,
            added_by: ctx.actingUserId,
          })
          .select(ITEM_SELECT)
          .single()
        if (error) throw new Error(`shopping_list_items insert: ${error.message}`)
        return ok({ item: describeShoppingItem(data as unknown as ItemRow) })
      })
  )

  server.registerTool(
    'set_shopping_list_items_checked',
    {
      title: 'Check / uncheck shopping list items',
      description: 'Marks shopping list items as bought (is_checked=true) or not bought (false).',
      inputSchema: {
        ids: z.array(z.string()).min(1).describe('Shopping list item ids (from get_shopping_list)'),
        is_checked: z.boolean().describe('true = bought / in the cart, false = still to buy'),
      },
      annotations: WRITE,
    },
    async ({ ids, is_checked }) =>
      run(async () => {
        const ctx = await loadContext()
        const rows = await requireItemIds(ctx, ids)
        const { data, error } = await ctx.db
          .from('shopping_list_items')
          .update({
            is_checked,
            checked_by: is_checked ? ctx.actingUserId : null,
            checked_at: is_checked ? new Date().toISOString() : null,
          })
          .eq('household_id', ctx.householdId)
          .in(
            'id',
            rows.map((r) => r.id)
          )
          .select('id')
        if (error) throw new Error(`shopping_list_items update: ${error.message}`)
        return ok({ updated: (data || []).length })
      })
  )

  server.registerTool(
    'remove_shopping_list_items',
    {
      title: 'Remove shopping list items',
      description:
        'Deletes items from the shopping list. When all items of a meal group are removed, its servings entry is dropped too.',
      inputSchema: {
        ids: z.array(z.string()).min(1).describe('Shopping list item ids (from get_shopping_list)'),
      },
      annotations: DESTRUCTIVE,
    },
    async ({ ids }) =>
      run(async () => {
        const ctx = await loadContext()
        const rows = await requireItemIds(ctx, ids)
        const { data, error } = await ctx.db
          .from('shopping_list_items')
          .delete()
          .eq('household_id', ctx.householdId)
          .in(
            'id',
            rows.map((r) => r.id)
          )
          .select('id')
        if (error) throw new Error(`shopping_list_items delete: ${error.message}`)

        const touchedKeys = new Set(
          rows.filter((r) => r.meal_id).map((r) => groupKey(r.meal_id as string, r.source_user_id))
        )
        if (touchedKeys.size > 0) {
          const remaining = await loadItems(ctx)
          const stillPresent = new Set(
            remaining.filter((r) => r.meal_id).map((r) => groupKey(r.meal_id as string, r.source_user_id))
          )
          const state = await loadState(ctx)
          const servings = { ...(state?.meal_servings || {}) }
          let changed = false
          for (const key of touchedKeys) {
            if (!stillPresent.has(key) && key in servings) {
              delete servings[key]
              changed = true
            }
          }
          if (changed) await saveServings(ctx, servings)
        }

        return ok({ deleted: (data || []).length })
      })
  )

  server.registerTool(
    'clear_shopping_list',
    {
      title: 'Clear shopping list',
      description:
        'Deletes the whole shopping list of the household, or only the checked (bought) items when only_checked=true.',
      inputSchema: {
        only_checked: z.boolean().optional().describe('true = delete only checked items (default false = delete everything)'),
      },
      annotations: DESTRUCTIVE,
    },
    async ({ only_checked }) =>
      run(async () => {
        const ctx = await loadContext()
        let query = ctx.db.from('shopping_list_items').delete().eq('household_id', ctx.householdId)
        if (only_checked) query = query.eq('is_checked', true)
        const { data, error } = await query.select('id, meal_id, source_user_id')
        if (error) throw new Error(`shopping_list_items delete: ${error.message}`)

        const remaining = only_checked ? await loadItems(ctx) : []
        if (remaining.length === 0) {
          await resetState(ctx)
        } else {
          // Drop servings of groups that no longer have any item
          const stillPresent = new Set(
            remaining.filter((r) => r.meal_id).map((r) => groupKey(r.meal_id as string, r.source_user_id))
          )
          const state = await loadState(ctx)
          const servings = state?.meal_servings || {}
          const next = Object.fromEntries(Object.entries(servings).filter(([key]) => stillPresent.has(key)))
          if (Object.keys(next).length !== Object.keys(servings).length) await saveServings(ctx, next)
        }

        return ok({ deleted: (data || []).length, remaining: remaining.length })
      })
  )

  server.registerTool(
    'set_shopping_list_meal_servings',
    {
      title: 'Change servings of a meal on the shopping list',
      description:
        'Changes how many servings of a meal (for a given member) the shopping list should cover, scaling every ingredient of that meal group proportionally (items with a free-form amount are left as they are).',
      inputSchema: {
        meal_id: z.string().describe('Meal id of the group (from get_shopping_list)'),
        source_user: z
          .string()
          .optional()
          .describe('Member whose variant the group belongs to: "me" (default), a name, email or user_id'),
        servings: z.number().positive().describe('New number of servings (> 0)'),
      },
      annotations: WRITE,
    },
    async ({ meal_id, source_user, servings }) =>
      run(async () => {
        const ctx = await loadContext()
        const resolved = resolveMembers(ctx, source_user ? [source_user] : undefined)
        if (resolved.length !== 1) return fail('source_user must reference exactly one member')
        const sourceUserId = resolved[0].user_id
        const key = groupKey(meal_id, sourceUserId)

        const [items, state] = await Promise.all([loadItems(ctx), loadState(ctx)])
        const groupItems = items.filter((i) => i.meal_id === meal_id && (i.source_user_id || null) === sourceUserId)
        if (groupItems.length === 0) {
          const available = Array.from(
            new Set(items.filter((i) => i.meal_id).map((i) => `${i.meal?.name ?? i.meal_id} (${i.source_user_id ? memberLabel(ctx, i.source_user_id) : 'unknown'})`))
          )
          return fail(
            `No shopping list group for meal ${meal_id} and ${memberLabel(ctx, sourceUserId)}. Groups on the list: ${available.join(', ') || 'none'}`
          )
        }

        const currentMap = state?.meal_servings || {}
        const current = currentMap[key] ?? 1
        if (Math.abs(current - servings) >= 0.0001) {
          const scale = servings / current
          // 1. Persist serving count first (same order as the UI)
          await saveServings(ctx, { ...currentMap, [key]: servings })
          // 2. Scale amounts of non-custom items
          for (const item of groupItems) {
            if (item.custom_amount_text) continue
            const amount = Math.max(0.01, round2(parseFloat(String(item.amount)) * scale))
            const { error } = await ctx.db
              .from('shopping_list_items')
              .update({ amount })
              .eq('id', item.id)
              .eq('household_id', ctx.householdId)
            if (error) throw new Error(`shopping_list_items update: ${error.message}`)
          }
        }

        const list = await buildList(ctx)
        return ok({
          previous_servings: current,
          group: list.groups.find((g) => g.group_key === key) ?? null,
        })
      })
  )

  server.registerTool(
    'list_custom_lists',
    {
      title: 'List custom lists',
      description:
        'Returns the custom lists (e.g. drugstore, hardware store) visible to the acting user, with their items.',
      inputSchema: {},
      annotations: READ_ONLY,
    },
    async () =>
      run(async () => {
        const ctx = await loadContext()
        const lists = await loadCustomLists(ctx)
        return ok({
          lists: lists.map((l) => ({
            id: l.id,
            name: l.name,
            visible_to: (l.visible_to || []).map((id) => ({ user_id: id, name: memberLabel(ctx, id) })),
            created_by: l.created_by ? memberLabel(ctx, l.created_by) : null,
            items: (l.items || [])
              .slice()
              .sort((a, b) => (a.created_at || '').localeCompare(b.created_at || ''))
              .map((i) => ({ id: i.id, name: i.name, quantity: i.quantity, is_checked: i.is_checked })),
          })),
        })
      })
  )

  server.registerTool(
    'add_custom_list_item',
    {
      title: 'Add item to a custom list',
      description: 'Adds an item to one of the custom lists, identified by list_id or list_name (case-insensitive).',
      inputSchema: {
        list_id: z.string().optional().describe('Custom list id (from list_custom_lists)'),
        list_name: z.string().optional().describe('Custom list name, matched case-insensitively (used when list_id is not given)'),
        name: z.string().min(1).describe('Item name'),
        quantity: z.string().optional().describe('Optional free-form quantity, e.g. "2", "1 opakowanie"'),
      },
      annotations: WRITE,
    },
    async ({ list_id, list_name, name, quantity }) =>
      run(async () => {
        const ctx = await loadContext()
        const lists = await loadCustomLists(ctx)
        let list: CustomListRow | undefined
        if (list_id) {
          list = lists.find((l) => l.id === list_id)
        } else if (list_name) {
          const wanted = list_name.trim().toLowerCase()
          list = lists.find((l) => l.name.trim().toLowerCase() === wanted)
        } else {
          return fail('Provide list_id or list_name')
        }
        if (!list) {
          return fail(
            `Custom list "${list_id || list_name}" not found. Available lists: ${lists.map((l) => `${l.name} <${l.id}>`).join(', ') || 'none'}`
          )
        }

        const { data, error } = await ctx.db
          .from('custom_list_items')
          .insert({ list_id: list.id, name: name.trim(), quantity: quantity?.trim() || null, is_checked: false })
          .select()
          .single()
        if (error) throw new Error(`custom_list_items insert: ${error.message}`)
        const item = data as CustomListItemRow
        return ok({
          list: { id: list.id, name: list.name },
          item: { id: item.id, name: item.name, quantity: item.quantity, is_checked: item.is_checked },
        })
      })
  )

  server.registerTool(
    'set_custom_list_item_checked',
    {
      title: 'Check / uncheck custom list item',
      description: 'Marks an item of a custom list as done (is_checked=true) or not done (false).',
      inputSchema: {
        id: z.string().describe('Custom list item id (from list_custom_lists)'),
        is_checked: z.boolean().describe('true = done / bought, false = still to do'),
      },
      annotations: WRITE,
    },
    async ({ id, is_checked }) =>
      run(async () => {
        const ctx = await loadContext()
        const lists = await loadCustomLists(ctx)
        const list = lists.find((l) => (l.items || []).some((i) => i.id === id))
        if (!list) return fail(`Custom list item ${id} not found. Use list_custom_lists to find valid ids.`)

        const { data, error } = await ctx.db
          .from('custom_list_items')
          .update({ is_checked })
          .eq('id', id)
          .eq('list_id', list.id)
          .select()
          .single()
        if (error) throw new Error(`custom_list_items update: ${error.message}`)
        const item = data as CustomListItemRow
        return ok({
          list: { id: list.id, name: list.name },
          item: { id: item.id, name: item.name, quantity: item.quantity, is_checked: item.is_checked },
        })
      })
  )
}
