import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { RECIPE_RULES_VERSION } from './recipe-rules'
import { registerHouseholdTools } from './tools/household'
import { registerMealTools } from './tools/meals'
import { registerPlanTools } from './tools/plan'
import { registerProductTools } from './tools/products'
import { registerSearchTools } from './tools/search'
import { registerShoppingTools } from './tools/shopping'
import { registerTagTools } from './tools/tags'
import { registerTodayTools } from './tools/today'
import { registerImageTools } from './tools/images'
import { registerShoppingExtraTools } from './tools/shopping-extra'

const INSTRUCTIONS = `Meal Planner connector for a two-person household. The end user speaks Polish; answer in Polish.

Disambiguation: when the user asks about a meal for a day ("dzisiejszy obiad", "co mam na śniadanie", "przepis na jutrzejszą kolację", "co jemy dziś"), they mean the meal ALREADY in the plan. Call get_my_planned_meal first and present that recipe. Invent or create a new recipe only when they ask for a new idea, or when the slot is empty (then ask whether to pick an existing meal or create one). "Dzisiaj" is the household's local date (Europe/Warsaw), returned by the tools.
Any question about a specific dish (how long to bake, what is in it, how to make it, "ile się piecze kurczaka w zalewie musztardowo-miodowej") refers to the household's SAVED recipes: call find_recipe first and answer from its preparation/ingredients. Fall back to general cooking knowledge only when nothing matches, and say that explicitly.
Workflow for new recipes: get_household → get_recipe_rules → list_products (reuse existing products) → preview_meal_nutrition (fix every "off" package warning) → show the summary → create_meal after the user agrees → set_meal_image right away unless the user said no picture or gave an image URL; always pass an English visual "prompt" describing how the dish looks (the free generator does not understand Polish names). If the user dislikes the picture: remove_meal_image, then set_meal_image with a better prompt. ChatGPT cannot pass its own generated images to tools; if the user wants a specific picture they upload it in the app.
Shopping: for "wygeneruj listę zakupów na X dni, mam już A, B, C" call generate_shopping_list for the date range (today + X days, all members unless told otherwise), then check_shopping_items_by_name with [A, B, C], then summarise what is left to buy and what did not match.
Rules of thumb: combined amounts for both members must use a whole, half or quarter retail package (package_size on the product); cook the same dish for 2 days rather than leaving a partial package; stay close to the calorie targets per meal slot.
Each member may have personal dietary rules (Settings → "Moje zasady żywieniowe"); get_household and get_recipe_rules return them. They override the general calorie ranges for that member's variant; conflicting rules between members mean separate member_variants. The user can ask you to remember a rule: use set_my_dietary_rules (acting user only).
Use list_* / search tools to obtain ids; never invent them. Writes that delete or replace data (delete_*, clear_*, update_meal with items) need explicit user confirmation.
Rules version: ${RECIPE_RULES_VERSION}.`

/**
 * Builds a fresh MCP server instance. Called per HTTP request (stateless mode),
 * which keeps the Next.js route handler free of shared mutable state.
 */
export function createMcpServer(): McpServer {
  const server = new McpServer(
    { name: 'meal-planner', version: '0.1.0' },
    { instructions: INSTRUCTIONS }
  )

  registerHouseholdTools(server)
  registerTodayTools(server)
  registerProductTools(server)
  registerMealTools(server)
  registerTagTools(server)
  registerPlanTools(server)
  registerShoppingTools(server)
  registerShoppingExtraTools(server)
  registerImageTools(server)
  registerSearchTools(server)

  return server
}
