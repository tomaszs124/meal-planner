'use client'

import { useMemo, useState } from 'react'
import type { MealCategory } from '@/lib/supabase/client'
import type { MealWithItems } from './types'

// Search / tag / category filter state of the meals list
export function useMealFilters(meals: MealWithItems[]) {
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [selectedCategories, setSelectedCategories] = useState<MealCategory[]>([])
  const [searchQuery, setSearchQuery] = useState('')

  // Filter meals by tags and search query
  const filteredMeals = useMemo(() => {
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
  }, [meals, selectedTags, selectedCategories, searchQuery])

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
