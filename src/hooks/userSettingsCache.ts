import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js'
import type { UserSettings } from '@/lib/supabase/client'

// Pure helpers backing the shared user settings cache in `useUserSettings`.
// Kept free of the Supabase client so they can be unit tested in isolation.

/** PostgREST error code for `.single()` returning no rows. */
export const NO_ROWS_ERROR_CODE = 'PGRST116'
/** Postgres unique_violation (two tabs creating the default row at once) */
export const UNIQUE_VIOLATION_CODE = '23505'

/** Row inserted when the user has no settings yet. */
export function defaultSettingsRow(userId: string) {
  return {
    user_id: userId,
    second_breakfast_enabled: true,
    lunch_enabled: true,
    dinner_enabled: true,
    snack_enabled: false,
  }
}

/**
 * Columns passed to `save()`. Identity and timestamps (`id`, `user_id`, `created_at`,
 * `updated_at`) are managed by the database and stripped before writing.
 */
export type UserSettingsPatch = Partial<UserSettings>

/** Row sent to `update`/`insert`: the patch plus the owning user id (which always wins). */
export function buildSaveRow(userId: string, patch: UserSettingsPatch) {
  return { ...stripManagedColumns(patch), user_id: userId }
}

/** Optimistic local value: the current row with the patch applied, or null when there is no row yet. */
export function mergeSettings(current: UserSettings | null, patch: UserSettingsPatch): UserSettings | null {
  if (!current) return null
  return { ...current, ...stripManagedColumns(patch) }
}

const MANAGED_COLUMNS = ['id', 'user_id', 'created_at', 'updated_at'] as const

function stripManagedColumns(patch: UserSettingsPatch): UserSettingsPatch {
  const rest: UserSettingsPatch = { ...patch }
  for (const column of MANAGED_COLUMNS) delete rest[column]
  return rest
}

/**
 * Applies a realtime `postgres_changes` event for `user_settings` and returns the
 * new value, or the same reference when the event does not concern this user.
 * Only INSERT and UPDATE are applied; DELETE leaves the cached row in place.
 */
export function applySettingsEvent(
  current: UserSettings | null,
  payload: RealtimePostgresChangesPayload<UserSettings>,
  userId: string
): UserSettings | null {
  if (payload.eventType !== 'INSERT' && payload.eventType !== 'UPDATE') return current
  const row = payload.new as UserSettings
  if (!row?.user_id || row.user_id !== userId) return current
  return row
}
