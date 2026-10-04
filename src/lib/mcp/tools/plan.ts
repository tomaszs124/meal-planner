import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import type { MealCategory } from '@/lib/supabase/client'
import { loadContext, memberLabel, resolveMembers, type McpContext, type Member } from '../context'
import {
  addDaysIso,
  assertDate,
  eachDay,
  kcalForMember,
  loadMealsDetailed,
  MEAL_CATEGORIES,
  MEAL_CATEGORY_LABELS_PL,
  todayIso,
  type MealDetailed,
} from '../data'
import { DESTRUCTIVE, fail, ok, READ_ONLY, run, WRITE } from '../respond'

/** meal_plan row as stored in the DB (the shared MealPlan type lacks is_skipped). */
type PlanRow = {
  id: string
  date: string
  meal_type: MealCategory
  is_consumed: boolean
  is_skipped: boolean | null
  user_id: string
  household_id: string
  meal_id: string
}

const USERS_DESCRIPTION = 'Member references: "me" (default), "all", a name, email or user_id'

const usersField = z.array(z.string()).optional().describe(USERS_DESCRIPTION)
const dateField = (what: string) => z.string().describe(`${what} in YYYY-MM-DD format`)
const mealTypeField = z
  .enum(['breakfast', 'second_breakfast', 'lunch', 'dinner', 'snack'])
  .describe(
    'Meal slot: breakfast (śniadanie), second_breakfast (drugie śniadanie), lunch (obiad), dinner (kolacja), snack (przekąska)'
  )

/** Slots a member has enabled in settings (breakfast is always on). */
export function enabledSlots(member: Member): MealCategory[] {
  return MEAL_CATEGORIES.filter((c) => {
    if (c === 'breakfast') return true
    if (c === 'second_breakfast') return member.settings.second_breakfast_enabled
    if (c === 'lunch') return member.settings.lunch_enabled
    if (c === 'dinner') return member.settings.dinner_enabled
    return member.settings.snack_enabled
  })
}

/** Loads meals by id and throws a clear message when any id is not in the household. */
async function requireMeals(ctx: McpContext, mealIds: string[]): Promise<Map<string, MealDetailed>> {
  const unique = Array.from(new Set(mealIds))
  const meals = unique.length > 0 ? await loadMealsDetailed(ctx, unique) : []
  const map = new Map(meals.map((m) => [m.id, m]))
  const missing = unique.filter((id) => !map.has(id))
  if (missing.length > 0) {
    throw new Error(`Unknown meal id(s): ${missing.join(', ')}. Use list_meals / search to find valid ids.`)
  }
  return map
}

/** Sets a slot like the UI: update the existing row (resetting status) or insert a new one. */
async function setSlot(
  ctx: McpContext,
  userId: string,
  date: string,
  mealType: MealCategory,
  mealId: string
): Promise<'updated' | 'inserted'> {
  const { data: existing, error: selectError } = await ctx.db
    .from('meal_plan')
    .select('id')
    .eq('household_id', ctx.householdId)
    .eq('user_id', userId)
    .eq('date', date)
    .eq('meal_type', mealType)
    .limit(1)
    .maybeSingle()
  if (selectError) throw new Error(`meal_plan lookup: ${selectError.message}`)

  if (existing) {
    const { error } = await ctx.db
      .from('meal_plan')
      .update({ meal_id: mealId, is_consumed: false, is_skipped: false })
      .eq('id', (existing as { id: string }).id)
      .eq('household_id', ctx.householdId)
    if (error) throw new Error(`meal_plan update: ${error.message}`)
    return 'updated'
  }

  const { error } = await ctx.db.from('meal_plan').insert({
    date,
    meal_type: mealType,
    meal_id: mealId,
    user_id: userId,
    household_id: ctx.householdId,
    is_consumed: false,
    is_skipped: false,
  })
  if (error) throw new Error(`meal_plan insert: ${error.message}`)
  return 'inserted'
}

function slotResult(
  ctx: McpContext,
  userId: string,
  date: string,
  mealType: MealCategory,
  meal: MealDetailed,
  action: string
) {
  return {
    date,
    meal_type: mealType,
    label_pl: MEAL_CATEGORY_LABELS_PL[mealType],
    user_id: userId,
    user_name: memberLabel(ctx, userId),
    meal_id: meal.id,
    meal_name: meal.name,
    kcal: kcalForMember(meal, userId),
    action,
  }
}

export function registerPlanTools(server: McpServer) {
  server.registerTool(
    'get_meal_plan',
    {
      title: 'Get meal plan',
      description:
        'Returns the meal plan for a date range, per day and per member: every planned slot with meal name, kcal for that member and consumed/skipped status, plus planned/consumed kcal totals and the enabled slots that are still empty.',
      inputSchema: {
        start_date: z.string().optional().describe('First day in YYYY-MM-DD format (default: today)'),
        end_date: z
          .string()
          .optional()
          .describe('Last day in YYYY-MM-DD format, inclusive (default: start_date + 6 days)'),
        users: z.array(z.string()).optional().describe(`${USERS_DESCRIPTION}. Default here: all members`),
      },
      annotations: READ_ONLY,
    },
    async ({ start_date, end_date, users }) =>
      run(async () => {
        const ctx = await loadContext()
        const start = assertDate(start_date || todayIso(), 'start_date')
        const end = assertDate(end_date || addDaysIso(start, 6), 'end_date')
        if (end < start) return fail('end_date must not be before start_date')
        const members = users && users.length > 0 ? resolveMembers(ctx, users) : ctx.members

        const { data, error } = await ctx.db
          .from('meal_plan')
          .select('id, date, meal_type, is_consumed, is_skipped, user_id, household_id, meal_id')
          .eq('household_id', ctx.householdId)
          .in(
            'user_id',
            members.map((m) => m.user_id)
          )
          .gte('date', start)
          .lte('date', end)
        if (error) throw new Error(`meal_plan: ${error.message}`)
        const rows = (data || []) as PlanRow[]

        const mealIds = Array.from(new Set(rows.map((r) => r.meal_id)))
        const meals = mealIds.length > 0 ? await loadMealsDetailed(ctx, mealIds) : []
        const mealMap = new Map(meals.map((m) => [m.id, m]))

        const days = eachDay(start, end).map((date) => ({
          date,
          members: members.map((member) => {
            const own = rows
              .filter((r) => r.date === date && r.user_id === member.user_id)
              .sort((a, b) => MEAL_CATEGORIES.indexOf(a.meal_type) - MEAL_CATEGORIES.indexOf(b.meal_type))
            const slots = own.map((r) => {
              const meal = mealMap.get(r.meal_id)
              return {
                meal_type: r.meal_type,
                label_pl: MEAL_CATEGORY_LABELS_PL[r.meal_type],
                meal_id: r.meal_id,
                meal_name: meal?.name ?? null,
                kcal: meal ? kcalForMember(meal, member.user_id) : 0,
                is_consumed: !!r.is_consumed,
                is_skipped: !!r.is_skipped,
              }
            })
            const filled = new Set(own.map((r) => r.meal_type))
            return {
              user_id: member.user_id,
              user_name: memberLabel(ctx, member.user_id),
              slots,
              planned_kcal: slots.filter((s) => !s.is_skipped).reduce((sum, s) => sum + s.kcal, 0),
              consumed_kcal: slots.filter((s) => s.is_consumed).reduce((sum, s) => sum + s.kcal, 0),
              empty_slots: enabledSlots(member)
                .filter((c) => !filled.has(c))
                .map((c) => ({ meal_type: c, label_pl: MEAL_CATEGORY_LABELS_PL[c] })),
            }
          }),
        }))

        return ok({ start_date: start, end_date: end, days })
      })
  )

  server.registerTool(
    'set_meal_plan_slot',
    {
      title: 'Plan a meal in a slot',
      description:
        'Puts a meal into a meal slot on a given day for one or more members. Replaces whatever was planned in that slot (status is reset to planned).',
      inputSchema: {
        date: dateField('Day'),
        meal_type: mealTypeField,
        meal_id: z.string().describe('Id of the meal to plan (from list_meals / search)'),
        users: usersField,
      },
      annotations: WRITE,
    },
    async ({ date, meal_type, meal_id, users }) =>
      run(async () => {
        const ctx = await loadContext()
        assertDate(date)
        const members = resolveMembers(ctx, users)
        const meals = await requireMeals(ctx, [meal_id])
        const meal = meals.get(meal_id)!

        const results = []
        for (const m of members) {
          const action = await setSlot(ctx, m.user_id, date, meal_type, meal_id)
          results.push(slotResult(ctx, m.user_id, date, meal_type, meal, action))
        }
        return ok({ results })
      })
  )

  server.registerTool(
    'plan_meals_bulk',
    {
      title: 'Plan many meals at once',
      description:
        'Sets many meal plan slots in one call (e.g. "ułóż plan na 4 dni"). Every date, member and meal id is validated before anything is written; each entry replaces what was planned in its slot.',
      inputSchema: {
        entries: z
          .array(
            z.object({
              date: dateField('Day'),
              meal_type: mealTypeField,
              meal_id: z.string().describe('Id of the meal to plan'),
              users: usersField,
            })
          )
          .min(1)
          .describe('Slots to set'),
      },
      annotations: WRITE,
    },
    async ({ entries }) =>
      run(async () => {
        const ctx = await loadContext()
        // Validate everything up front so nothing is written on bad input.
        const resolved = entries.map((e, i) => {
          assertDate(e.date, `entries[${i}].date`)
          return { ...e, members: resolveMembers(ctx, e.users) }
        })
        const meals = await requireMeals(
          ctx,
          entries.map((e) => e.meal_id)
        )

        const results = []
        for (const e of resolved) {
          const meal = meals.get(e.meal_id)!
          for (const m of e.members) {
            const action = await setSlot(ctx, m.user_id, e.date, e.meal_type, e.meal_id)
            results.push(slotResult(ctx, m.user_id, e.date, e.meal_type, meal, action))
          }
        }
        return ok({ written: results.length, results })
      })
  )

  server.registerTool(
    'clear_meal_plan_slot',
    {
      title: 'Clear meal plan slot',
      description: 'Removes the planned meal from a slot, or from every slot of the day when meal_type is omitted.',
      inputSchema: {
        date: dateField('Day'),
        meal_type: mealTypeField.optional().describe('Slot to clear; omit to clear the whole day'),
        users: usersField,
      },
      annotations: DESTRUCTIVE,
    },
    async ({ date, meal_type, users }) =>
      run(async () => {
        const ctx = await loadContext()
        assertDate(date)
        const members = resolveMembers(ctx, users)
        let query = ctx.db
          .from('meal_plan')
          .delete()
          .eq('household_id', ctx.householdId)
          .eq('date', date)
          .in(
            'user_id',
            members.map((m) => m.user_id)
          )
        if (meal_type) query = query.eq('meal_type', meal_type)
        const { data, error } = await query.select('id')
        if (error) throw new Error(`meal_plan delete: ${error.message}`)
        return ok({ deleted: (data || []).length })
      })
  )

  server.registerTool(
    'set_meal_plan_status',
    {
      title: 'Mark meal as eaten or skipped',
      description:
        'Changes the status of a planned meal: consumed (zjedzone), skipped (pominięte) or planned (reset). Setting one status clears the other.',
      inputSchema: {
        date: dateField('Day'),
        meal_type: mealTypeField,
        status: z
          .enum(['consumed', 'skipped', 'planned'])
          .describe('consumed = eaten, skipped = not eaten, planned = reset both flags'),
        users: usersField,
      },
      annotations: WRITE,
    },
    async ({ date, meal_type, status, users }) =>
      run(async () => {
        const ctx = await loadContext()
        assertDate(date)
        const members = resolveMembers(ctx, users)

        const { data, error } = await ctx.db
          .from('meal_plan')
          .select('id, user_id, meal_id')
          .eq('household_id', ctx.householdId)
          .eq('date', date)
          .eq('meal_type', meal_type)
          .in(
            'user_id',
            members.map((m) => m.user_id)
          )
        if (error) throw new Error(`meal_plan: ${error.message}`)
        const rows = (data || []) as Pick<PlanRow, 'id' | 'user_id' | 'meal_id'>[]
        const missing = members.filter((m) => !rows.some((r) => r.user_id === m.user_id))
        if (missing.length > 0) {
          return fail(
            `No meal planned for ${missing.map((m) => memberLabel(ctx, m.user_id)).join(', ')} on ${date} (${MEAL_CATEGORY_LABELS_PL[meal_type]}). Plan it first with set_meal_plan_slot.`
          )
        }

        const patch = {
          is_consumed: status === 'consumed',
          is_skipped: status === 'skipped',
        }
        const { error: updateError } = await ctx.db
          .from('meal_plan')
          .update(patch)
          .eq('household_id', ctx.householdId)
          .in(
            'id',
            rows.map((r) => r.id)
          )
        if (updateError) throw new Error(`meal_plan update: ${updateError.message}`)

        const meals = await loadMealsDetailed(ctx, Array.from(new Set(rows.map((r) => r.meal_id))))
        const mealMap = new Map(meals.map((m) => [m.id, m]))
        return ok({
          status,
          results: rows.map((r) => {
            const meal = mealMap.get(r.meal_id)
            return {
              user_id: r.user_id,
              user_name: memberLabel(ctx, r.user_id),
              date,
              meal_type,
              label_pl: MEAL_CATEGORY_LABELS_PL[meal_type],
              meal_name: meal?.name ?? null,
              kcal: meal ? kcalForMember(meal, r.user_id) : 0,
              ...patch,
            }
          }),
        })
      })
  )

  server.registerTool(
    'copy_meal_plan_day',
    {
      title: 'Copy a day of the meal plan',
      description:
        'Copies the meals planned on from_date for from_user to to_date for to_users (e.g. "skopiuj wczorajszy dzień" or "zjem to samo co domownik"). By default fills only slots that are empty on the target day; with replace=true the target day is cleared first. Status is reset to planned.',
      inputSchema: {
        from_date: dateField('Source day'),
        to_date: dateField('Target day'),
        from_user: z.string().optional().describe('Source member: "me" (default), a name, email or user_id'),
        to_users: z.array(z.string()).optional().describe(`Target members. ${USERS_DESCRIPTION}`),
        replace: z
          .boolean()
          .optional()
          .describe('true = delete the target day plan first and copy every slot (default false: fill only empty slots)'),
      },
      annotations: WRITE,
    },
    async ({ from_date, to_date, from_user, to_users, replace }) =>
      run(async () => {
        const ctx = await loadContext()
        assertDate(from_date, 'from_date')
        assertDate(to_date, 'to_date')
        const source = resolveMembers(ctx, from_user ? [from_user] : undefined)
        if (source.length !== 1) return fail('from_user must reference exactly one member')
        const sourceId = source[0].user_id
        const targets = resolveMembers(ctx, to_users)

        const { data: sourceData, error: sourceError } = await ctx.db
          .from('meal_plan')
          .select('id, meal_type, meal_id')
          .eq('household_id', ctx.householdId)
          .eq('user_id', sourceId)
          .eq('date', from_date)
        if (sourceError) throw new Error(`meal_plan: ${sourceError.message}`)
        const sourceRows = (sourceData || []) as Pick<PlanRow, 'id' | 'meal_type' | 'meal_id'>[]
        if (sourceRows.length === 0) {
          return fail(`${memberLabel(ctx, sourceId)} has nothing planned on ${from_date}`)
        }
        // One row per slot (mirrors getUniquePlansByMealType in the UI)
        const bySlot = new Map<MealCategory, string>()
        for (const r of sourceRows) if (!bySlot.has(r.meal_type)) bySlot.set(r.meal_type, r.meal_id)

        const meals = await loadMealsDetailed(ctx, Array.from(new Set(bySlot.values())))
        const mealMap = new Map(meals.map((m) => [m.id, m]))

        const copied: Record<string, unknown>[] = []
        const skipped: Record<string, unknown>[] = []

        for (const target of targets) {
          if (target.user_id === sourceId && from_date === to_date) {
            skipped.push({
              user_id: target.user_id,
              user_name: memberLabel(ctx, target.user_id),
              reason: 'source and target are the same',
            })
            continue
          }

          if (replace) {
            const { error } = await ctx.db
              .from('meal_plan')
              .delete()
              .eq('household_id', ctx.householdId)
              .eq('user_id', target.user_id)
              .eq('date', to_date)
            if (error) throw new Error(`meal_plan delete: ${error.message}`)
          }

          const { data: existingData, error: existingError } = await ctx.db
            .from('meal_plan')
            .select('meal_type, meal_id')
            .eq('household_id', ctx.householdId)
            .eq('user_id', target.user_id)
            .eq('date', to_date)
          if (existingError) throw new Error(`meal_plan: ${existingError.message}`)
          const existing = new Map(
            ((existingData || []) as Pick<PlanRow, 'meal_type' | 'meal_id'>[]).map((r) => [r.meal_type, r.meal_id])
          )

          const toInsert = []
          for (const [mealType, mealId] of bySlot) {
            const meal = mealMap.get(mealId)
            const info = {
              user_id: target.user_id,
              user_name: memberLabel(ctx, target.user_id),
              meal_type: mealType,
              label_pl: MEAL_CATEGORY_LABELS_PL[mealType],
              meal_id: mealId,
              meal_name: meal?.name ?? null,
            }
            const existingMealId = existing.get(mealType)
            if (existingMealId) {
              skipped.push({ ...info, reason: 'slot already planned', existing_meal_id: existingMealId })
              continue
            }
            toInsert.push({
              user_id: target.user_id,
              household_id: ctx.householdId,
              date: to_date,
              meal_id: mealId,
              meal_type: mealType,
              is_consumed: false,
              is_skipped: false,
            })
            copied.push({ ...info, kcal: meal ? kcalForMember(meal, target.user_id) : 0 })
          }

          if (toInsert.length > 0) {
            const { error } = await ctx.db.from('meal_plan').insert(toInsert)
            if (error) throw new Error(`meal_plan insert: ${error.message}`)
          }
        }

        return ok({
          from: { date: from_date, user_id: sourceId, user_name: memberLabel(ctx, sourceId) },
          to_date,
          replace: !!replace,
          copied,
          skipped,
          hint: skipped.length > 0 && !replace ? 'Use replace=true to overwrite already planned slots.' : undefined,
        })
      })
  )
}
