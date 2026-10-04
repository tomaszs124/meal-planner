#!/usr/bin/env node
/**
 * Recipe analysis for the MCP recipe rules (src/lib/mcp/recipe-rules.ts).
 *
 * Reads the household's products, meals, per-member overrides and the meal plan,
 * then writes a Markdown report (Polish) with calorie ranges, typical amounts,
 * package usage ("clean" whole / half / quarter package for 2 people) and
 * "cook for 2 days" evidence.
 *
 * Usage:
 *   node scripts/analyze-recipes.mjs [--household <uuid>] [--out <path>] [--json <path>]
 *   node scripts/analyze-recipes.mjs --fixture scripts/fixtures/analyze-recipes.sample.json --out <path>
 *
 * Env (from .env.local or process.env): NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.
 * The service role key bypasses RLS; the script only READS data.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PROJECT_ROOT = path.resolve(__dirname, '..')

const PLAN_DAYS = 90
const CLEAN_FRACTIONS = [0.25, 0.5, 0.75, 1]
const CLEAN_TOLERANCE = 0.02 // in packages, same as checkPackageUsage() in src/lib/mcp/nutrition.ts

const TABLES = [
  'households',
  'household_users',
  'user_settings',
  'products',
  'meals',
  'meal_items',
  'meal_item_overrides',
  'meal_plan',
  'tags',
  'meal_tags',
]

export const MEAL_CATEGORIES = ['breakfast', 'second_breakfast', 'lunch', 'dinner', 'snack']
export const CATEGORY_LABELS_PL = {
  breakfast: 'śniadanie',
  second_breakfast: 'drugie śniadanie',
  lunch: 'obiad',
  dinner: 'kolacja',
  snack: 'przekąska',
  none: 'bez kategorii',
}
export const UNIT_LABELS_PL = {
  '100g': 'g',
  piece: 'szt.',
  tablespoon: 'łyżka',
  teaspoon: 'łyżeczka',
  leaf: 'liść',
  cube: 'kostka',
  slice: 'plaster',
}

// ---------------------------------------------------------------------------
// CLI / env
// ---------------------------------------------------------------------------

export function parseArgs(argv) {
  const args = { household: null, out: 'docs/mcp/analysis-output.md', json: null, fixture: null, help: false }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    const next = () => {
      const v = argv[++i]
      if (v === undefined || v.startsWith('--')) throw new Error(`Brak wartości dla ${a}`)
      return v
    }
    if (a === '--household') args.household = next()
    else if (a === '--out') args.out = next()
    else if (a === '--json') args.json = next()
    else if (a === '--fixture') args.fixture = next()
    else if (a === '--help' || a === '-h') args.help = true
    else throw new Error(`Nieznany argument: ${a}`)
  }
  return args
}

/** Minimal KEY=VALUE parser (comments, blank lines, optional quotes, optional "export "). */
export function parseDotEnv(text) {
  const out = {}
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue
    const m = line.match(/^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/)
    if (!m) continue
    let value = m[2].trim()
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    } else {
      const hash = value.indexOf(' #')
      if (hash >= 0) value = value.slice(0, hash).trim()
    }
    out[m[1]] = value
  }
  return out
}

function loadEnv() {
  const envPath = path.join(PROJECT_ROOT, '.env.local')
  const fileEnv = fs.existsSync(envPath) ? parseDotEnv(fs.readFileSync(envPath, 'utf8')) : {}
  const procEnv = Object.fromEntries(Object.entries(process.env).filter(([, v]) => v !== undefined && v !== ''))
  return { ...fileEnv, ...procEnv } // process.env wins over the file
}

// ---------------------------------------------------------------------------
// Data loading
// ---------------------------------------------------------------------------

function isoDate(d) {
  return d.toISOString().slice(0, 10)
}

function chunk(arr, size) {
  const out = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

async function fetchAll(buildQuery, label) {
  const pageSize = 1000
  const rows = []
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await buildQuery().range(from, from + pageSize - 1)
    if (error) throw new Error(`Błąd pobierania ${label}: ${error.message}`)
    rows.push(...(data || []))
    if (!data || data.length < pageSize) break
  }
  return rows
}

async function fetchIn(db, table, column, ids) {
  const rows = []
  for (const part of chunk(ids, 100)) {
    rows.push(...(await fetchAll(() => db.from(table).select('*').in(column, part).order('id'), table)))
  }
  return rows
}

async function fetchFromSupabase(env, householdArg) {
  const url = env.NEXT_PUBLIC_SUPABASE_URL
  const key = env.SUPABASE_SERVICE_ROLE_KEY
  const missing = [!url && 'NEXT_PUBLIC_SUPABASE_URL', !key && 'SUPABASE_SERVICE_ROLE_KEY'].filter(Boolean)
  if (missing.length) {
    console.error(
      `Brak zmiennych środowiskowych: ${missing.join(', ')}.\n` +
        'Dodaj je do .env.local (klucz service role: Supabase Dashboard -> Project Settings -> API)\n' +
        'albo uruchom skrypt na danych testowych: --fixture scripts/fixtures/analyze-recipes.sample.json'
    )
    process.exit(1)
  }

  const { createClient } = await import('@supabase/supabase-js')
  const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })

  let query = db.from('households').select('*')
  query = householdArg ? query.eq('id', householdArg) : query.order('created_at', { ascending: true }).limit(1)
  const { data: households, error: hhError } = await query
  if (hhError) throw new Error(`Błąd pobierania households: ${hhError.message}`)
  if (!households?.length) {
    throw new Error(householdArg ? `Nie znaleziono gospodarstwa o id ${householdArg}` : 'W bazie nie ma żadnego gospodarstwa.')
  }
  const householdId = households[0].id

  const since = new Date()
  since.setDate(since.getDate() - PLAN_DAYS)

  const byHousehold = (table) =>
    fetchAll(() => db.from(table).select('*').eq('household_id', householdId).order('id'), table)

  const [household_users, products, meals, tags, meal_plan] = await Promise.all([
    byHousehold('household_users'),
    byHousehold('products'),
    byHousehold('meals'),
    byHousehold('tags'),
    fetchAll(
      () => db.from('meal_plan').select('*').eq('household_id', householdId).gte('date', isoDate(since)).order('id'),
      'meal_plan'
    ),
  ])

  const userIds = household_users.map((u) => u.user_id)
  const mealIds = meals.map((m) => m.id)

  const [user_settings, meal_items, meal_item_overrides, meal_tags] = await Promise.all([
    fetchIn(db, 'user_settings', 'user_id', userIds),
    fetchIn(db, 'meal_items', 'meal_id', mealIds),
    fetchIn(db, 'meal_item_overrides', 'meal_id', mealIds),
    fetchIn(db, 'meal_tags', 'meal_id', mealIds),
  ])

  return { households, household_users, user_settings, products, meals, meal_items, meal_item_overrides, meal_plan, tags, meal_tags }
}

function loadFixture(fixturePath) {
  const abs = path.resolve(process.cwd(), fixturePath)
  if (!fs.existsSync(abs)) {
    console.error(`Nie znaleziono pliku fixture: ${abs}`)
    process.exit(1)
  }
  const data = JSON.parse(fs.readFileSync(abs, 'utf8'))
  for (const key of TABLES) if (!Array.isArray(data[key])) data[key] = []
  return data
}

// ---------------------------------------------------------------------------
// Pure computation
// ---------------------------------------------------------------------------

const num = (v) => (v === null || v === undefined || v === '' ? null : Number(v))

export function round(n, digits = 1) {
  const f = Math.pow(10, digits)
  return Math.round(n * f) / f
}

/** Same formula as the UI and src/lib/mcp/nutrition.ts: values are per 100 g. */
export function gramsOf(amount, product) {
  return amount * (num(product.unit_weight_grams) || 1)
}

export function nutritionOf(amount, product, per100g) {
  return (gramsOf(amount, product) / 100) * (num(per100g) || 0)
}

/** Linear-interpolated percentile (p in 0..1). */
export function percentile(values, p) {
  if (!values.length) return null
  const s = [...values].sort((a, b) => a - b)
  const idx = (s.length - 1) * p
  const lo = Math.floor(idx)
  const hi = Math.ceil(idx)
  return s[lo] + (s[hi] - s[lo]) * (idx - lo)
}

export function describeStats(values) {
  if (!values.length) return { count: 0, mean: null, median: null, p25: null, p75: null, min: null, max: null }
  return {
    count: values.length,
    mean: values.reduce((a, b) => a + b, 0) / values.length,
    median: percentile(values, 0.5),
    p25: percentile(values, 0.25),
    p75: percentile(values, 0.75),
    min: Math.min(...values),
    max: Math.max(...values),
  }
}

/**
 * Package fraction check. Clean = within CLEAN_TOLERANCE packages of a whole
 * number or of whole + 0.25 / 0.5 / 0.75 / 1 (mirrors checkPackageUsage()).
 */
export function packageCheck(totalAmount, packageSize) {
  if (!packageSize || packageSize <= 0) return null
  const used = totalAmount / packageSize
  const whole = Math.floor(used)
  const candidates = [whole, ...CLEAN_FRACTIONS.map((f) => whole + f)].filter((c) => c > 0)
  const nearest = candidates.reduce((best, c) => (Math.abs(c - used) < Math.abs(best - used) ? c : best), candidates[0])
  const distance = Math.abs(nearest - used)
  return {
    fraction: used,
    nearest,
    distance,
    clean: distance <= CLEAN_TOLERANCE + 1e-9,
    nearest_clean_amount: nearest * packageSize,
  }
}

function groupBy(arr, keyFn) {
  const map = new Map()
  for (const x of arr) {
    const k = keyFn(x)
    if (!map.has(k)) map.set(k, [])
    map.get(k).push(x)
  }
  return map
}

function addDays(dateStr, days) {
  const d = new Date(`${dateStr}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

function countValues(arr) {
  const m = {}
  for (const v of arr) m[v] = (m[v] || 0) + 1
  return m
}

/**
 * Main analysis. `data` has the same shape as the fixture JSON (arrays of rows
 * per table). Returns a plain object, also used for the --json dump.
 */
export function analyze(data, { householdId = null } = {}) {
  const household =
    (householdId && data.households.find((h) => h.id === householdId)) ||
    [...data.households].sort((a, b) => String(a.created_at || '').localeCompare(String(b.created_at || '')))[0]
  if (!household) throw new Error('Brak gospodarstwa w danych.')
  const hid = household.id

  // Members (name from user_settings.name)
  const settingsByUser = new Map(data.user_settings.map((s) => [s.user_id, s]))
  const members = data.household_users
    .filter((hu) => hu.household_id === hid)
    .sort((a, b) => String(a.joined_at || '').localeCompare(String(b.joined_at || '')))
    .map((hu) => ({
      user_id: hu.user_id,
      role: hu.role || 'member',
      name: settingsByUser.get(hu.user_id)?.name || `użytkownik ${String(hu.user_id).slice(0, 8)}`,
    }))
  const memberIds = new Set(members.map((m) => m.user_id))

  // Household-scoped tables
  const products = data.products.filter((p) => p.household_id === hid)
  const productById = new Map(products.map((p) => [p.id, p]))
  const meals = data.meals.filter((m) => m.household_id === hid)
  const mealIds = new Set(meals.map((m) => m.id))
  const mealItems = data.meal_items.filter((i) => mealIds.has(i.meal_id))
  const overrides = data.meal_item_overrides.filter((o) => mealIds.has(o.meal_id))
  const plan = data.meal_plan.filter((p) => p.household_id === hid)
  const tags = data.tags.filter((t) => t.household_id === hid)
  const tagById = new Map(tags.map((t) => [t.id, t]))
  const mealTags = data.meal_tags.filter((mt) => mealIds.has(mt.meal_id))

  const itemsByMeal = groupBy(mealItems, (i) => i.meal_id)
  const overridesByMeal = groupBy(overrides, (o) => o.meal_id)
  const overridesByMealUser = groupBy(overrides, (o) => `${o.meal_id}|${o.user_id}`)
  const tagsByMeal = groupBy(mealTags, (mt) => mt.meal_id)

  const mealReports = []
  const ingredientChecks = [] // (meal, product) rows with a known package size
  const productMealUsage = new Map() // product_id -> Set(meal_id)
  const amountsByProduct = new Map() // product_id -> Map(amount -> count)

  for (const meal of [...meals].sort((a, b) => String(a.name).localeCompare(String(b.name), 'pl'))) {
    const baseItems = itemsByMeal.get(meal.id) || []

    // Override rows REPLACE the base list for that member (same as the app).
    const perMember = members.map((m) => {
      const ov = overridesByMealUser.get(`${meal.id}|${m.user_id}`) || []
      const usesOverride = ov.length > 0
      let kcal = 0
      let protein = 0
      const items = (usesOverride ? ov : baseItems).map((r) => {
        const product = productById.get(r.product_id)
        const amount = Number(r.amount)
        if (product) {
          kcal += nutritionOf(amount, product, product.kcal_per_unit)
          protein += nutritionOf(amount, product, product.protein)
        }
        return { product_id: r.product_id, amount }
      })
      return { user_id: m.user_id, name: m.name, uses_override: usesOverride, kcal, protein, items }
    })

    let baseKcal = 0
    let baseProtein = 0
    for (const r of baseItems) {
      const product = productById.get(r.product_id)
      if (!product) continue
      baseKcal += nutritionOf(Number(r.amount), product, product.kcal_per_unit)
      baseProtein += nutritionOf(Number(r.amount), product, product.protein)
    }

    // Product order: base list first, then products that appear only in overrides
    const productOrder = [...new Set([...baseItems.map((r) => r.product_id), ...perMember.flatMap((pm) => pm.items.map((i) => i.product_id))])]

    const ingredients = productOrder.map((pid) => {
      const product = productById.get(pid)
      const amounts = perMember.map((pm) => pm.items.filter((i) => i.product_id === pid).reduce((s, i) => s + i.amount, 0))
      const combined = amounts.reduce((a, b) => a + b, 0)
      const packageSize = product ? num(product.package_size) : null
      const row = {
        product_id: pid,
        product_name: product ? product.name : `(brak produktu ${String(pid).slice(0, 8)})`,
        unit: product ? UNIT_LABELS_PL[product.unit_type] || product.unit_type : '?',
        amounts_per_member: amounts,
        combined,
        grams: product ? gramsOf(combined, product) : null,
        package_size: packageSize,
        check: packageCheck(combined, packageSize),
        check_2_days: packageCheck(combined * 2, packageSize),
      }
      if (row.check) ingredientChecks.push({ meal_id: meal.id, meal_name: meal.name, ...row })
      return row
    })

    // Usage + typical amounts: rows exactly as entered (base and overrides)
    for (const r of [...baseItems, ...(overridesByMeal.get(meal.id) || [])]) {
      if (!productMealUsage.has(r.product_id)) productMealUsage.set(r.product_id, new Set())
      productMealUsage.get(r.product_id).add(meal.id)
      if (!amountsByProduct.has(r.product_id)) amountsByProduct.set(r.product_id, new Map())
      const am = amountsByProduct.get(r.product_id)
      const key = Number(r.amount)
      am.set(key, (am.get(key) || 0) + 1)
    }

    mealReports.push({
      meal_id: meal.id,
      name: meal.name,
      primary_category: meal.primary_category || null,
      alternative_categories: meal.alternative_categories || [],
      tags: (tagsByMeal.get(meal.id) || []).map((mt) => tagById.get(mt.tag_id)?.name).filter(Boolean),
      base: { kcal: baseKcal, protein: baseProtein },
      per_member: perMember.map(({ items, ...rest }) => rest),
      ingredients,
    })
  }

  // Category stats per member and for everyone together
  const categoryStats = {}
  for (const cat of [...MEAL_CATEGORIES, 'none']) {
    const inCat = mealReports.filter((m) => (m.primary_category || 'none') === cat)
    if (!inCat.length) continue
    const byMember = members.map((mem) => {
      const vals = inCat.map((m) => m.per_member.find((pm) => pm.user_id === mem.user_id)).filter(Boolean)
      return {
        user_id: mem.user_id,
        name: mem.name,
        kcal: describeStats(vals.map((v) => v.kcal)),
        protein: describeStats(vals.map((v) => v.protein)),
      }
    })
    const all = inCat.flatMap((m) => m.per_member)
    categoryStats[cat] = {
      meals: inCat.length,
      by_member: byMember,
      all: { kcal: describeStats(all.map((v) => v.kcal)), protein: describeStats(all.map((v) => v.protein)) },
    }
  }

  // Products without package size, by usage
  const usageCount = (pid) => productMealUsage.get(pid)?.size || 0
  const unitOf = (p) => UNIT_LABELS_PL[p.unit_type] || p.unit_type
  const missingPackageUsed = products
    .filter((p) => !num(p.package_size) && usageCount(p.id) > 0)
    .map((p) => ({ id: p.id, name: p.name, category: p.category || 'inne', unit: unitOf(p), meals: usageCount(p.id) }))
    .sort((a, b) => b.meals - a.meals || a.name.localeCompare(b.name, 'pl'))
  const missingByCategory = {}
  for (const p of missingPackageUsed) (missingByCategory[p.category] ||= []).push(p)

  // Typical amounts for products used in >= 2 meals
  const typicalAmounts = products
    .filter((p) => usageCount(p.id) >= 2)
    .map((p) => {
      const amounts = [...(amountsByProduct.get(p.id) || new Map()).entries()]
        .sort((a, b) => a[0] - b[0])
        .map(([amount, count]) => ({ amount, count }))
      const mostCommon = [...amounts].sort((a, b) => b.count - a.count || a.amount - b.amount)[0]
      return {
        id: p.id,
        name: p.name,
        unit: unitOf(p),
        meals: usageCount(p.id),
        package_size: num(p.package_size),
        amounts,
        most_common: mostCommon ? mostCommon.amount : null,
      }
    })
    .sort((a, b) => b.meals - a.meals || a.name.localeCompare(b.name, 'pl'))

  // Package rule summary
  const cleanCount = ingredientChecks.filter((c) => c.check.clean).length
  const offenders = ingredientChecks.filter((c) => !c.check.clean).sort((a, b) => b.check.distance - a.check.distance)

  return {
    generated_at: new Date().toISOString(),
    household: { id: hid, name: household.name },
    members,
    counts: {
      products: products.length,
      products_with_package_size: products.filter((p) => num(p.package_size)).length,
      meals: meals.length,
      meal_items: mealItems.length,
      meal_item_overrides: overrides.length,
      plan_rows: plan.length,
      tags: tags.length,
      plan_rows_outside_members: plan.filter((p) => !memberIds.has(p.user_id)).length,
    },
    products: {
      missing_package_used: missingPackageUsed,
      missing_package_by_category: missingByCategory,
      missing_package_unused: products.filter((p) => !num(p.package_size) && usageCount(p.id) === 0).length,
    },
    meals: mealReports,
    category_stats: categoryStats,
    typical_amounts: typicalAmounts,
    package_rule: {
      ingredient_rows_total: mealReports.reduce((s, m) => s + m.ingredients.length, 0),
      checked: ingredientChecks.length,
      clean: cleanCount,
      clean_share: ingredientChecks.length ? cleanCount / ingredientChecks.length : null,
      clean_only_when_2_days: offenders.filter((c) => c.check_2_days?.clean).length,
      offenders,
    },
    streaks: analyzeStreaks(plan, members, meals),
  }
}

/** Same meal for the same user on consecutive days = evidence for cooking for 2 days. */
export function analyzeStreaks(plan, members, meals) {
  const mealName = new Map(meals.map((m) => [m.id, m.name]))
  const perMember = new Map(members.map((m) => [m.user_id, { name: m.name, rows: 0, pairs: 0 }]))
  const perMeal = new Map()
  const runLengths = []
  let pairs = 0
  let rowsInRuns = 0

  for (const [key, rows] of groupBy(plan, (p) => `${p.user_id}|${p.meal_id}`)) {
    const [userId, mealId] = key.split('|')
    const dates = [...new Set(rows.map((r) => String(r.date).slice(0, 10)))].sort()
    const pm = perMember.get(userId) || { name: `spoza gospodarstwa ${userId.slice(0, 8)}`, rows: 0, pairs: 0 }
    pm.rows += rows.length
    perMember.set(userId, pm)

    let run = 1
    const flush = () => {
      if (run >= 2) {
        runLengths.push(run)
        rowsInRuns += run
      }
      run = 1
    }
    for (let i = 1; i < dates.length; i++) {
      if (addDays(dates[i - 1], 1) === dates[i]) {
        run++
        pairs++
        pm.pairs++
        const e = perMeal.get(mealId) || { meal_id: mealId, name: mealName.get(mealId) || mealId, pairs: 0 }
        e.pairs++
        perMeal.set(mealId, e)
      } else {
        flush()
      }
    }
    flush()
  }

  // Same meal for every member on the same day (cooked once for the household)
  const byDateMeal = groupBy(plan, (p) => `${String(p.date).slice(0, 10)}|${p.meal_id}`)
  let sharedDays = 0
  if (members.length > 1) {
    for (const rows of byDateMeal.values()) {
      if (members.every((m) => rows.some((r) => r.user_id === m.user_id))) sharedDays++
    }
  }

  const dates = plan.map((p) => String(p.date).slice(0, 10)).sort()
  return {
    plan_rows: plan.length,
    date_from: dates[0] || null,
    date_to: dates[dates.length - 1] || null,
    consecutive_pairs: pairs,
    rows_in_runs: rowsInRuns,
    rows_in_runs_share: plan.length ? rowsInRuns / plan.length : null,
    run_lengths: countValues(runLengths),
    per_member: [...perMember.values()],
    top_meals: [...perMeal.values()].sort((a, b) => b.pairs - a.pairs).slice(0, 15),
    same_meal_all_members_same_day: sharedDays,
    distinct_date_meal_pairs: byDateMeal.size,
  }
}

// ---------------------------------------------------------------------------
// Markdown rendering
// ---------------------------------------------------------------------------

function fmt(n, digits = 1) {
  if (n === null || n === undefined || Number.isNaN(n)) return '–'
  return String(round(n, digits)).replace('.', ',')
}
const pct = (x) => (x === null || x === undefined ? '–' : `${fmt(x * 100, 0)}%`)
const r10 = (x) => Math.round(x / 10) * 10
const esc = (s) => String(s ?? '').replace(/\|/g, '\\|').replace(/\r?\n/g, ' ')
const plain = (s) => String(s ?? '').replace(/\r?\n/g, ' ')

function table(headers, rows) {
  if (!rows.length) return '_brak danych_\n'
  return [
    `| ${headers.join(' | ')} |`,
    `| ${headers.map(() => '---').join(' | ')} |`,
    ...rows.map((r) => `| ${r.map(esc).join(' | ')} |`),
    '',
  ].join('\n')
}

function rangeLine(label, stats, unit, roundTo10 = true) {
  if (!stats || !stats.count) return `  - ${label}: brak danych`
  const lo = roundTo10 ? r10(stats.p25) : Math.round(stats.p25)
  const hi = roundTo10 ? r10(stats.p75) : Math.round(stats.p75)
  return `  - ${label}: ${lo}–${hi} ${unit} (n=${stats.count})`
}

export function renderMarkdown(r, { source = 'Supabase' } = {}) {
  const L = []
  const c = r.counts

  L.push(`# Analiza przepisów: ${plain(r.household.name)}`)
  L.push('')
  L.push(`Wygenerowano: ${r.generated_at} · źródło: ${source} · skrypt: \`scripts/analyze-recipes.mjs\``)
  L.push('')
  L.push(
    'Raport służy do uzupełnienia sekcji `TODO(Tomasz)` w `src/lib/mcp/recipe-rules.ts`. Kalorie liczone jak w aplikacji: gramy = ilość × (waga jednostki || 1), wartość = gramy / 100 × wartość na 100 g. Jeśli domownik ma własny wariant posiłku, jego wiersze zastępują listę bazową.'
  )
  L.push('')

  // 1
  L.push('## 1. Domownicy i liczby')
  L.push('')
  L.push(table(['Imię', 'Rola', 'user_id'], r.members.map((m) => [m.name, m.role, `\`${m.user_id}\``])))
  L.push(`- Gospodarstwo: **${plain(r.household.name)}** (\`${r.household.id}\`)`)
  L.push(`- Produkty: **${c.products}** (z wielkością opakowania: ${c.products_with_package_size})`)
  L.push(`- Posiłki: **${c.meals}** (składników bazowych: ${c.meal_items}, wierszy wariantów domowników: ${c.meal_item_overrides})`)
  L.push(`- Wpisy w planie: **${c.plan_rows}** (z bazy pobierane są ostatnie ${PLAN_DAYS} dni)`)
  L.push(`- Tagi: ${c.tags}`)
  if (c.plan_rows_outside_members) L.push(`- Uwaga: ${c.plan_rows_outside_members} wpisów planu należy do osób spoza gospodarstwa.`)
  L.push('')

  // 2
  L.push('## 2. Produkty bez wielkości opakowania')
  L.push('')
  L.push(
    `Wielkość opakowania (\`package_size\`) ma ${c.products_with_package_size} z ${c.products} produktów. Poniżej produkty **używane w przepisach**, które jej nie mają, od najczęściej używanych: te uzupełnij najpierw (zakładka Produkty). Produkty sprzedawane luzem (warzywa na wagę, przyprawy) można zostawić puste.`
  )
  L.push('')
  const cats = Object.keys(r.products.missing_package_by_category).sort((a, b) => a.localeCompare(b, 'pl'))
  if (!cats.length) L.push('_Wszystkie używane produkty mają wielkość opakowania._\n')
  for (const cat of cats) {
    L.push(`### ${plain(cat)}`)
    L.push('')
    L.push(table(['Produkt', 'Jednostka', 'Liczba przepisów'], r.products.missing_package_by_category[cat].map((p) => [p.name, p.unit, p.meals])))
  }
  L.push(`Nieużywanych produktów bez wielkości opakowania: ${r.products.missing_package_unused}.`)
  L.push('')

  // 3
  L.push('## 3. Posiłki')
  L.push('')
  L.push(
    'Ułamek opakowania = suma ilości wszystkich domowników / wielkość opakowania. „Czysty” = w granicach ±0,05 opakowania od 0,25 / 0,5 / 0,75 / 1 lub wielokrotności. Kolumna „×2 dni” pokazuje, czy ugotowanie tego samego na dwa dni daje czysty ułamek.'
  )
  L.push('')
  for (const m of r.meals) {
    const cat = m.primary_category ? CATEGORY_LABELS_PL[m.primary_category] || m.primary_category : 'bez kategorii'
    const alt = (m.alternative_categories || []).map((a) => CATEGORY_LABELS_PL[a] || a).join(', ')
    L.push(`### ${plain(m.name)}`)
    L.push('')
    L.push(`- Kategoria: **${cat}**${alt ? ` (też: ${alt})` : ''}`)
    L.push(`- Tagi: ${m.tags.length ? m.tags.map(plain).join(', ') : '–'}`)
    L.push(`- Bazowo: ${fmt(m.base.kcal, 0)} kcal, ${fmt(m.base.protein)} g białka`)
    for (const pm of m.per_member) {
      L.push(`- ${plain(pm.name)}: ${fmt(pm.kcal, 0)} kcal, ${fmt(pm.protein)} g białka ${pm.uses_override ? '(własny wariant)' : '(bazowy)'}`)
    }
    L.push('')
    const headers = ['Składnik', ...r.members.map((mm) => esc(mm.name)), 'Razem', 'Gramy razem', 'Opakowanie', 'Ułamek', 'Czysty?', '×2 dni']
    const rows = m.ingredients.map((i) => [
      i.product_name,
      ...i.amounts_per_member.map((a) => (a ? `${fmt(a, 2)} ${i.unit}` : '–')),
      `${fmt(i.combined, 2)} ${i.unit}`,
      i.grams === null ? '–' : `${fmt(i.grams, 0)} g`,
      i.package_size ? `${fmt(i.package_size, 2)} ${i.unit}` : '–',
      i.check ? fmt(i.check.fraction, 2) : '–',
      i.check ? (i.check.clean ? 'tak' : `nie (→ ${fmt(i.check.nearest_clean_amount, 1)} ${i.unit})`) : 'brak opak.',
      i.check_2_days ? (i.check_2_days.clean ? `tak (${fmt(i.check_2_days.fraction, 2)})` : 'nie') : '–',
    ])
    L.push(table(headers, rows))
  }

  // 4
  L.push('## 4. Statystyki kalorii i białka wg kategorii')
  L.push('')
  L.push('Na podstawie `primary_category` posiłku i ilości dla każdego domownika (z jego wariantem, jeśli istnieje).')
  L.push('')
  const statRows = []
  for (const [cat, s] of Object.entries(r.category_stats)) {
    for (const bm of s.by_member) {
      statRows.push([
        CATEGORY_LABELS_PL[cat] || cat,
        bm.name,
        bm.kcal.count,
        fmt(bm.kcal.mean, 0),
        fmt(bm.kcal.median, 0),
        fmt(bm.kcal.p25, 0),
        fmt(bm.kcal.p75, 0),
        fmt(bm.protein.mean),
        fmt(bm.protein.median),
        fmt(bm.protein.p25),
        fmt(bm.protein.p75),
      ])
    }
  }
  L.push(table(['Kategoria', 'Osoba', 'n', 'kcal śr.', 'kcal med.', 'kcal p25', 'kcal p75', 'białko śr.', 'białko med.', 'białko p25', 'białko p75'], statRows))

  L.push('### Gotowe do wklejenia do `recipe-rules.ts`')
  L.push('')
  L.push('Zakres p25–p75 zaokrąglony do 10 kcal. Najpierw wspólny (wszyscy domownicy razem), potem osobno dla każdej osoby; wybierz wariant, który lepiej opisuje zasadę. Przy małym n traktuj liczby ostrożnie.')
  L.push('')
  L.push('```text')
  L.push('Wspólnie:')
  for (const cat of MEAL_CATEGORIES) L.push(rangeLine(CATEGORY_LABELS_PL[cat], r.category_stats[cat]?.all.kcal, 'kcal'))
  for (const mem of r.members) {
    L.push(`${mem.name}:`)
    for (const cat of MEAL_CATEGORIES) {
      const bm = r.category_stats[cat]?.by_member.find((x) => x.user_id === mem.user_id)
      L.push(rangeLine(CATEGORY_LABELS_PL[cat], bm?.kcal, 'kcal'))
    }
  }
  L.push('')
  L.push('Białko na osobę (p25–p75):')
  for (const cat of MEAL_CATEGORIES) L.push(rangeLine(CATEGORY_LABELS_PL[cat], r.category_stats[cat]?.all.protein, 'g', false))
  L.push('```')
  L.push('')

  // 5
  L.push('## 5. Typowe ilości (produkty w co najmniej 2 przepisach)')
  L.push('')
  L.push(
    'Ilości tak, jak wpisano je w przepisach (bazowe i warianty domowników), w jednostce produktu; w nawiasie liczba wystąpień. Najczęstsza wartość to kandydat na „okrągłą” porcję na osobę.'
  )
  L.push('')
  L.push(
    table(
      ['Produkt', 'Jednostka', 'Przepisy', 'Opakowanie', 'Użyte ilości (liczba)', 'Najczęstsza'],
      r.typical_amounts.map((t) => [
        t.name,
        t.unit,
        t.meals,
        t.package_size ? fmt(t.package_size, 2) : '–',
        t.amounts.map((a) => `${fmt(a.amount, 2)} (${a.count})`).join(', '),
        t.most_common === null ? '–' : `${fmt(t.most_common, 2)} ${t.unit}`,
      ])
    )
  )
  if (r.typical_amounts.length) {
    L.push('Gotowe do wklejenia (najczęstsza ilość na osobę):')
    L.push('')
    L.push('```text')
    L.push(r.typical_amounts.map((t) => `${fmt(t.most_common, 2)} ${t.unit} ${t.name}`).join(', '))
    L.push('```')
    L.push('')
  }

  // 6
  const pr = r.package_rule
  L.push('## 6. Zasada opakowań: ile już jest spełnione')
  L.push('')
  L.push(`- Wszystkich pozycji składników (posiłek × produkt): ${pr.ingredient_rows_total}`)
  L.push(`- Ze znaną wielkością opakowania (sprawdzone): **${pr.checked}**`)
  L.push(`- Czyste (0,25 / 0,5 / 0,75 / 1 / wielokrotność): **${pr.clean}** (${pct(pr.clean_share)})`)
  L.push(`- Nieczyste, ale czyste przy gotowaniu na 2 dni: ${pr.clean_only_when_2_days}`)
  L.push('')
  L.push('### Najwięksi „winowajcy”')
  L.push('')
  L.push(
    table(
      ['Posiłek', 'Produkt', 'Razem', 'Opakowanie', 'Ułamek', 'Najbliższy czysty', 'Sugerowana ilość razem', '×2 dni czyste?'],
      pr.offenders.slice(0, 25).map((o) => [
        o.meal_name,
        o.product_name,
        `${fmt(o.combined, 2)} ${o.unit}`,
        `${fmt(o.package_size, 2)} ${o.unit}`,
        fmt(o.check.fraction, 2),
        fmt(o.check.nearest, 2),
        `${fmt(o.check.nearest_clean_amount, 1)} ${o.unit}`,
        o.check_2_days?.clean ? 'tak' : 'nie',
      ])
    )
  )

  // 7
  const s = r.streaks
  L.push('## 7. Ten sam posiłek w kolejnych dniach (gotowanie na 2 dni)')
  L.push('')
  L.push(`- Zakres planu: ${s.date_from || '–'} → ${s.date_to || '–'}, wpisów: ${s.plan_rows}`)
  L.push(`- Par „ta sama osoba, ten sam posiłek dzień po dniu”: **${s.consecutive_pairs}**`)
  L.push(`- Wpisy należące do serii ≥ 2 dni: **${s.rows_in_runs}** (${pct(s.rows_in_runs_share)} wszystkich wpisów)`)
  const rl = Object.entries(s.run_lengths).map(([len, n]) => `${len} dni: ${n}×`).join(', ')
  L.push(`- Długości serii: ${rl || '–'}`)
  L.push(`- Ten sam posiłek u wszystkich domowników tego samego dnia: ${s.same_meal_all_members_same_day} z ${s.distinct_date_meal_pairs} par (dzień, posiłek)`)
  L.push('')
  L.push(table(['Osoba', 'Wpisy', 'Pary dzień po dniu'], s.per_member.map((p) => [p.name, p.rows, p.pairs])))
  L.push('Najczęściej powtarzane dzień po dniu:')
  L.push('')
  L.push(table(['Posiłek', 'Pary dzień po dniu'], s.top_meals.map((t) => [t.name, t.pairs])))

  return L.join('\n')
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  let args
  try {
    args = parseArgs(process.argv.slice(2))
  } catch (e) {
    console.error(e.message)
    process.exit(2)
  }
  if (args.help) {
    console.log('Użycie: node scripts/analyze-recipes.mjs [--household <uuid>] [--out <plik.md>] [--json <plik.json>] [--fixture <plik.json>]')
    return
  }

  const data = args.fixture ? loadFixture(args.fixture) : await fetchFromSupabase(loadEnv(), args.household)
  const source = args.fixture ? `fixture ${args.fixture}` : 'Supabase'

  const result = analyze(data, { householdId: args.household })
  const outPath = path.resolve(process.cwd(), args.out)
  fs.mkdirSync(path.dirname(outPath), { recursive: true })
  fs.writeFileSync(outPath, renderMarkdown(result, { source }), 'utf8')

  if (args.json) {
    const jsonPath = path.resolve(process.cwd(), args.json)
    fs.mkdirSync(path.dirname(jsonPath), { recursive: true })
    fs.writeFileSync(jsonPath, JSON.stringify({ raw: data, analysis: result }, null, 2), 'utf8')
    console.log(`JSON zapisany: ${jsonPath}`)
  }

  const c = result.counts
  const pr = result.package_rule
  console.log(`Gospodarstwo: ${result.household.name} (${result.members.length} domowników: ${result.members.map((m) => m.name).join(', ')})`)
  console.log(`Produkty: ${c.products} (z opakowaniem: ${c.products_with_package_size}), posiłki: ${c.meals}, wpisy planu: ${c.plan_rows}`)
  console.log(`Zasada opakowań: ${pr.clean}/${pr.checked} czystych (${pct(pr.clean_share)}), pary dzień po dniu: ${result.streaks.consecutive_pairs}`)
  console.log(`Raport zapisany: ${outPath}`)
}

const isDirectRun = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isDirectRun) {
  main().catch((e) => {
    console.error(`Błąd: ${e.message}`)
    process.exit(1)
  })
}
