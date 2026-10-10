'use client'

import { useMemo, useState } from 'react'
import type { MealCategory } from '@/lib/supabase/client'
import { MEAL_CATEGORIES } from './mealHelpers'
import MealCard from './MealCard'
import MealRow from './MealRow'
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

  // Same hues as the day list on the dashboard, so a category looks the same everywhere
  const groupDot: Record<string, string> = {
    breakfast: 'bg-rose-300',
    second_breakfast: 'bg-orange-300',
    lunch: 'bg-sky-300',
    dinner: 'bg-indigo-300',
    snack: 'bg-emerald-300',
    __other__: 'bg-gray-400',
  }

  return (
    <div className="space-y-3">
      {nonEmptyKeys.map(key => {
        const meals = groups.get(key)!
        const isOpen = isExpanded(key)
        return (
          <div key={key} className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden bg-white dark:bg-gray-800 shadow-sm">
            <button
              type="button"
              onClick={() => toggle(key)}
              aria-expanded={isOpen}
              className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-gray-900 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              <span className="flex items-center gap-2 font-semibold text-gray-800 dark:text-gray-200">
                <span className={`h-2.5 w-2.5 rounded-full ${groupDot[key] ?? 'bg-gray-400'}`} aria-hidden="true" />
                {groupLabel(key)}
                <span className="ml-2 text-sm font-normal text-gray-500 dark:text-gray-400">({meals.length})</span>
              </span>
              <svg
                className={`w-5 h-5 text-gray-500 dark:text-gray-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {isOpen && (
              <>
                {/* Phones: compact rows with the full name (same look as the day list) */}
                <div className="stagger-in divide-y divide-gray-100 dark:divide-gray-700 sm:hidden">
                  {meals.map(meal => (
                    <MealRow key={meal.id} meal={meal} onClick={onMealClick} />
                  ))}
                </div>
                {/* Tablet and up: card grid */}
                <div className="hidden p-3 sm:grid sm:grid-cols-3 lg:grid-cols-4 gap-3">
                  {meals.map(meal => (
                    <MealCard key={meal.id} meal={meal} onClick={onMealClick} />
                  ))}
                </div>
              </>
            )}
          </div>
        )
      })}
    </div>
  )
}
