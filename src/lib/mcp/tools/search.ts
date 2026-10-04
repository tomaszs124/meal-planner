import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import type { Product } from '@/lib/supabase/client'
import { loadContext } from '../context'
import { loadMealDetailed, MEAL_CATEGORY_LABELS_PL, type MealDetailed } from '../data'
import { UNIT_LABELS_PL } from '../nutrition'
import { fail, ok, READ_ONLY, run } from '../respond'

const MAX_RESULTS = 20

function appUrl(path: string): string {
  const base = (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/+$/, '')
  return `${base}${path}`
}

function mealText(meal: MealDetailed): string {
  const lines: string[] = [`Posiłek: ${meal.name}`]
  if (meal.description) lines.push(`Opis: ${meal.description}`)
  lines.push(`Kategoria główna: ${meal.primary_category_label || 'brak'}`)
  if (meal.alternative_categories.length > 0) {
    lines.push(`Kategorie alternatywne: ${meal.alternative_categories.map((c) => MEAL_CATEGORY_LABELS_PL[c]).join(', ')}`)
  }
  lines.push(`Tagi: ${meal.tags.length > 0 ? meal.tags.map((t) => t.name).join(', ') : 'brak'}`)

  for (const v of meal.variants) {
    lines.push('')
    lines.push(`${v.user_name}${v.is_override ? ' (własny wariant)' : ' (przepis bazowy)'}:`)
    for (const i of v.items) {
      const grams = i.unit === '100g' ? '' : ` (${i.grams} g)`
      lines.push(`- ${i.product_name}: ${i.amount} ${i.unit_label}${grams}, ${i.kcal} kcal`)
    }
    const t = v.totals
    lines.push(`Razem: ${t.kcal} kcal, białko ${t.protein} g, tłuszcz ${t.fat} g, węglowodany ${t.carbs} g, waga ${t.weight_grams} g`)
  }

  if (meal.household_totals.length > 0) {
    lines.push('')
    lines.push('Łącznie dla gospodarstwa (zakupy):')
    for (const h of meal.household_totals) {
      const pkg =
        h.status === 'unknown_package'
          ? 'brak rozmiaru opakowania'
          : `${h.packages_used} opakowania${h.status === 'off' ? ` (najbliższa czysta ilość: ${h.nearest_clean_amount} ${h.unit_label})` : ''}`
      lines.push(`- ${h.product_name}: ${h.total_amount} ${h.unit_label}, ${pkg}`)
    }
  }
  return lines.join('\n')
}

function productText(p: Product): string {
  const unitLabel = UNIT_LABELS_PL[p.unit_type] || p.unit_type
  const lines: string[] = [`Produkt: ${p.name}`, `Kategoria: ${p.category || 'brak'}`]
  lines.push(
    `Wartości odżywcze na 100 g: ${p.kcal_per_unit} kcal, białko ${p.protein ?? '?'} g, tłuszcz ${p.fat ?? '?'} g, węglowodany ${p.carbs ?? '?'} g`
  )
  if (p.unit_type === '100g') {
    lines.push('Jednostka: gramy (g)')
  } else {
    lines.push(`Jednostka: ${unitLabel} (1 ${unitLabel} = ${p.unit_weight_grams ?? '?'} g)`)
  }
  lines.push(`Opakowanie: ${p.package_size != null ? `${p.package_size} ${unitLabel}` : 'nieznane'}`)
  if (p.notes) lines.push(`Notatki: ${p.notes}`)
  return lines.join('\n')
}

export function registerSearchTools(server: McpServer) {
  server.registerTool(
    'search',
    {
      title: 'Search meals and products',
      description:
        'Searches the household meals (name, description) and products (name) by a case-insensitive text query. Returns up to 20 results with ids "meal:<uuid>" or "product:<uuid>" that can be passed to fetch.',
      inputSchema: {
        query: z.string().describe('Search text, e.g. "tofu" or "owsianka".'),
      },
      annotations: READ_ONLY,
    },
    async ({ query }) =>
      run(async () => {
        const ctx = await loadContext()
        const q = query.trim().toLowerCase()
        const [{ data: mealsData, error: mealsError }, { data: productsData, error: productsError }] = await Promise.all([
          ctx.db.from('meals').select('id, name, description').eq('household_id', ctx.householdId).order('name'),
          ctx.db.from('products').select('id, name').eq('household_id', ctx.householdId).order('name'),
        ])
        if (mealsError) throw new Error(`meals: ${mealsError.message}`)
        if (productsError) throw new Error(`products: ${productsError.message}`)

        const meals = ((mealsData || []) as { id: string; name: string; description: string | null }[]).filter(
          (m) => !q || m.name.toLowerCase().includes(q) || (m.description || '').toLowerCase().includes(q)
        )
        const products = ((productsData || []) as { id: string; name: string }[]).filter(
          (p) => !q || p.name.toLowerCase().includes(q)
        )

        const results = [
          ...meals.map((m) => ({ id: `meal:${m.id}`, title: m.name, url: appUrl('/meals') })),
          ...products.map((p) => ({ id: `product:${p.id}`, title: p.name, url: appUrl('/products') })),
        ].slice(0, MAX_RESULTS)

        return ok({ results })
      })
  )

  server.registerTool(
    'fetch',
    {
      title: 'Fetch meal or product',
      description:
        'Fetches the full content of a search result by id ("meal:<uuid>" or "product:<uuid>"). Returns a Polish text description: for meals the categories, tags, each member\'s ingredients with amounts and kcal and totals; for products nutrition per 100 g, unit and package size.',
      inputSchema: {
        id: z.string().describe('Result id from search: "meal:<uuid>" or "product:<uuid>".'),
      },
      annotations: READ_ONLY,
    },
    async ({ id }) =>
      run(async () => {
        const sep = id.indexOf(':')
        const kind = sep > 0 ? id.slice(0, sep) : ''
        const rawId = sep > 0 ? id.slice(sep + 1) : ''
        if (!rawId || (kind !== 'meal' && kind !== 'product')) {
          return fail(`Invalid id "${id}". Expected "meal:<uuid>" or "product:<uuid>".`)
        }

        const ctx = await loadContext()
        if (kind === 'meal') {
          const meal = await loadMealDetailed(ctx, rawId)
          return ok({
            id,
            title: meal.name,
            text: mealText(meal),
            url: appUrl('/meals'),
            metadata: {
              type: 'meal',
              primary_category: meal.primary_category,
              alternative_categories: meal.alternative_categories,
              tags: meal.tags.map((t) => t.name),
              kcal_by_member: Object.fromEntries(meal.variants.map((v) => [v.user_name, v.totals.kcal])),
            },
          })
        }

        const { data, error } = await ctx.db
          .from('products')
          .select('*')
          .eq('id', rawId)
          .eq('household_id', ctx.householdId)
          .maybeSingle()
        if (error) throw new Error(`products: ${error.message}`)
        if (!data) return fail(`Product ${rawId} not found in this household.`)
        const p = data as Product
        return ok({
          id,
          title: p.name,
          text: productText(p),
          url: appUrl('/products'),
          metadata: {
            type: 'product',
            category: p.category,
            unit_type: p.unit_type,
            package_size: p.package_size ?? null,
            kcal_per_100g: p.kcal_per_unit,
          },
        })
      })
  )
}
