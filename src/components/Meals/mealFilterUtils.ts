import type { MealCategory } from '@/lib/supabase/client'
import type { MealWithItems } from './types'

export type MealFilterCriteria = {
  searchQuery: string
  selectedTags: string[]
  selectedCategories: MealCategory[]
}

/**
 * Filters meals by:
 * - search query (trimmed, case-insensitive substring of name or description),
 * - selected tags (AND: the meal must have every selected tag),
 * - selected categories (OR: primary or any alternative category matches any selected one).
 * Empty criteria do not filter. Order of meals is preserved.
 */
export function filterMeals(
  meals: MealWithItems[],
  { searchQuery, selectedTags, selectedCategories }: MealFilterCriteria
): MealWithItems[] {
  let filtered = meals

  // Filter by search query
  const q = searchQuery.trim().toLowerCase()
  if (q) {
    filtered = filtered.filter(meal =>
      meal.name.toLowerCase().includes(q) ||
      meal.description?.toLowerCase().includes(q)
    )
  }

  // Filter by selected tags
  if (selectedTags.length > 0) {
    filtered = filtered.filter(meal =>
      selectedTags.every(tagId =>
        meal.tags?.some(tag => tag.id === tagId)
      )
    )
  }

  // Filter by selected categories
  if (selectedCategories.length > 0) {
    filtered = filtered.filter(meal =>
      selectedCategories.some(cat =>
        meal.primary_category === cat || (meal.alternative_categories?.includes(cat) ?? false)
      )
    )
  }

  return filtered
}
