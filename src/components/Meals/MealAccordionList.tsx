'use client'

import { useId, useMemo, useState } from 'react'
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

  // Jump bar: scroll a group into view (expanding it first when collapsed)
  const listId = useId()
  const sectionId = (key: string) => `${listId}-group-${key}`
  function jumpTo(key: string) {
    const scroll = () => document.getElementById(sectionId(key))?.scrollIntoView({ block: 'start', behavior: 'smooth' })
    if (isExpanded(key)) {
      scroll()
    } else {
      toggle(key)
      // let the expanded rows render first, otherwise the card height is still collapsed
      setTimeout(scroll, 0)
    }
  }

  // Collapsing a group from its stuck header: without this the page would jump into the
  // middle of the next group. Pin the collapsed header at the top instead, so the next
  // category starts right under it.
  function toggleFromHeader(key: string, isOpen: boolean, header: HTMLElement) {
    const wasStuck = isOpen && header.getBoundingClientRect().top <= 41
    toggle(key)
    if (wasStuck) {
      setTimeout(() => document.getElementById(sectionId(key))?.scrollIntoView({ block: 'start' }), 0)
    }
  }

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
    <div className="space-y-2">
      {/* Sticky, compact category bar: stays at the top while scrolling, each chip jumps to its group */}
      {nonEmptyKeys.length > 1 && (
        <nav
          aria-label="Skocz do kategorii"
          className="sticky top-0 z-20 -mx-4 flex h-10 items-center overflow-x-auto px-4 scrollbar-hide bg-[#f6f3ec]/95 backdrop-blur-md dark:bg-[#161311]/95 sm:-mx-6 sm:px-6"
        >
          <div className="flex w-max gap-1.5">
            {nonEmptyKeys.map(key => (
              <button
                key={key}
                type="button"
                onClick={() => jumpTo(key)}
                className="flex items-center gap-1.5 whitespace-nowrap rounded-full border border-gray-200 bg-white px-3 py-1 text-xs font-medium text-gray-700 shadow-sm transition-colors hover:border-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:hover:border-gray-300"
              >
                <span className={`h-2 w-2 rounded-full ${groupDot[key] ?? 'bg-gray-400'}`} aria-hidden="true" />
                {groupLabel(key)}
                <span className="text-gray-400 dark:text-gray-500">{groups.get(key)!.length}</span>
              </button>
            ))}
          </div>
        </nav>
      )}

      {nonEmptyKeys.map(key => {
        const meals = groups.get(key)!
        const isOpen = isExpanded(key)
        return (
          <div
            key={key}
            id={sectionId(key)}
            className="scroll-mt-10 rounded-lg border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800"
          >
            {/* Sticky group header (below the jump bar): collapse the group from anywhere inside it */}
            <button
              type="button"
              onClick={(e) => toggleFromHeader(key, isOpen, e.currentTarget)}
              aria-expanded={isOpen}
              className={`sticky top-10 z-10 flex w-full items-center justify-between rounded-t-lg border-b border-gray-200 bg-gray-50 px-4 py-3 transition-colors hover:bg-gray-100 dark:border-gray-700 dark:bg-gray-900 dark:hover:bg-gray-700 ${
                isOpen ? '' : 'rounded-b-lg border-b-0'
              }`}
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
