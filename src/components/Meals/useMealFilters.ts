'use client'

import { useMemo, useState } from 'react'
import type { MealCategory } from '@/lib/supabase/client'
import type { MealWithItems } from './types'
import { filterMeals } from './mealFilterUtils'
import { sortMeals, type MealSort } from '@/lib/meal-sort'
import { useDefaultMealSort } from '@/lib/preferences'

// Search / tag / category filter state of the meals list
export function useMealFilters(meals: MealWithItems[]) {
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [selectedCategories, setSelectedCategories] = useState<MealCategory[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  // Sort: starts from the default chosen in Ustawienia; the list can change it for this visit
  const [defaultSort] = useDefaultMealSort()
  const [sortOverride, setSortOverride] = useState<MealSort | null>(null)
  const sort = sortOverride ?? defaultSort

  // Filter meals by tags and search query, then sort
  const filteredMeals = useMemo(
    () => sortMeals(filterMeals(meals, { searchQuery, selectedTags, selectedCategories }), sort),
    [meals, selectedTags, selectedCategories, searchQuery, sort]
  )

  // Toggle tag filter
  function toggleTagFilter(tagId: string) {
    setSelectedTags(current =>
      current.includes(tagId)
        ? current.filter(id => id !== tagId)
        : [...current, tagId]
    )
  }

  // Toggle category filter
  function toggleCategoryFilter(category: MealCategory) {
    setSelectedCategories(current =>
      current.includes(category)
        ? current.filter(cat => cat !== category)
        : [...current, category]
    )
  }

  return {
    selectedTags,
    setSelectedTags,
    selectedCategories,
    setSelectedCategories,
    searchQuery,
    setSearchQuery,
    filteredMeals,
    sort,
    setSort: setSortOverride,
    toggleTagFilter,
    toggleCategoryFilter,
  }
}

export type MealFiltersState = ReturnType<typeof useMealFilters>
