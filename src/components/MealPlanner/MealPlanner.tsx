'use client'

import { useMemo } from 'react'
import { format, isToday, isTomorrow, isYesterday } from 'date-fns'
import { pl } from 'date-fns/locale'
import type { Meal, MealCategory } from '@/lib/supabase/client'
import { getEnabledCategories } from '@/lib/plan'
import { PageHeader } from '@/components/Layout/PageShell'
import WeekNavigator from './WeekNavigator'
import MealSlot from './MealSlot'
import DayMealRow from './DayMealRow'
import DailySummary from './DailySummary'
import DayActions from './DayActions'
import { CATEGORY_LABELS } from './types'
import { useMealPlan } from './useMealPlan'
import { PlannerSkeleton, PlannerSlotsSkeleton } from '@/components/ui/Skeleton'

/** "Piątek, 10 października" */
function formatDayTitle(date: Date): string {
  const text = format(date, 'EEEE, d MMMM', { locale: pl })
  return text.charAt(0).toUpperCase() + text.slice(1)
}

function relativeDayLabel(date: Date): string | null {
  if (isToday(date)) return 'Dziś'
  if (isTomorrow(date)) return 'Jutro'
  if (isYesterday(date)) return 'Wczoraj'
  return null
}

/**
 * Dashboard day planner. Renders its own page header (the selected day lives here),
 * the week strip, the day's progress, the meals (compact rows below `lg`, a 3-column
 * grid of cards from `lg`) and the "Dzień" actions card.
 */
export default function MealPlanner() {
  const {
    household,
    userLoading,
    selectedDate,
    setSelectedDate,
    userSettings,
    plannedMeals,
    allMeals,
    weekProgress,
    isLoading,
    householdMembers,
    memberUserId,
    setMemberUserId,
    handleWeekChange,
    handleSelectMeal,
    handleRandomMeal,
    handleToggleConsumed,
    handleToggleSkipped,
    handleDuplicateFromPreviousDay,
    handleCopyFromMember,
    handleSendDayToMember,
  } = useMealPlan()

  const categories: MealCategory[] = useMemo(() => getEnabledCategories(userSettings), [userSettings])

  if (userLoading) {
    return <PlannerSkeleton />
  }

  if (!household) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6 text-center text-gray-600 dark:text-gray-400">
        Musisz najpierw dołączyć do gospodarstwa.
      </div>
    )
  }

  const householdId = household.id

  function slotProps(category: MealCategory) {
    const plan = plannedMeals.find((p) => p.meal_type === category)
    return {
      meals: allMeals,
      category,
      categoryLabel: CATEGORY_LABELS[category],
      selectedMeal: plan?.meal ?? null,
      isConsumed: plan?.is_consumed || false,
      isSkipped: plan?.is_skipped || false,
      householdId,
      onSelectMeal: (meal: Meal) => handleSelectMeal(category, meal),
      onRandomMeal: () => handleRandomMeal(category),
      onToggleConsumed: () => handleToggleConsumed(category),
      onToggleSkipped: () => handleToggleSkipped(category),
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={formatDayTitle(selectedDate)}
        subtitle={relativeDayLabel(selectedDate) ?? household.name}
      />

      <WeekNavigator
        selectedDate={selectedDate}
        onDateSelect={setSelectedDate}
        onWeekChange={handleWeekChange}
        daysProgress={weekProgress}
      />

      {isLoading ? (
        <PlannerSlotsSkeleton />
      ) : (
        <div className="space-y-4">
          {plannedMeals.length > 0 && <DailySummary plannedMeals={plannedMeals} />}

          {/* Phones and tablets: compact list, one row per category */}
          <div className="space-y-2 lg:hidden">
            {categories.map((category) => (
              <DayMealRow key={category} {...slotProps(category)} />
            ))}
          </div>

          {/* Desktop: full cards in a 3-column grid */}
          <div className="hidden lg:grid grid-cols-3 gap-4">
            {categories.map((category) => (
              <MealSlot key={category} {...slotProps(category)} />
            ))}
          </div>
        </div>
      )}

      <DayActions
        householdMembers={householdMembers}
        memberUserId={memberUserId}
        onMemberUserIdChange={setMemberUserId}
        onDuplicateFromPreviousDay={handleDuplicateFromPreviousDay}
        onCopyFromMember={handleCopyFromMember}
        onSendDayToMember={handleSendDayToMember}
      />
    </div>
  )
}
