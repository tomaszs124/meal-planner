'use client'

import { useEffect, useRef, useMemo } from 'react'
import { MealCategory } from '@/lib/supabase/client'
import type { MealWithDetails } from '@/lib/meals-data'
import { getEnabledCategories } from '@/lib/plan'
import WeekNavigator from './WeekNavigator'
import MealSlot from './MealSlot'
import DailySummary from './DailySummary'
import DayActions from './DayActions'
import { CATEGORY_LABELS } from './types'
import { useMealPlan } from './useMealPlan'
import { PlannerSkeleton, PlannerSlotsSkeleton } from '@/components/ui/Skeleton'

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
    copyFromUserId,
    setCopyFromUserId,
    sendToUserId,
    setSendToUserId,
    copySuccessMsg,
    sendSuccessMsg,
    handleWeekChange,
    handleSelectMeal,
    handleRandomMeal,
    handleToggleConsumed,
    handleToggleSkipped,
    handleDuplicateFromPreviousDay,
    handleCopyFromMember,
    handleSendDayToMember,
  } = useMealPlan()
  const sliderRef = useRef<HTMLDivElement>(null)

  function getPlannedMeal(category: MealCategory): MealWithDetails | null {
    const plan = plannedMeals.find((p) => p.meal_type === category)
    return plan?.meal || null
  }

  function isConsumed(category: MealCategory): boolean {
    const plan = plannedMeals.find((p) => p.meal_type === category)
    return plan?.is_consumed || false
  }

  function isSkipped(category: MealCategory): boolean {
    const plan = plannedMeals.find((p) => p.meal_type === category)
    return plan?.is_skipped || false
  }

  const categories: MealCategory[] = useMemo(() => getEnabledCategories(userSettings), [userSettings])

  // Scroll to first unconsumed meal when date changes
  useEffect(() => {
    if (isLoading || !sliderRef.current) return

    // Find first unconsumed category
    const firstUnconsumedIndex = categories.findIndex(category => {
      const plan = plannedMeals.find((p) => p.meal_type === category)
      return !plan?.is_consumed
    })

    if (firstUnconsumedIndex >= 0) {
      const slider = sliderRef.current
      const firstUnconsumedElement = slider.children[firstUnconsumedIndex] as HTMLElement

      if (firstUnconsumedElement) {
        firstUnconsumedElement.scrollIntoView({
          behavior: 'smooth',
          block: 'nearest',
          inline: 'start'
        })
      }
    }
  }, [selectedDate, plannedMeals, isLoading, categories])

  if (userLoading || !household) {
    return (
      <PlannerSkeleton />
    )
  }

  return (
    <div className="space-y-6">
      {/* Week navigator */}
      <WeekNavigator
        selectedDate={selectedDate}
        onDateSelect={setSelectedDate}
        onWeekChange={handleWeekChange}
        daysProgress={weekProgress}
      />

      {/* Day plan */}
      <div>
        {isLoading ? (
          <PlannerSlotsSkeleton />
        ) : (
          <>
            {/* Mobile slider view */}
            <div ref={sliderRef} className="flex gap-4 overflow-x-auto snap-x snap-mandatory pb-2 md:pb-4 -mx-4 px-4 scrollbar-hide lg:hidden">
              {categories.map((category) => (
                <div key={category} className="flex-none w-[85vw] md:w-[calc(50%-0.5rem)] snap-center">
                  <MealSlot
                    meals={allMeals}
                    category={category}
                    categoryLabel={CATEGORY_LABELS[category]}
                    selectedMeal={getPlannedMeal(category)}
                    isConsumed={isConsumed(category)}
                    isSkipped={isSkipped(category)}
                    householdId={household.id}
                    onSelectMeal={(meal) => handleSelectMeal(category, meal)}
                    onRandomMeal={() => handleRandomMeal(category)}
                    onToggleConsumed={() => handleToggleConsumed(category)}
                    onToggleSkipped={() => handleToggleSkipped(category)}
                  />
                </div>
              ))}
            </div>

            {/* Desktop grid view */}
            <div className="hidden lg:grid grid-cols-3 gap-4">
              {categories.map((category) => (
                <div key={category}>
                  <MealSlot
                    meals={allMeals}
                    category={category}
                    categoryLabel={CATEGORY_LABELS[category]}
                    selectedMeal={getPlannedMeal(category)}
                    isConsumed={isConsumed(category)}
                    isSkipped={isSkipped(category)}
                    householdId={household.id}
                    onSelectMeal={(meal) => handleSelectMeal(category, meal)}
                    onRandomMeal={() => handleRandomMeal(category)}
                    onToggleConsumed={() => handleToggleConsumed(category)}
                    onToggleSkipped={() => handleToggleSkipped(category)}
                  />
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Summary of consumed meals */}
      {plannedMeals.length > 0 && <DailySummary plannedMeals={plannedMeals} />}

      <DayActions
        householdMembers={householdMembers}
        copyFromUserId={copyFromUserId}
        onCopyFromUserIdChange={setCopyFromUserId}
        sendToUserId={sendToUserId}
        onSendToUserIdChange={setSendToUserId}
        copySuccessMsg={copySuccessMsg}
        sendSuccessMsg={sendSuccessMsg}
        onDuplicateFromPreviousDay={handleDuplicateFromPreviousDay}
        onCopyFromMember={handleCopyFromMember}
        onSendDayToMember={handleSendDayToMember}
      />
    </div>
  )
}
