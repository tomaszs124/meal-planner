import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { loadContext, memberLabel, type McpContext } from '../context'
import { MEAL_CATEGORY_LABELS_PL } from '../data'
import { RECIPE_RULES, RECIPE_RULES_VERSION } from '../recipe-rules'
import { ok, READ_ONLY, run, text, WRITE } from '../respond'

/** Personal rules of every household member, appended to the shared rules. */
export function membersRulesSection(ctx: McpContext): string {
  const lines: string[] = ['', '## Zasady osobiste domowników (z Ustawień aplikacji)', '']
  lines.push(
    'Każdy domownik może mieć własne zasady. Przy wariancie posiłku dla danej osoby jej zasady mają pierwszeństwo przed ogólnymi widełkami powyżej. Gdy zasady dwóch osób są sprzeczne, zrób osobne warianty (member_variants), nie uśredniaj.',
    ''
  )
  for (const m of ctx.members) {
    const label = memberLabel(ctx, m.user_id) + (m.is_acting_user ? ' (ja)' : '')
    if (m.dietary_rules) {
      lines.push(`### ${label}`)
      lines.push(...m.dietary_rules.split(/\r?\n/).map((l) => l.trim()).filter(Boolean).map((l) => (l.startsWith('-') ? l : `- ${l}`)))
      lines.push('')
    } else {
      lines.push(`### ${label}`, '- (brak zasad osobistych)', '')
    }
  }
  return lines.join('\n')
}

export function registerHouseholdTools(server: McpServer) {
  server.registerTool(
    'get_household',
    {
      title: 'Household and members',
      description:
        'Returns the household, every member (with name, id, whether they are the acting user "me"), the meal slots each member has enabled and their personal dietary rules from Settings. Call this first to know who "ja" and "domownik" are.',
      inputSchema: {},
      annotations: READ_ONLY,
    },
    async () =>
      run(async () => {
        const ctx = await loadContext()
        return ok({
          household: { id: ctx.householdId, name: ctx.householdName },
          acting_user_id: ctx.actingUserId,
          members: ctx.members.map((m) => ({
            user_id: m.user_id,
            name: m.name,
            email: m.email,
            is_me: m.is_acting_user,
            enabled_meal_slots: [
              'breakfast',
              ...(m.settings.second_breakfast_enabled ? ['second_breakfast'] : []),
              ...(m.settings.lunch_enabled ? ['lunch'] : []),
              ...(m.settings.dinner_enabled ? ['dinner'] : []),
              ...(m.settings.snack_enabled ? ['snack'] : []),
            ],
            dietary_rules: m.dietary_rules,
          })),
          meal_slot_labels: MEAL_CATEGORY_LABELS_PL,
          hint: 'Pass members to other tools as "me", "all", a name, an email or a user_id. Respect each member\'s dietary_rules when proposing meals for them.',
        })
      })
  )

  server.registerTool(
    'get_recipe_rules',
    {
      title: 'Recipe rules',
      description:
        'Returns the household rules for creating and editing recipes (package sizes, calorie targets per meal slot, naming, member variants) followed by each member\'s personal dietary rules. Read them before proposing or saving any meal.',
      inputSchema: {},
      annotations: READ_ONLY,
    },
    async () =>
      run(async () => {
        const ctx = await loadContext()
        return text(RECIPE_RULES + membersRulesSection(ctx))
      })
  )

  server.registerTool(
    'set_my_dietary_rules',
    {
      title: 'Set my dietary rules',
      description:
        'Replaces the personal dietary rules of the acting user ("me") stored in Settings (free text, one rule per line, Polish). Use when the user says e.g. "zapamiętaj, że na śniadanie jem maks 2 jajka". Pass the complete new list; to add a rule, read the current ones from get_household first and resend all of them.',
      inputSchema: {
        rules: z
          .string()
          .max(2000)
          .describe('Complete rules text, one rule per line. Empty string clears the rules.'),
      },
      annotations: WRITE,
    },
    async ({ rules }) =>
      run(async () => {
        const ctx = await loadContext()
        const value = rules.trim() || null
        const { error } = await ctx.db
          .from('user_settings')
          .upsert({ user_id: ctx.actingUserId, dietary_rules: value }, { onConflict: 'user_id' })
        if (error) throw new Error(`user_settings: ${error.message}`)
        return ok({ updated: true, user: memberLabel(ctx, ctx.actingUserId), dietary_rules: value })
      })
  )

  server.registerResource(
    'recipe-rules',
    'meal-planner://rules/recipes',
    {
      title: 'Recipe rules',
      description: `Household recipe rules, version ${RECIPE_RULES_VERSION}`,
      mimeType: 'text/markdown',
    },
    async (uri) => {
      const ctx = await loadContext()
      return { contents: [{ uri: uri.href, mimeType: 'text/markdown', text: RECIPE_RULES + membersRulesSection(ctx) }] }
    }
  )
}
