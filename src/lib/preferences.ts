'use client'

import { useCallback, useSyncExternalStore } from 'react'
import { DEFAULT_MEAL_SORT, isMealSort, type MealSort } from './meal-sort'

/**
 * Per-device app preferences (localStorage), same mechanism as the theme in theme.ts:
 * read synchronously, shared between components via useSyncExternalStore.
 * Today: the default sort of meal lists, chosen in Ustawienia.
 */
const MEAL_SORT_KEY = 'meal-planner-meal-sort'
const FAVORITES_FIRST_KEY = 'meal-planner-favorites-first'
const listeners = new Set<() => void>()

export function readDefaultMealSort(): MealSort {
  try {
    const stored = localStorage.getItem(MEAL_SORT_KEY)
    return isMealSort(stored) ? stored : DEFAULT_MEAL_SORT
  } catch {
    return DEFAULT_MEAL_SORT
  }
}

function writeDefaultMealSort(sort: MealSort) {
  try {
    localStorage.setItem(MEAL_SORT_KEY, sort)
  } catch {
    // private mode: keep it for this page load only
  }
  listeners.forEach((l) => l())
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  const onStorage = (e: StorageEvent) => {
    if (e.key === MEAL_SORT_KEY || e.key === FAVORITES_FIRST_KEY) listener()
  }
  window.addEventListener('storage', onStorage)
  return () => {
    listeners.delete(listener)
    window.removeEventListener('storage', onStorage)
  }
}

/** The default sort for meal lists; lists start with it and can change it locally. */
export function useDefaultMealSort(): [MealSort, (sort: MealSort) => void] {
  const sort = useSyncExternalStore(subscribe, readDefaultMealSort, () => DEFAULT_MEAL_SORT)
  const set = useCallback((next: MealSort) => writeDefaultMealSort(next), [])
  return [sort, set]
}

export function readFavoritesFirst(): boolean {
  try {
    return localStorage.getItem(FAVORITES_FIRST_KEY) !== 'off'
  } catch {
    return true
  }
}

function writeFavoritesFirst(on: boolean) {
  try {
    localStorage.setItem(FAVORITES_FIRST_KEY, on ? 'on' : 'off')
  } catch {
    // private mode
  }
  listeners.forEach((l) => l())
}

/** "Ulubione na początku": favourites (the heart) are listed before everything else. Default on. */
export function useFavoritesFirst(): [boolean, (on: boolean) => void] {
  const on = useSyncExternalStore(subscribe, readFavoritesFirst, () => true)
  const set = useCallback((next: boolean) => writeFavoritesFirst(next), [])
  return [on, set]
}
