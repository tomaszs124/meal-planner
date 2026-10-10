'use client'

import { useState, useEffect, useId, useRef } from 'react'
import { useFocusTrap } from '@/components/ui/useFocusTrap'
import { supabase, MealCategory, Tag } from '@/lib/supabase/client'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import MealDetailsModal from './MealDetailsModal'
import MealRow from '@/components/Meals/MealRow'
import SortMenu from '@/components/ui/SortMenu'
import { fetchMealsWithDetails, type MealWithDetails } from '@/lib/meals-data'
import { sortMeals, type MealSort } from '@/lib/meal-sort'
import { useDefaultMealSort } from '@/lib/preferences'

type MealPickerModalProps = {
  isOpen: boolean
  onClose: () => void
  onSelectMeal: (meal: MealWithDetails) => void
  category: MealCategory
  householdId: string
  /** Preloaded meals (e.g. the planner's allMeals). When provided, the modal does not fetch. */
  meals?: MealWithDetails[]
}

/**
 * "Wybierz posiłek": full-screen sheet on phones, dialog from `sm`. Compact rows (same as
 * the Meals list), grouped into Polecane / Alternatywne / Pozostałe for the slot's
 * category, searchable, filterable by tag and sortable (default from Ustawienia).
 * Tapping a row opens the details modal, where "Wybierz ten posiłek" confirms.
 */
export default function MealPickerModal({
  isOpen,
  onClose,
  onSelectMeal,
  category,
  householdId,
  meals: providedMeals,
}: MealPickerModalProps) {
  const { user } = useCurrentUser()
  const [fetchedMeals, setFetchedMeals] = useState<MealWithDetails[]>([])
  const [tags, setTags] = useState<Tag[]>([])
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [selectedMealForDetails, setSelectedMealForDetails] = useState<MealWithDetails | null>(null)
  const [defaultSort] = useDefaultMealSort()
  const [sortOverride, setSortOverride] = useState<MealSort | null>(null)
  const sort = sortOverride ?? defaultSort

  // Fetch tags for household
  useEffect(() => {
    if (!isOpen || !householdId) return

    async function fetchTags() {
      const { data } = await supabase
        .from('tags')
        .select('*')
        .eq('household_id', householdId)
        .order('name')

      if (data) {
        setTags(data)
      }
    }

    fetchTags()
  }, [isOpen, householdId])

  useEffect(() => {
    const userId = user?.id
    // Meals provided by the parent (e.g. the planner's allMeals) - no fetch needed
    if (!isOpen || !householdId || !userId || providedMeals) return

    let cancelled = false

    async function fetchMeals() {
      setIsLoading(true)

      try {
        // Batched loader: a fixed number of queries per household instead of 4 per meal
        const mealsWithDetails = await fetchMealsWithDetails(supabase, { householdId, userId })
        if (!cancelled) setFetchedMeals(mealsWithDetails)
      } catch (error) {
        console.error('Error fetching meals:', error)
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }

    fetchMeals()

    return () => {
      cancelled = true
    }
  }, [isOpen, householdId, user?.id, providedMeals])

  const meals = providedMeals ?? fetchedMeals
  const titleId = useId()
  const dialogRef = useRef<HTMLDivElement>(null)

  // Focus management + close on Escape. While the nested details modal is open it is
  // the top-most trap, so it receives Escape/Tab and this one stays idle.
  useFocusTrap(dialogRef, { active: isOpen, onEscape: onClose })

  if (!isOpen) return null

  // Filter by search query (name or ingredient) and tags, then sort
  const filteredMeals = sortMeals(
    meals.filter((meal) => {
      const query = searchQuery.toLowerCase()
      const nameMatch = meal.name.toLowerCase().includes(query)
      const ingredientMatch = meal.items?.some((item) => item.product?.name?.toLowerCase().includes(query))
      const textMatch = nameMatch || ingredientMatch
      const tagMatch = selectedTags.length === 0 || selectedTags.every((tagId) => meal.tags?.some((mealTag) => mealTag.id === tagId))
      return textMatch && tagMatch
    }),
    sort
  )

  const sections: { key: string; label: string; meals: MealWithDetails[] }[] = [
    { key: 'primary', label: 'Polecane', meals: filteredMeals.filter((m) => m.primary_category === category) },
    {
      key: 'alternative',
      label: 'Alternatywne',
      meals: filteredMeals.filter((m) => m.primary_category !== category && m.alternative_categories?.includes(category)),
    },
    {
      key: 'other',
      label: 'Pozostałe',
      meals: filteredMeals.filter((m) => m.primary_category !== category && !m.alternative_categories?.includes(category)),
    },
  ].filter((section) => section.meals.length > 0)

  function toggleTag(tagId: string) {
    setSelectedTags((prev) => (prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId]))
  }

  return (
    <div
      className="fixed inset-0 z-[60] m-0 flex items-stretch justify-center bg-gray-900/40 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="flex h-full w-full max-w-2xl flex-col bg-white shadow-xl dark:bg-gray-800 sm:h-auto sm:max-h-[90vh] sm:rounded-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header: title, search + sort, tag chips */}
        <div className="shrink-0 space-y-2.5 border-b border-gray-200 px-4 pb-3 pt-3 dark:border-gray-700 sm:px-5">
          <div className="flex items-center justify-between gap-3">
            <h2 id={titleId} className="text-lg font-bold text-gray-900 dark:text-gray-100">Wybierz posiłek</h2>
            <button
              type="button"
              onClick={onClose}
              aria-label="Zamknij"
              className="-mr-1.5 rounded-md p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 dark:text-gray-500 dark:hover:bg-gray-700 dark:hover:text-gray-300"
            >
              <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="flex gap-2">
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Szukaj po nazwie lub składnikach..."
              aria-label="Szukaj po nazwie lub składnikach"
              className="min-w-0 flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
            />
            <SortMenu value={sort} onChange={setSortOverride} />
          </div>

          {tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filtruj po tagach">
              {tags.map((tag) => (
                <button
                  key={tag.id}
                  type="button"
                  onClick={() => toggleTag(tag.id)}
                  aria-pressed={selectedTags.includes(tag.id)}
                  className={`rounded-full px-2.5 py-1 text-xs font-medium transition-all ${
                    selectedTags.includes(tag.id)
                      ? 'opacity-100 ring-2 ring-brand-500 ring-offset-1 dark:ring-offset-gray-800'
                      : 'opacity-60 hover:opacity-100'
                  }`}
                  style={{ backgroundColor: tag.color, color: tag.text_color }}
                >
                  {tag.name}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* List */}
        <div className="min-h-0 flex-1 overflow-y-auto">
          {isLoading ? (
            <ul role="status" aria-live="polite" className="space-y-px p-2" aria-busy="true">
              <span className="sr-only">Ładowanie...</span>
              {Array.from({ length: 6 }, (_, i) => (
                <li key={i} className="h-[4.5rem] animate-pulse rounded-lg bg-gray-100 dark:bg-gray-700" />
              ))}
            </ul>
          ) : filteredMeals.length === 0 ? (
            <div className="py-10 text-center text-sm text-gray-500 dark:text-gray-400">
              {searchQuery || selectedTags.length > 0 ? 'Nie znaleziono posiłków' : 'Brak posiłków'}
            </div>
          ) : (
            sections.map((section) => (
              <section key={section.key} aria-label={section.label}>
                <h3 className="sticky top-0 z-10 border-b border-gray-100 bg-gray-50/95 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-500 backdrop-blur-sm dark:border-gray-700 dark:bg-gray-900/95 dark:text-gray-400 sm:px-5">
                  {section.label} <span className="font-normal">({section.meals.length})</span>
                </h3>
                <div className="divide-y divide-gray-100 dark:divide-gray-700">
                  {section.meals.map((meal) => (
                    <MealRow key={meal.id} meal={meal} onClick={() => setSelectedMealForDetails(meal)} />
                  ))}
                </div>
              </section>
            ))
          )}
        </div>
      </div>

      <MealDetailsModal
        isOpen={selectedMealForDetails !== null}
        onClose={() => setSelectedMealForDetails(null)}
        meal={selectedMealForDetails}
        onSelectMeal={(meal) => {
          // MealDetailsModal echoes back the meal it was given; prefer the fully typed instance
          onSelectMeal(selectedMealForDetails ?? (meal as MealWithDetails))
          setSelectedMealForDetails(null)
          onClose()
        }}
        userId={user?.id}
        householdId={householdId}
      />
    </div>
  )
}
