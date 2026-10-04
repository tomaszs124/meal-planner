import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { loadContext } from '../context'
import { MEAL_CATEGORY_LABELS_PL } from '../data'
import { RECIPE_RULES, RECIPE_RULES_VERSION } from '../recipe-rules'
import { ok, READ_ONLY, run, text } from '../respond'

export function registerHouseholdTools(server: McpServer) {
  server.registerTool(
    'get_household',
    {
      title: 'Household and members',
      description:
        'Returns the household, every member (with name, id, whether they are the acting user "me") and the meal slots each member has enabled. Call this first to know who "ja" and "domownik" are.',
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
          })),
          meal_slot_labels: MEAL_CATEGORY_LABELS_PL,
          hint: 'Pass members to other tools as "me", "all", a name, an email or a user_id.',
        })
      })
  )

  server.registerTool(
    'get_recipe_rules',
    {
      title: 'Recipe rules',
      description:
        'Returns the household rules for creating and editing recipes (package sizes, calorie targets per meal slot, naming, member variants). Read them before proposing or saving any meal.',
      inputSchema: {},
      annotations: READ_ONLY,
    },
    async () => run(async () => text(RECIPE_RULES))
  )

  server.registerResource(
    'recipe-rules',
    'meal-planner://rules/recipes',
    {
      title: 'Recipe rules',
      description: `Household recipe rules, version ${RECIPE_RULES_VERSION}`,
      mimeType: 'text/markdown',
    },
    async (uri) => ({ contents: [{ uri: uri.href, mimeType: 'text/markdown', text: RECIPE_RULES }] })
  )
}
