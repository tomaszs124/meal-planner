'use client'

import { useMemo, useState } from 'react'
import type { MealCategory } from '@/lib/supabase/client'
import { MEAL_CATEGORIES } from './mealHelpers'
import MealCard from './MealCard'
import type { MealWithItems } from './types'

// Accordion-grouped meal list
export default function MealAccordionList({
  filteredMeals,
  selectedCategories,
  onMealClick,
}: {
  filteredMeals: MealWithItems[]
  selectedCategories: MealCategory[]
  onMealClick: (meal: MealWithItems) => void
}) {
  // Group meals by primary_category, uncategorized go last
  const groups = useMemo(() => {
    const map = new Map<string, MealWithItems[]>()
    for (const cat of MEAL_CATEGORIES) map.set(cat.value, [])
    map.set('__other__', [])
    for (const meal of filteredMeals) {
      const key = meal.primary_category ?? '__other__'
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(meal)
    }
    return map
  }, [filteredMeals])

  const nonEmptyKeys = useMemo(
    () => [...MEAL_CATEGORIES.map(c => c.value), '__other__'].filter(k => (groups.get(k)?.length ?? 0) > 0),
    [groups]
  )

  // Default expansion: selected categories when filtering by category, otherwise every non-empty group.
  // Recomputed whenever the filter / list changes, which also discards manual toggles.
  const defaultExpanded = useMemo(
    () => new Set<string>(selectedCategories.length > 0 ? selectedCategories : nonEmptyKeys),
    [selectedCategories, nonEmptyKeys]
  )

  // Keys the user toggled manually, valid only for the defaultExpanded they were made against
  const [manualToggles, setManualToggles] = useState<{ base: Set<string>; keys: Set<string> }>(() => ({
    base: defaultExpanded,
    keys: new Set(),
  }))
  const toggledKeys = manualToggles.base === defaultExpanded ? manualToggles.keys : null
  const isExpanded = (key: string) => defaultExpanded.has(key) !== (toggledKeys?.has(key) ?? false)

  const toggle = (key: string) =>
    setManualToggles(prev => {
      const next = new Set(prev.base === defaultExpanded ? prev.keys : [])
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return { base: defaultExpanded, keys: next }
    })

  const groupLabel = (key: string) =>
    key === '__other__' ? 'Pozostałe' : (MEAL_CATEGORIES.find(c => c.value === key)?.label ?? key)

  return (
    <div className="space-y-3">
      {nonEmptyKeys.map(key => {
        const meals = groups.get(key)!
        const isOpen = isExpanded(key)
        return (
          <div key={key} className="border border-gray-200 rounded-lg overflow-hidden bg-white shadow-sm">
            <button
              type="button"
              onClick={() => toggle(key)}
              aria-expanded={isOpen}
              className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors"
            >
              <span className="font-semibold text-gray-800">
                {groupLabel(key)}
                <span className="ml-2 text-sm font-normal text-gray-500">({meals.length})</span>
              </span>
              <svg
                className={`w-5 h-5 text-gray-500 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {isOpen && (
              <div className="p-3 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {meals.map(meal => (
                  <MealCard key={meal.id} meal={meal} onClick={onMealClick} />
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
