/**
 * Sorting of meal lists (Meals page and the day-plan picker).
 * Pure: no React, no Supabase.
 */
export type MealSort = 'popular' | 'newest' | 'title'

export const MEAL_SORT_OPTIONS: { value: MealSort; label: string; hint: string }[] = [
  { value: 'popular', label: 'Najczęściej wybierane', hint: 'Ile razy danie trafiło do planu dnia' },
  { value: 'newest', label: 'Najnowsze', hint: 'Według daty dodania' },
  { value: 'title', label: 'Nazwa A–Z', hint: 'Alfabetycznie' },
]

export const DEFAULT_MEAL_SORT: MealSort = 'popular'

export function isMealSort(value: unknown): value is MealSort {
  return value === 'popular' || value === 'newest' || value === 'title'
}

type Sortable = {
  id: string
  name: string
  created_at: string
  /** Times the meal was put into a day plan; missing counts as 0 */
  pickCount?: number
}

export type SortOptions = {
  /** Put the user's favourites (the heart) before everything else */
  favoritesFirst?: boolean
  favoriteIds?: ReadonlySet<string>
}

const collator = new Intl.Collator('pl', { sensitivity: 'base', numeric: true })

/** Returns a new array; ties fall back to the next criterion so the order is stable and predictable. */
export function sortMeals<T extends Sortable>(meals: T[], sort: MealSort, options: SortOptions = {}): T[] {
  const favorites = options.favoritesFirst ? options.favoriteIds ?? new Set<string>() : null
  const byFavorite = (a: T, b: T) => (favorites ? Number(favorites.has(b.id)) - Number(favorites.has(a.id)) : 0)
  const byTitle = (a: T, b: T) => collator.compare(a.name, b.name)
  const byNewest = (a: T, b: T) => b.created_at.localeCompare(a.created_at)
  const byPopular = (a: T, b: T) => (b.pickCount ?? 0) - (a.pickCount ?? 0)

  const compare =
    sort === 'title'
      ? byTitle
      : sort === 'newest'
        ? (a: T, b: T) => byNewest(a, b) || byTitle(a, b)
        : (a: T, b: T) => byPopular(a, b) || byNewest(a, b) || byTitle(a, b)

  return [...meals].sort((a, b) => byFavorite(a, b) || compare(a, b))
}
