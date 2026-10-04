import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import type { Tag } from '@/lib/supabase/client'
import { loadContext } from '../context'
import { loadTags } from '../data'
import { fail, ok, READ_ONLY, run, WRITE } from '../respond'

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/

export function registerTagTools(server: McpServer) {
  server.registerTool(
    'list_tags',
    {
      title: 'List tags',
      description:
        'Lists the meal tags (tagi) defined in the household, e.g. "szybkie", "wege". Use these names in create_meal / update_meal tag_names and in list_meals tag filter.',
      inputSchema: {},
      annotations: READ_ONLY,
    },
    async () =>
      run(async () => {
        const ctx = await loadContext()
        const tags = await loadTags(ctx)
        return ok({
          count: tags.length,
          tags: tags.map((t) => ({ id: t.id, name: t.name, color: t.color, text_color: t.text_color })),
        })
      })
  )

  server.registerTool(
    'create_tag',
    {
      title: 'Create tag',
      description:
        'Creates a new meal tag in the household. Only do this when the user explicitly asks for a new tag; prefer existing tags from list_tags.',
      inputSchema: {
        name: z.string().min(1).max(50).describe('Tag name in Polish, short (max 50 chars).'),
        color: z
          .string()
          .regex(HEX_COLOR)
          .optional()
          .describe('Background colour as #RRGGBB (default #3B82F6).'),
        text_color: z
          .string()
          .regex(HEX_COLOR)
          .optional()
          .describe('Text colour as #RRGGBB (default #FFFFFF).'),
      },
      annotations: WRITE,
    },
    async ({ name, color, text_color }) =>
      run(async () => {
        const ctx = await loadContext()
        const trimmed = name.trim()
        const existing = (await loadTags(ctx)).find((t) => t.name.toLowerCase() === trimmed.toLowerCase())
        if (existing) {
          return fail(`Tag "${existing.name}" already exists (id ${existing.id}).`)
        }

        const { data, error } = await ctx.db
          .from('tags')
          .insert({
            household_id: ctx.householdId,
            name: trimmed,
            color: color || '#3B82F6',
            text_color: text_color || '#FFFFFF',
          })
          .select()
          .single()
        if (error) throw new Error(`tags: ${error.message}`)

        const tag = data as Tag
        return ok({ created: true, tag: { id: tag.id, name: tag.name, color: tag.color, text_color: tag.text_color } })
      })
  )
}
