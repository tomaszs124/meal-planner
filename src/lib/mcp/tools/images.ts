import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import type { Meal } from '@/lib/supabase/client'
import { loadContext, type McpContext } from '../context'
import { loadMealDetailed } from '../data'
import { ok, READ_ONLY, run, WRITE } from '../respond'

/**
 * Meal pictures through the connector, without paid APIs:
 *  - `image_url`: any publicly reachable JPEG/PNG/WebP (user-provided or found by the assistant)
 *  - otherwise a free, keyless text-to-image service renders a photo of the dish from an
 *    English prompt built from the recipe (name + main ingredients).
 * The file is stored in the `meal-images` bucket under <household>/<meal>/ exactly like
 * uploads from the app, and a `meal_images` row is inserted (newest first on the card).
 */

const MAX_IMAGE_BYTES = 5 * 1024 * 1024
const FETCH_TIMEOUT_MS = 45_000
const ALLOWED_TYPES: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
}

function freeImageUrl(prompt: string, seed: number): string {
  // Pollinations.ai: free text-to-image, no key. Square food photo, no watermark/logo.
  const p = encodeURIComponent(prompt)
  return `https://image.pollinations.ai/prompt/${p}?width=1024&height=1024&nologo=true&seed=${seed}&model=flux`
}

export function buildFoodPrompt(name: string, ingredients: string[]): string {
  const main = ingredients.slice(0, 6).join(', ')
  return (
    `Appetizing overhead food photography of "${name}", a homemade Polish everyday dish` +
    (main ? ` with ${main}` : '') +
    ', served on a plate on a wooden table, natural daylight, shallow depth of field, no text, no people'
  )
}

async function fetchImage(url: string): Promise<{ bytes: Uint8Array; contentType: string; ext: string }> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
  try {
    const res = await fetch(url, { signal: controller.signal, redirect: 'follow', headers: { Accept: 'image/*' } })
    if (!res.ok) throw new Error(`image download failed: HTTP ${res.status}`)
    const contentType = (res.headers.get('content-type') || '').split(';')[0].trim().toLowerCase()
    const ext = ALLOWED_TYPES[contentType]
    if (!ext) throw new Error(`unsupported image type "${contentType || 'unknown'}" (JPEG, PNG or WebP only)`)
    const buf = new Uint8Array(await res.arrayBuffer())
    if (buf.byteLength === 0) throw new Error('image download returned an empty body')
    if (buf.byteLength > MAX_IMAGE_BYTES) throw new Error('image is larger than 5 MB')
    return { bytes: buf, contentType, ext }
  } finally {
    clearTimeout(timer)
  }
}

async function requireOwnMeal(ctx: McpContext, id: string): Promise<Meal> {
  const { data, error } = await ctx.db.from('meals').select('*').eq('id', id).eq('household_id', ctx.householdId).maybeSingle()
  if (error) throw new Error(`meals: ${error.message}`)
  if (!data) throw new Error(`Meal ${id} not found in this household. Use list_meals / find_recipe to find valid ids.`)
  return data as Meal
}

export function registerImageTools(server: McpServer) {
  server.registerTool(
    'set_meal_image',
    {
      title: 'Add a picture to a meal',
      description:
        'Attaches a picture to a saved meal, like uploading a photo in the app. Give `image_url` (a public JPEG/PNG/WebP, e.g. a link the user pasted) OR leave it empty to have a free image generated from the recipe (name + ingredients; optional `prompt` overrides the description, English works best). Call this automatically right after create_meal unless the user asked for no picture or provided one. The newest picture becomes the card image.',
      inputSchema: {
        meal_id: z.string().describe('Meal id (from create_meal / list_meals / find_recipe).'),
        image_url: z.string().url().optional().describe('Public image URL to download. Omit to generate one for free.'),
        prompt: z
          .string()
          .max(400)
          .optional()
          .describe('Optional English description of the dish for the generated image (used only when image_url is omitted).'),
      },
      annotations: WRITE,
    },
    async ({ meal_id, image_url, prompt }) =>
      run(async () => {
        const ctx = await loadContext()
        await requireOwnMeal(ctx, meal_id)
        const detail = await loadMealDetailed(ctx, meal_id)

        let source: string
        let generated = false
        if (image_url) {
          source = image_url
        } else {
          const ingredients = detail.base_items.map((i) => i.product_name)
          const text = prompt?.trim() || buildFoodPrompt(detail.name, ingredients)
          const seed = Math.floor(Math.random() * 1_000_000)
          source = freeImageUrl(text, seed)
          generated = true
        }

        const { bytes, contentType, ext } = await fetchImage(source)

        const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${ext}`
        const filePath = `${ctx.householdId}/${meal_id}/${fileName}`
        const { error: uploadError } = await ctx.db.storage
          .from('meal-images')
          .upload(filePath, bytes, { contentType, upsert: false })
        if (uploadError) throw new Error(`storage upload failed: ${uploadError.message}`)

        const { data: pub } = ctx.db.storage.from('meal-images').getPublicUrl(filePath)
        const publicUrl = pub.publicUrl

        const { error: insertError } = await ctx.db.from('meal_images').insert({
          meal_id,
          image_url: publicUrl,
          uploaded_by: ctx.actingUserId,
        })
        if (insertError) throw new Error(`meal_images: ${insertError.message}`)

        return ok({
          meal_id,
          meal_name: detail.name,
          image_url: publicUrl,
          generated,
          size_kb: Math.round(bytes.byteLength / 1024),
          hint: generated
            ? 'A free generated illustration; if the user dislikes it, call set_meal_image again (new random seed) or with a better prompt.'
            : 'Downloaded from the given URL.',
        })
      })
  )

  server.registerTool(
    'get_meal_images',
    {
      title: 'List pictures of a meal',
      description: 'Returns the pictures attached to a meal, newest first (the first one is shown on the card).',
      inputSchema: { meal_id: z.string().describe('Meal id.') },
      annotations: READ_ONLY,
    },
    async ({ meal_id }) =>
      run(async () => {
        const ctx = await loadContext()
        const detail = await loadMealDetailed(ctx, meal_id)
        const { data, error } = await ctx.db
          .from('meal_images')
          .select('id, image_url, uploaded_at, uploaded_by')
          .eq('meal_id', meal_id)
          .order('uploaded_at', { ascending: false })
        if (error) throw new Error(`meal_images: ${error.message}`)
        return ok({ meal_id, meal_name: detail.name, images: data ?? [] })
      })
  )
}
