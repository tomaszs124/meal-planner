import { describe, expect, it } from 'vitest'
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js'
import type { UserSettings } from '@/lib/supabase/client'
import { applySettingsEvent, buildSaveRow, defaultSettingsRow, mergeSettings } from './userSettingsCache'

const USER = 'user-1'

function settings(extra: Partial<UserSettings> = {}): UserSettings {
  return {
    id: 'settings-1',
    user_id: USER,
    name: 'Ala',
    snack_enabled: false,
    second_breakfast_enabled: true,
    lunch_enabled: true,
    dinner_enabled: true,
    created_at: '2026-01-01T00:00:00+00:00',
    updated_at: '2026-01-01T00:00:00+00:00',
    ...extra,
  }
}

function event(
  eventType: 'INSERT' | 'UPDATE' | 'DELETE',
  row: Partial<UserSettings>
): RealtimePostgresChangesPayload<UserSettings> {
  return {
    schema: 'public',
    table: 'user_settings',
    commit_timestamp: '2026-01-01T00:00:00Z',
    errors: [],
    eventType,
    new: eventType === 'DELETE' ? {} : row,
    old: eventType === 'DELETE' ? row : {},
  } as RealtimePostgresChangesPayload<UserSettings>
}

describe('defaultSettingsRow', () => {
  it('enables every category except the snack', () => {
    expect(defaultSettingsRow(USER)).toEqual({
      user_id: USER,
      second_breakfast_enabled: true,
      lunch_enabled: true,
      dinner_enabled: true,
      snack_enabled: false,
    })
  })
})

describe('buildSaveRow', () => {
  it('adds the user id and drops database-managed columns', () => {
    const row = buildSaveRow(USER, { id: 'x', user_id: 'other', created_at: 'a', updated_at: 'b', name: 'Ola', snack_enabled: true })
    expect(row).toEqual({ user_id: USER, name: 'Ola', snack_enabled: true })
  })
})

describe('mergeSettings', () => {
  it('applies the patch to the current row without touching identity columns', () => {
    const current = settings()
    const next = mergeSettings(current, { name: null, lunch_enabled: false, id: 'x' })
    expect(next).toEqual({ ...current, name: null, lunch_enabled: false })
    expect(current.lunch_enabled).toBe(true)
  })

  it('returns null when there is no row yet', () => {
    expect(mergeSettings(null, { name: 'Ola' })).toBeNull()
  })
})

describe('applySettingsEvent', () => {
  it('replaces the row on UPDATE and INSERT for the same user', () => {
    const current = settings()
    const updated = settings({ name: 'Ola' })
    expect(applySettingsEvent(current, event('UPDATE', updated), USER)).toBe(updated)
    expect(applySettingsEvent(null, event('INSERT', updated), USER)).toBe(updated)
  })

  it('ignores rows of other users and DELETE events', () => {
    const current = settings()
    expect(applySettingsEvent(current, event('UPDATE', settings({ user_id: 'other' })), USER)).toBe(current)
    expect(applySettingsEvent(current, event('DELETE', { id: current.id }), USER)).toBe(current)
  })
})
