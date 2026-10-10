'use client'

import { useSyncExternalStore } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * The signed-in user's favourite meals (the heart), kept in one module-level store so a
 * tap on any list or modal updates every other list at once. Loaded once per session by
 * `loadFavorites`; writes are optimistic with rollback.
 * Table: meal_favorites (docs/add-meal-favorites.sql). Until the migration is run,
 * loading fails silently and the set stays empty.
 */
let favoriteIds: ReadonlySet<string> = new Set()
let loadedForUser: string | null = null
const listeners = new Set<() => void>()

function emit(next: ReadonlySet<string>) {
  favoriteIds = next
  listeners.forEach((l) => l())
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

const EMPTY: ReadonlySet<string> = new Set()

/** Reactive set of favourite meal ids for the current user. */
export function useFavoriteIds(): ReadonlySet<string> {
  return useSyncExternalStore(subscribe, () => favoriteIds, () => EMPTY)
}

/** Fetches the user's favourites once (subsequent calls for the same user are no-ops). */
export async function loadFavorites(supabase: SupabaseClient, userId: string, { force = false } = {}) {
  if (!force && loadedForUser === userId) return
  loadedForUser = userId
  const { data, error } = await supabase.from('meal_favorites').select('meal_id').eq('user_id', userId)
  if (error) {
    console.warn('meal_favorites unavailable (run docs/add-meal-favorites.sql); favourites disabled', error.message)
    return
  }
  emit(new Set((data || []).map((row: { meal_id: string }) => row.meal_id)))
}

/** Toggles the heart; returns the new state or null when the write failed (state rolled back). */
export async function toggleFavorite(supabase: SupabaseClient, userId: string, mealId: string): Promise<boolean | null> {
  const wasFavorite = favoriteIds.has(mealId)
  const next = new Set(favoriteIds)
  if (wasFavorite) next.delete(mealId)
  else next.add(mealId)
  emit(next)

  const { error } = wasFavorite
    ? await supabase.from('meal_favorites').delete().eq('user_id', userId).eq('meal_id', mealId)
    : await supabase.from('meal_favorites').upsert({ user_id: userId, meal_id: mealId }, { onConflict: 'user_id,meal_id' })

  if (error) {
    const rolledBack = new Set(favoriteIds)
    if (wasFavorite) rolledBack.add(mealId)
    else rolledBack.delete(mealId)
    emit(rolledBack)
    console.error('toggleFavorite failed', error.message)
    return null
  }
  return !wasFavorite
}

/** Test / sign-out helper. */
export function resetFavoritesStore() {
  loadedForUser = null
  emit(new Set())
}
