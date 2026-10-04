'use client'

import { useMemo, useState } from 'react'
import type { MealCategory } from '@/lib/supabase/client'
import type { MealWithItems } from './types'
import { filterMeals } from './mealFilterUtils'

// Search / tag / category filter state of the meals list
export function useMealFilters(meals: MealWithItems[]) {
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [selectedCategories, setSelectedCategories] = useState<MealCategory[]>([])
  const [searchQuery, setSearchQuery] = useState('')

  // Filter meals by tags and search query
  const filteredMeals = useMemo(
    () => filterMeals(meals, { searchQuery, selectedTags, selectedCategories }),
    [meals, selectedTags, selectedCategories, searchQuery]
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
    toggleTagFilter,
    toggleCategoryFilter,
  }
}

export type MealFiltersState = ReturnType<typeof useMealFilters>
