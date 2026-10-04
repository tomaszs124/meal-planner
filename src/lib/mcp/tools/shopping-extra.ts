import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { loadContext } from '../context'
import { ok, run, WRITE } from '../respond'
import { stemOverlap } from '../text'

type ItemRow = {
  id: string
  name: string | null
  is_checked: boolean
  product: { name: string } | null
}

/**
 * "Wygeneruj listę na 4 dni, mam już orzechy, sól i masło": after generating, the
 * assistant checks off what the household already has. Matching is by word stems, so
 * "orzechy" also matches "Orzechy włoskie" and "masło" matches "Masło klarowane".
 */
export function registerShoppingExtraTools(server: McpServer) {
  server.registerTool(
    'check_shopping_items_by_name',
    {
      title: 'Check off shopping items by name',
      description:
        'Marks shopping list items as already bought/owned by product NAME (fuzzy, Polish inflections tolerated), e.g. names: ["orzechy", "sól", "masło"]. Use it right after generate_shopping_list when the user says they already have some ingredients ("mam już..."). Returns what was matched and what was not; ask the user about unmatched names if they look important.',
      inputSchema: {
        names: z.array(z.string().min(2)).min(1).max(50).describe('Product names the household already has.'),
        is_checked: z.boolean().optional().describe('true (default) = mark as bought/owned; false = unmark.'),
      },
      annotations: WRITE,
    },
    async ({ names, is_checked }) =>
      run(async () => {
        const ctx = await loadContext()
        const checked = is_checked ?? true
        const { data, error } = await ctx.db
          .from('shopping_list_items')
          .select('id, name, is_checked, product:products(name)')
          .eq('household_id', ctx.householdId)
        if (error) throw new Error(`shopping_list_items: ${error.message}`)
        const items = (data || []) as unknown as ItemRow[]

        const matched: { name: string; items: string[]; ids: string[] }[] = []
        const unmatched: string[] = []
        const idsToUpdate = new Set<string>()

        for (const wanted of names) {
          const hits = items.filter((item) => {
            const label = `${item.name ?? ''} ${item.product?.name ?? ''}`
            return stemOverlap(wanted, label) > 0
          })
          if (hits.length === 0) {
            unmatched.push(wanted)
            continue
          }
          hits.forEach((h) => idsToUpdate.add(h.id))
          matched.push({
            name: wanted,
            items: Array.from(new Set(hits.map((h) => h.product?.name || h.name || h.id))),
            ids: hits.map((h) => h.id),
          })
        }

        if (idsToUpdate.size > 0) {
          const { error: updateError } = await ctx.db
            .from('shopping_list_items')
            .update({
              is_checked: checked,
              checked_by: checked ? ctx.actingUserId : null,
              checked_at: checked ? new Date().toISOString() : null,
            })
            .in('id', Array.from(idsToUpdate))
            .eq('household_id', ctx.householdId)
          if (updateError) throw new Error(`shopping_list_items: ${updateError.message}`)
        }

        return ok({
          updated: idsToUpdate.size,
          is_checked: checked,
          matched,
          unmatched,
          hint:
            unmatched.length > 0
              ? 'Unmatched names are not on the list (maybe not needed for these meals) or are spelled differently; tell the user.'
              : 'All names matched.',
        })
      })
  )
}
