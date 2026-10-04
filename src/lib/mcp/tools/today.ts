import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import type { MealCategory, MealPlan } from '@/lib/supabase/client'
import { loadContext, memberLabel, resolveMembers } from '../context'
import { addDaysIso, assertDate, loadMealsDetailed, MEAL_CATEGORIES, MEAL_CATEGORY_LABELS_PL, todayIso } from '../data'
import { ok, READ_ONLY, run } from '../respond'

const CATEGORY_ENUM = z.enum(MEAL_CATEGORIES as [MealCategory, ...MealCategory[]])

/**
 * "Co mam dzisiaj na obiad?" – the most common question. A dedicated tool with a
 * matching description keeps the assistant from inventing a new recipe when the
 * user means the meal that is already planned.
 */
export function registerTodayTools(server: McpServer) {
  server.registerTool(
    'get_my_planned_meal',
    {
      title: 'What is planned for me (recipe of a planned meal)',
      description:
        'Returns the meal ALREADY PLANNED for a member on a given day (default: me, today) with its full recipe: ingredients in that member\'s variant (amounts, grams, kcal), preparation steps (description), tags and totals. Use this FIRST whenever the user asks about "dzisiejszy obiad", "co mam na śniadanie", "przepis na jutrzejszą kolację", "co jemy dziś" or similar. Only propose/create a new recipe when the user explicitly asks for a new idea or when the slot is empty (the response says so).',
      inputSchema: {
        date: z
          .string()
          .optional()
          .describe('Day in YYYY-MM-DD (default today; "jutro" = today + 1). Dates are in the household time zone (Europe/Warsaw).'),
        meal_type: CATEGORY_ENUM.optional().describe(
          'Which slot: breakfast (śniadanie), second_breakfast (drugie śniadanie), lunch (obiad), dinner (kolacja), snack (przekąska). Omit to get every slot of the day.'
        ),
        user: z.string().optional().describe('Member reference ("me" by default, or a name / email / user_id).'),
      },
      annotations: READ_ONLY,
    },
    async ({ date, meal_type, user }) =>
      run(async () => {
        const ctx = await loadContext()
        const day = date ? assertDate(date) : todayIso()
        const members = resolveMembers(ctx, user ? [user] : undefined)
        if (members.length !== 1) throw new Error('user must resolve to exactly one household member')
        const member = members[0]

        let query = ctx.db
          .from('meal_plan')
          .select('*')
          .eq('household_id', ctx.householdId)
          .eq('user_id', member.user_id)
          .eq('date', day)
        if (meal_type) query = query.eq('meal_type', meal_type)
        const { data, error } = await query
        if (error) throw new Error(`meal_plan: ${error.message}`)
        const rows = (data || []) as MealPlan[]

        const details = rows.length > 0 ? await loadMealsDetailed(ctx, rows.map((r) => r.meal_id)) : []
        const byId = new Map(details.map((d) => [d.id, d]))

        const slots = MEAL_CATEGORIES.filter((c) => !meal_type || c === meal_type).map((slot) => {
          const row = rows.find((r) => r.meal_type === slot)
          const detail = row ? byId.get(row.meal_id) : undefined
          if (!row || !detail) {
            return { meal_type: slot, label_pl: MEAL_CATEGORY_LABELS_PL[slot], planned: false as const }
          }
          const variant = detail.variants.find((v) => v.user_id === member.user_id)
          return {
            meal_type: slot,
            label_pl: MEAL_CATEGORY_LABELS_PL[slot],
            planned: true as const,
            meal_id: detail.id,
            name: detail.name,
            preparation: detail.description,
            tags: detail.tags.map((t) => t.name),
            is_consumed: row.is_consumed,
            is_skipped: row.is_skipped ?? false,
            ingredients: variant?.items ?? detail.base_items,
            totals: variant?.totals ?? detail.base_totals,
            is_member_variant: variant?.is_override ?? false,
            other_members: detail.variants
              .filter((v) => v.user_id !== member.user_id)
              .map((v) => ({ user_name: v.user_name, kcal: v.totals.kcal, has_own_variant: v.is_override })),
          }
        })

        return ok({
          date: day,
          tomorrow: addDaysIso(day, 1),
          user: memberLabel(ctx, member.user_id),
          slots,
          hint:
            slots.every((s) => !s.planned)
              ? 'Nothing is planned for this day/slot. Ask whether to pick an existing meal (list_meals) or create a new one.'
              : 'Present the planned recipe; do not invent a new one unless asked.',
        })
      })
  )
}
