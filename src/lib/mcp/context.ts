import { AsyncLocalStorage } from 'node:async_hooks'
import type { SupabaseClient } from '@supabase/supabase-js'
import { getAdminClient } from './supabase-admin'

export type MemberSettings = {
  second_breakfast_enabled: boolean
  lunch_enabled: boolean
  dinner_enabled: boolean
  snack_enabled: boolean
}

export type Member = {
  user_id: string
  name: string | null
  email: string | null
  is_acting_user: boolean
  settings: MemberSettings
  /** Free-text personal rules from Settings ("na śniadanie maks 2 jajka"), null when none */
  dietary_rules: string | null
}

export type McpContext = {
  db: SupabaseClient
  actingUserId: string
  householdId: string
  householdName: string
  members: Member[]
}

type HouseholdUserRow = { user_id: string; household_id: string }
type UserSettingsRow = {
  user_id: string
  name: string | null
  second_breakfast_enabled: boolean | null
  lunch_enabled: boolean | null
  dinner_enabled: boolean | null
  snack_enabled: boolean | null
  dietary_rules: string | null
}
type ProfileRow = { id: string; display_name: string | null }

/**
 * Who the current request acts as. The route handler resolves the access token
 * to a principal (one token per household member) and runs the MCP request inside
 * `actingUserStorage.run(principal, ...)`; tools then call `loadContext()` without
 * arguments. Falls back to MCP_ACTING_USER_ID / MCP_ACTING_USER_EMAIL when unset.
 */
export type ActingPrincipal = { userId?: string; email?: string }
export const actingUserStorage = new AsyncLocalStorage<ActingPrincipal>()

const resolvedIdByEmail = new Map<string, string>()
let emailCache: Map<string, string> | null = null

async function loadEmails(db: SupabaseClient): Promise<Map<string, string>> {
  if (emailCache) return emailCache
  const map = new Map<string, string>()
  const { data, error } = await db.auth.admin.listUsers({ perPage: 200 })
  if (error) {
    // Almost always a wrong/missing/multi-line SUPABASE_SERVICE_ROLE_KEY (the admin API
    // rejects other keys). Log the detail server-side only: the message can echo the header.
    console.error('MCP: Supabase admin listUsers failed:', error.status, error.message)
    const hint = /header value/i.test(error.message)
      ? 'The key contains a newline or extra text (paste the single-line key only).'
      : `HTTP ${error.status ?? '?'}: check that it is the service_role key.`
    throw new Error(`MCP: cannot list users via Supabase admin API. SUPABASE_SERVICE_ROLE_KEY problem. ${hint}`)
  }
  for (const u of data?.users ?? []) {
    if (u.email) map.set(u.id, u.email)
  }
  emailCache = map
  return map
}

async function resolveActingUserId(db: SupabaseClient): Promise<string> {
  const principal = actingUserStorage.getStore()

  const userId = principal?.userId?.trim() || process.env.MCP_ACTING_USER_ID?.trim()
  if (userId) return userId

  const email = (principal?.email || process.env.MCP_ACTING_USER_EMAIL || '').trim().toLowerCase()
  if (!email) {
    throw new Error('MCP: no acting user for this token (set MCP_ACCESS_TOKENS or MCP_ACTING_USER_EMAIL)')
  }

  const cached = resolvedIdByEmail.get(email)
  if (cached) return cached

  const emails = await loadEmails(db)
  for (const [id, e] of emails) {
    if (e.toLowerCase() === email) {
      resolvedIdByEmail.set(email, id)
      return id
    }
  }
  throw new Error(`MCP: no Supabase user found with email ${email}`)
}

/**
 * Resolves the acting user, their household and all household members.
 * Called once per tool invocation (cheap: 4 small queries).
 */
export async function loadContext(): Promise<McpContext> {
  const db = getAdminClient()
  const actingUserId = await resolveActingUserId(db)

  const { data: membership, error: membershipError } = await db
    .from('household_users')
    .select('user_id, household_id')
    .eq('user_id', actingUserId)
    .limit(1)
    .maybeSingle()

  if (membershipError) throw new Error(`MCP: household lookup failed: ${membershipError.message}`)
  if (!membership) throw new Error('MCP: acting user does not belong to any household')

  const householdId = (membership as HouseholdUserRow).household_id

  const [{ data: household }, { data: memberRows }] = await Promise.all([
    db.from('households').select('id, name').eq('id', householdId).single(),
    db.from('household_users').select('user_id, household_id').eq('household_id', householdId),
  ])

  const memberIds = ((memberRows || []) as HouseholdUserRow[]).map((m) => m.user_id)

  const [{ data: settingsRows }, { data: profileRows }, emails] = await Promise.all([
    db
      .from('user_settings')
      .select('user_id, name, second_breakfast_enabled, lunch_enabled, dinner_enabled, snack_enabled, dietary_rules')
      .in('user_id', memberIds),
    db.from('profiles').select('id, display_name').in('id', memberIds),
    loadEmails(db),
  ])

  const settingsMap = new Map(((settingsRows || []) as UserSettingsRow[]).map((s) => [s.user_id, s]))
  const profileMap = new Map(((profileRows || []) as ProfileRow[]).map((p) => [p.id, p.display_name]))

  const members: Member[] = memberIds.map((id) => {
    const s = settingsMap.get(id)
    return {
      user_id: id,
      name: s?.name || profileMap.get(id) || null,
      email: emails.get(id) || null,
      is_acting_user: id === actingUserId,
      settings: {
        second_breakfast_enabled: s?.second_breakfast_enabled ?? true,
        lunch_enabled: s?.lunch_enabled ?? true,
        dinner_enabled: s?.dinner_enabled ?? true,
        snack_enabled: s?.snack_enabled ?? false,
      },
      dietary_rules: s?.dietary_rules?.trim() || null,
    }
  })

  // Acting user first, then the rest in a stable order
  members.sort((a, b) => Number(b.is_acting_user) - Number(a.is_acting_user) || a.user_id.localeCompare(b.user_id))

  return {
    db,
    actingUserId,
    householdId,
    householdName: (household as { name?: string } | null)?.name || 'Household',
    members,
  }
}

/**
 * Turns user references coming from the model ("me", "all", a name, an email
 * or a UUID) into household member ids. Unknown references throw so the model
 * gets a clear error instead of silently acting on the wrong person.
 */
export function resolveMembers(ctx: McpContext, refs?: string[] | null): Member[] {
  if (!refs || refs.length === 0) {
    return ctx.members.filter((m) => m.is_acting_user)
  }

  const result = new Map<string, Member>()
  for (const raw of refs) {
    const ref = raw.trim().toLowerCase()
    if (!ref) continue

    if (ref === 'me' || ref === 'ja' || ref === 'self') {
      ctx.members.filter((m) => m.is_acting_user).forEach((m) => result.set(m.user_id, m))
      continue
    }
    if (ref === 'all' || ref === 'everyone' || ref === 'wszyscy' || ref === 'household') {
      ctx.members.forEach((m) => result.set(m.user_id, m))
      continue
    }

    const match = ctx.members.find(
      (m) =>
        m.user_id.toLowerCase() === ref ||
        (m.name && m.name.toLowerCase() === ref) ||
        (m.email && m.email.toLowerCase() === ref)
    )
    if (!match) {
      const known = ctx.members.map((m) => `${m.name || '(no name)'} <${m.user_id}>`).join(', ')
      throw new Error(`Unknown household member "${raw}". Known members: ${known}`)
    }
    result.set(match.user_id, match)
  }

  return Array.from(result.values())
}

export function memberLabel(ctx: McpContext, userId: string): string {
  const m = ctx.members.find((x) => x.user_id === userId)
  if (!m) return userId
  return m.name || m.email || userId
}
