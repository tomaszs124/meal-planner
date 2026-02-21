'use client'

import { useEffect, useState, useRef, useMemo } from 'react'
import { format, startOfWeek, addDays } from 'date-fns'
import { supabase, MealCategory, UserSettings, Product, MealImage, Tag } from '@/lib/supabase/client'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import WeekNavigator from './WeekNavigator'
import MealSlot from './MealSlot'

// Helper function to calculate nutrition values based on weight
function calculateNutrition(amount: number, unitWeightGrams: number | null, valuePer100g: number): number {
  const weightGrams = amount * (unitWeightGrams || 1)
  return (weightGrams / 100) * valuePer100g
}

type MealWithDetails = {
  id: string
  name: string
  primary_category: MealCategory | null
  alternative_categories: MealCategory[]
  totalKcal?: number
  images?: MealImage[]
  tags?: Tag[]
  items?: {
    product?: Product
    amount: number
  }[]
  isUserVariant?: boolean
}

type PlannedMeal = {
  id: string
  meal_type: MealCategory
  meal_id: string
  is_consumed: boolean
  is_skipped: boolean
  meal?: MealWithDetails
}

type HouseholdMember = {
  user_id: string
  display_name: string | null
}

const CATEGORY_LABELS: Record<MealCategory, string> = {
  breakfast: 'Śniadanie',
  second_breakfast: 'Drugie śniadanie',
  lunch: 'Obiad',
  dinner: 'Kolacja',
  snack: 'Przekąska',
}

export default function MealPlanner() {
  const { user, household, isLoading: userLoading } = useCurrentUser()
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [userSettings, setUserSettings] = useState<UserSettings | null>(null)
  const [plannedMeals, setPlannedMeals] = useState<PlannedMeal[]>([])
  const [allMeals, setAllMeals] = useState<MealWithDetails[]>([])
  const [weekProgress, setWeekProgress] = useState<{ dateString: string; consumedKcal: number; plannedKcal: number }[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [householdMembers, setHouseholdMembers] = useState<HouseholdMember[]>([])
  const [copyFromUserId, setCopyFromUserId] = useState('')
  const [sendToUserId, setSendToUserId] = useState('')
  const sliderRef = useRef<HTMLDivElement>(null)

  // Fetch user settings with realtime updates
  useEffect(() => {
    if (!user?.id) return

    async function fetchSettings() {
      const { data, error } = await supabase
        .from('user_settings')
        .select('*')
        .eq('user_id', user.id)
        .single()

      if (!error && data) {
        setUserSettings(data)
      } else if (error && error.code === 'PGRST116') {
        // Settings don't exist - create default ones
        const defaultSettings = {
          user_id: user.id,
          second_breakfast_enabled: true,
          lunch_enabled: true,
          dinner_enabled: true,
          snack_enabled: false,
        }
        
        const { data: newSettings, error: insertError } = await supabase
          .from('user_settings')
          .insert([defaultSettings])
          .select()
          .single()

        if (!insertError && newSettings) {
          setUserSettings(newSettings)
        }
      }
    }

    fetchSettings()

    // Subscribe to realtime updates
    const channel = supabase
      .channel(`user_settings_${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_settings',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          if (payload.new) {
            setUserSettings(payload.new as UserSettings)
          }
        }
      )
      .subscribe()

    return () => {
      channel.unsubscribe()
    }
  }, [user?.id])

  // Fetch all meals for household
  useEffect(() => {
    if (!household?.id || !user?.id) return

    async function fetchMeals() {
      const { data: mealsData } = await supabase
        .from('meals')
        .select('*')
        .eq('household_id', household.id)

      if (mealsData) {
        const mealsWithDetails = await Promise.all(
          mealsData.map(async (meal) => {
            // Check if user has overrides for this meal
            const { data: overridesData } = await supabase
              .from('meal_item_overrides')
              .select('*, product:products(*)')
              .eq('meal_id', meal.id)
              .eq('user_id', user.id)

            let itemsData
            if (overridesData && overridesData.length > 0) {
              // User has overrides - use them
              itemsData = overridesData
            } else {
              // No overrides - use default meal_items
              const { data } = await supabase
                .from('meal_items')
                .select('*, product:products(*)')
                .eq('meal_id', meal.id)
              itemsData = data
            }

            // Fetch meal images
            const { data: imagesData } = await supabase
              .from('meal_images')
              .select('*')
              .eq('meal_id', meal.id)
              .order('uploaded_at', { ascending: false })

            // Fetch meal tags
            const { data: mealTagsData } = await supabase
              .from('meal_tags')
              .select('tag_id, tags(*)')
              .eq('meal_id', meal.id)

            const items = itemsData || []
            const images = imagesData || []
            const mealTags = (mealTagsData?.map(mt => mt.tags as unknown as Tag).filter(Boolean) || []) as Tag[]
            const totalKcal = items.reduce((sum, item) => {
              const product = item.product as unknown as Product
              if (!product) return sum
              return sum + calculateNutrition(item.amount, product.unit_weight_grams, product.kcal_per_unit)
            }, 0)

            return {
              ...meal,
              items,
              images,
              tags: mealTags,
              totalKcal,
              isUserVariant: overridesData && overridesData.length > 0,
            }
          })
        )

        setAllMeals(mealsWithDetails)
      }
    }

    fetchMeals()
  }, [household?.id, user?.id])

  // Fetch household members for copy from member
  useEffect(() => {
    if (!household?.id) {
      setHouseholdMembers([])
      return
    }

    async function fetchMembers() {
      const { data: membersData } = await supabase
        .from('household_users')
        .select('user_id')
        .eq('household_id', household.id)

      if (!membersData || membersData.length === 0) {
        setHouseholdMembers([])
        return
      }

      const allUserIds = membersData.map((m: { user_id: string }) => m.user_id)
      const memberIds = user?.id ? allUserIds.filter((id: string) => id !== user.id) : allUserIds

      if (memberIds.length === 0) {
        setHouseholdMembers([])
        return
      }

      const { data: namesData } = await supabase
        .from('user_settings')
        .select('user_id, name')
        .in('user_id', memberIds)

      const nameMap = new Map((namesData || []).map((row: { user_id: string; name: string | null }) => [row.user_id, row.name]))

      const members: HouseholdMember[] = memberIds.map((memberId) => ({
        user_id: memberId,
        display_name: nameMap.get(memberId) || null,
      }))

      setHouseholdMembers(members)
    }

    fetchMembers()
  }, [household?.id, user?.id])

  // Fetch planned meals for selected date
  useEffect(() => {
    if (!user?.id || !household?.id) return

    async function fetchPlannedMeals() {
      setIsLoading(true)

      const dateStr = format(selectedDate, 'yyyy-MM-dd')

      const { data } = await supabase
        .from('meal_plan')
        .select('*')
        .eq('user_id', user.id)
        .eq('date', dateStr)

      if (data) {
        const plansWithMeals = await Promise.all(
          data.map(async (plan) => {
            const meal = allMeals.find((m) => m.id === plan.meal_id)
            return {
              ...plan,
              meal,
            }
          })
        )

        setPlannedMeals(plansWithMeals)
      } else {
        setPlannedMeals([])
      }

      setIsLoading(false)
    }

    if (allMeals.length > 0) {
      fetchPlannedMeals()
    }
  }, [user?.id, household?.id, selectedDate, allMeals])

  // Fetch week progress
  useEffect(() => {
    if (!user?.id || allMeals.length === 0) return

    async function fetchWeekProgress() {
      const weekStart = startOfWeek(selectedDate, { weekStartsOn: 1 })
      const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))

      const progressData = await Promise.all(
        weekDays.map(async (day) => {
          const dateStr = format(day, 'yyyy-MM-dd')

          const { data } = await supabase
            .from('meal_plan')
            .select('*')
            .eq('user_id', user.id)
            .eq('date', dateStr)

          if (!data || data.length === 0) {
            return { dateString: dateStr, consumedKcal: 0, plannedKcal: 0 }
          }

          // Planned = suma kalorii z ZAPLANOWANYCH posiłków na ten dzień
          const plannedKcal = data.reduce((sum, plan) => {
            const meal = allMeals.find(m => m.id === plan.meal_id)
            return sum + (meal?.totalKcal || 0)
          }, 0)

          // Consumed = suma kalorii z ZJEDZONYCH posiłków
          const consumedKcal = data
            .filter(plan => plan.is_consumed)
            .reduce((sum, plan) => {
              const meal = allMeals.find(m => m.id === plan.meal_id)
              return sum + (meal?.totalKcal || 0)
            }, 0)

          return { dateString: dateStr, consumedKcal, plannedKcal }
        })
      )

      setWeekProgress(progressData)
    }

    fetchWeekProgress()
  }, [user?.id, selectedDate, allMeals, plannedMeals])

  async function handleDuplicateFromPreviousDay() {
    if (!user?.id || !household?.id) return

    const previousDate = new Date(selectedDate)
    previousDate.setDate(previousDate.getDate() - 1)
    const previousDateStr = format(previousDate, 'yyyy-MM-dd')
    const currentDateStr = format(selectedDate, 'yyyy-MM-dd')

    // Fetch meals from previous day
    const { data: previousMeals } = await supabase
      .from('meal_plan')
      .select('*')
      .eq('user_id', user.id)
      .eq('date', previousDateStr)

    if (!previousMeals || previousMeals.length === 0) {
      alert('Brak posiłków z poprzedniego dnia')
      return
    }

    // Create new meal plans for current day (without consumed/skipped status)
    const newMealPlans = previousMeals.map((plan) => ({
      user_id: user.id,
      household_id: household.id,
      date: currentDateStr,
      meal_id: plan.meal_id,
      meal_type: plan.meal_type,
      is_consumed: false,
      is_skipped: false,
    }))

    // Check which meal types already exist
    const existingMealTypes = plannedMeals.map(m => m.meal_type)
    const mealsToAdd = newMealPlans.filter(plan => !existingMealTypes.includes(plan.meal_type))

    if (mealsToAdd.length === 0) {
      // All slots are filled - ask for confirmation
      const confirmed = confirm('Wszystkie kategorie posiłków są już zaplanowane. Czy chcesz je zastąpić posiłkami z wczoraj?')
      if (!confirmed) return
      
      // Delete all current meals for today and add previous day's meals
      const existingPlanIds = plannedMeals.map(p => p.id)
      await supabase.from('meal_plan').delete().in('id', existingPlanIds)
      
      const { error } = await supabase.from('meal_plan').insert(newMealPlans)
      if (error) {
        alert('Błąd podczas duplikowania posiłków')
        console.error(error)
        return
      }
    } else {
      // Some slots are empty - add without confirmation
      const { error } = await supabase.from('meal_plan').insert(mealsToAdd)

      if (error) {
        alert('Błąd podczas duplikowania posiłków')
        console.error(error)
        return
      }
    }

    // Refresh planned meals
    const dateStr = format(selectedDate, 'yyyy-MM-dd')
    const { data } = await supabase
      .from('meal_plan')
      .select('*')
      .eq('user_id', user.id)
      .eq('date', dateStr)

    if (data) {
      const plansWithMeals = await Promise.all(
        data.map(async (plan) => {
          const meal = allMeals.find((m) => m.id === plan.meal_id)
          return { ...plan, meal }
        })
      )
      setPlannedMeals(plansWithMeals)
    }
  }

  async function handleCopyFromMember() {
    if (!user?.id || !household?.id || !copyFromUserId) return

    const dateStr = format(selectedDate, 'yyyy-MM-dd')

    const { data: sourceMeals } = await supabase
      .from('meal_plan')
      .select('*')
      .eq('user_id', copyFromUserId)
      .eq('date', dateStr)

    if (!sourceMeals || sourceMeals.length === 0) {
      alert('Brak posiłków u wybranego domownika na ten dzień')
      return
    }

    const newMealPlans = sourceMeals.map((plan) => ({
      user_id: user.id,
      household_id: household.id,
      date: dateStr,
      meal_id: plan.meal_id,
      meal_type: plan.meal_type,
      is_consumed: false,
      is_skipped: false,
    }))

    const existingMealTypes = plannedMeals.map(m => m.meal_type)
    const mealsToAdd = newMealPlans.filter(plan => !existingMealTypes.includes(plan.meal_type))

    if (mealsToAdd.length === 0) {
      const confirmed = confirm('Wszystkie kategorie posiłków są już zaplanowane. Czy chcesz je zastąpić planem domownika?')
      if (!confirmed) return

      const existingPlanIds = plannedMeals.map(p => p.id)
      await supabase.from('meal_plan').delete().in('id', existingPlanIds)

      const { error } = await supabase.from('meal_plan').insert(newMealPlans)
      if (error) {
        alert('Błąd podczas kopiowania dnia domownika')
        console.error(error)
        return
      }
    } else {
      const { error } = await supabase.from('meal_plan').insert(mealsToAdd)
      if (error) {
        alert('Błąd podczas kopiowania dnia domownika')
        console.error(error)
        return
      }
    }

    const { data } = await supabase
      .from('meal_plan')
      .select('*')
      .eq('user_id', user.id)
      .eq('date', dateStr)

    if (data) {
      const plansWithMeals = await Promise.all(
        data.map(async (plan) => {
          const meal = allMeals.find((m) => m.id === plan.meal_id)
          return { ...plan, meal }
        })
      )
      setPlannedMeals(plansWithMeals)
    }
  }

  async function handleSendDayToMember() {
    if (!user?.id || !household?.id || !sendToUserId) return

    const dateStr = format(selectedDate, 'yyyy-MM-dd')

    const { data: sourceMeals } = await supabase
      .from('meal_plan')
      .select('*')
      .eq('user_id', user.id)
      .eq('date', dateStr)

    if (!sourceMeals || sourceMeals.length === 0) {
      alert('Brak posiłków do wysłania na ten dzień')
      return
    }

    const newMealPlans = sourceMeals.map((plan) => ({
      user_id: sendToUserId,
      household_id: household.id,
      date: dateStr,
      meal_id: plan.meal_id,
      meal_type: plan.meal_type,
      is_consumed: false,
      is_skipped: false,
    }))

    const { data: existingPlans } = await supabase
      .from('meal_plan')
      .select('*')
      .eq('user_id', sendToUserId)
      .eq('date', dateStr)

    if (existingPlans && existingPlans.length > 0) {
      const confirmed = confirm('Domownik ma już zaplanowane posiłki na ten dzień. Czy chcesz je zastąpić?')
      if (!confirmed) return

      const existingPlanIds = existingPlans.map((p) => p.id)
      await supabase.from('meal_plan').delete().in('id', existingPlanIds)
    }

    const { error } = await supabase.from('meal_plan').insert(newMealPlans)
    if (error) {
      alert('Błąd podczas wysyłania dnia do domownika')
      console.error(error)
    }
  }

  function handleWeekChange(direction: 'prev' | 'next') {
    const days = direction === 'prev' ? -7 : 7
    setSelectedDate(new Date(selectedDate.getTime() + days * 24 * 60 * 60 * 1000))
  }

  async function handleSelectMeal(category: MealCategory, meal: MealWithDetails) {
    if (!user?.id || !household?.id) return

    const dateStr = format(selectedDate, 'yyyy-MM-dd')

    console.log('Saving meal:', { category, mealId: meal.id, date: dateStr })

    // Check if meal already planned for this category
    const existing = plannedMeals.find((p) => p.meal_type === category)

    if (existing) {
      // Update existing
      const { error } = await supabase
        .from('meal_plan')
        .update({ meal_id: meal.id })
        .eq('id', existing.id)

      if (error) {
        console.error('Error updating meal plan:', error)
        alert('Błąd podczas aktualizacji posiłku: ' + error.message)
        return
      }

      console.log('Meal plan updated successfully')

      setPlannedMeals((current) =>
        current.map((p) =>
          p.id === existing.id ? { ...p, meal_id: meal.id, meal } : p
        )
      )
    } else {
      // Insert new
      const { data, error } = await supabase
        .from('meal_plan')
        .insert({
          date: dateStr,
          meal_id: meal.id,
          user_id: user.id,
          household_id: household.id,
          meal_type: category,
        })
        .select()
        .single()

      if (error) {
        console.error('Error inserting meal plan:', error)
        alert('Błąd podczas zapisywania posiłku: ' + error.message)
        return
      }

      console.log('Meal plan inserted successfully:', data)

      if (data) {
        setPlannedMeals((current) => [
          ...current,
          { ...data, meal },
        ])
      }
    }
  }

  function handleRandomMeal(category: MealCategory) {
    // Filter meals by category
    const primaryMeals = allMeals.filter((m) => m.primary_category === category)
    const alternativeMeals = allMeals.filter(
      (m) => m.primary_category !== category && m.alternative_categories?.includes(category)
    )

    let selectedMeal: MealWithDetails | null = null

    if (primaryMeals.length > 0) {
      selectedMeal = primaryMeals[Math.floor(Math.random() * primaryMeals.length)]
    } else if (alternativeMeals.length > 0) {
      selectedMeal = alternativeMeals[Math.floor(Math.random() * alternativeMeals.length)]
    } else if (allMeals.length > 0) {
      selectedMeal = allMeals[Math.floor(Math.random() * allMeals.length)]
    }

    if (selectedMeal) {
      handleSelectMeal(category, selectedMeal)
    }
  }

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

  async function handleToggleConsumed(category: MealCategory) {
    const plan = plannedMeals.find((p) => p.meal_type === category)
    if (!plan) return

    const newConsumedState = !plan.is_consumed

    const { error } = await supabase
      .from('meal_plan')
      .update({ 
        is_consumed: newConsumedState,
        is_skipped: newConsumedState ? false : plan.is_skipped
      })
      .eq('id', plan.id)

    if (error) {
      console.error('Error updating consumed state:', error)
      return
    }

    setPlannedMeals((current) =>
      current.map((p) =>
        p.id === plan.id ? { 
          ...p, 
          is_consumed: newConsumedState,
          is_skipped: newConsumedState ? false : p.is_skipped
        } : p
      )
    )
  }

  async function handleToggleSkipped(category: MealCategory) {
    const plan = plannedMeals.find((p) => p.meal_type === category)
    if (!plan) return

    const newSkippedState = !plan.is_skipped

    const { error } = await supabase
      .from('meal_plan')
      .update({ 
        is_skipped: newSkippedState,
        is_consumed: newSkippedState ? false : plan.is_consumed
      })
      .eq('id', plan.id)

    if (error) {
      console.error('Error updating skipped state:', error)
      return
    }

    setPlannedMeals((current) =>
      current.map((p) =>
        p.id === plan.id ? { 
          ...p, 
          is_skipped: newSkippedState,
          is_consumed: newSkippedState ? false : p.is_consumed
        } : p
      )
    )
  }



  const categories: MealCategory[] = useMemo(
    () => {
      const cats: MealCategory[] = ['breakfast']
      
      // Use fallback values if fields don't exist yet (for users before migration)
      const settings = (userSettings || {}) as Partial<UserSettings>
      const secondBreakfastEnabled = settings.second_breakfast_enabled !== false && settings.second_breakfast_enabled !== undefined
      const lunchEnabled = settings.lunch_enabled !== false && settings.lunch_enabled !== undefined
      const dinnerEnabled = settings.dinner_enabled !== false && settings.dinner_enabled !== undefined
      const snackEnabled = settings.snack_enabled === true
      
      if (secondBreakfastEnabled) cats.push('second_breakfast')
      if (lunchEnabled) cats.push('lunch')
      if (dinnerEnabled) cats.push('dinner')
      if (snackEnabled) cats.push('snack')
      
      return cats
    },
    [userSettings]
  )

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
      <div className="flex items-center justify-center p-8">
        <div className="text-gray-500">Ładowanie...</div>
      </div>
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
          <div className="text-center py-8 text-gray-500">Ładowanie planu...</div>
        ) : (
          <>
            {/* Mobile slider view */}
            <div ref={sliderRef} className="flex gap-4 overflow-x-auto snap-x snap-mandatory pb-2 md:pb-4 -mx-4 px-4 scrollbar-hide lg:hidden">
              {categories.map((category) => (
                <div key={category} className="flex-none w-[85vw] md:w-[calc(50%-0.5rem)] snap-center">
                  <MealSlot
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
      {plannedMeals.length > 0 && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <h4 className="text-sm font-semibold text-gray-700 mb-3">Zjedzono dzisiaj:</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="bg-white rounded-lg p-3">
                <div className="text-xs text-gray-500 mb-1">Kalorie</div>
                <div className="text-xl font-bold text-gray-900">
                  {Math.round(
                    plannedMeals
                      .filter(p => p.is_consumed)
                      .reduce((sum, p) => sum + (p.meal?.totalKcal || 0), 0)
                  )}
                </div>
                <div className="text-xs text-gray-500">
                  / {Math.round(plannedMeals.reduce((sum, p) => sum + (p.meal?.totalKcal || 0), 0))} kcal
                </div>
              </div>
              
              <div className="bg-white rounded-lg p-3">
                <div className="text-xs text-gray-500 mb-1">Białko</div>
                <div className="text-xl font-bold text-gray-900">
                  {Math.round(
                    plannedMeals
                      .filter(p => p.is_consumed && p.meal)
                      .reduce((sum, p) => {
                        return sum + ((p.meal?.items || []).reduce((itemSum, item) => {
                          const product = item.product
                          return itemSum + (product?.protein || 0) * item.amount
                        }, 0))
                      }, 0)
                  )}g
                </div>
                <div className="text-xs text-gray-500">
                  / {Math.round(
                    plannedMeals
                      .filter(p => p.meal)
                      .reduce((sum, p) => {
                        return sum + ((p.meal?.items || []).reduce((itemSum, item) => {
                          const product = item.product
                          return itemSum + (product?.protein || 0) * item.amount
                        }, 0))
                      }, 0)
                  )}g
                </div>
              </div>
              
              <div className="bg-white rounded-lg p-3">
                <div className="text-xs text-gray-500 mb-1">Tłuszcze</div>
                <div className="text-xl font-bold text-gray-900">
                  {Math.round(
                    plannedMeals
                      .filter(p => p.is_consumed && p.meal)
                      .reduce((sum, p) => {
                        return sum + ((p.meal?.items || []).reduce((itemSum, item) => {
                          const product = item.product
                          return itemSum + (product?.fat || 0) * item.amount
                        }, 0))
                      }, 0)
                  )}g
                </div>
                <div className="text-xs text-gray-500">
                  / {Math.round(
                    plannedMeals
                      .filter(p => p.meal)
                      .reduce((sum, p) => {
                        return sum + ((p.meal?.items || []).reduce((itemSum, item) => {
                          const product = item.product
                          return itemSum + (product?.fat || 0) * item.amount
                        }, 0))
                      }, 0)
                  )}g
                </div>
              </div>
              
              <div className="bg-white rounded-lg p-3">
                <div className="text-xs text-gray-500 mb-1">Węglowodany</div>
                <div className="text-xl font-bold text-gray-900">
                  {Math.round(
                    plannedMeals
                      .filter(p => p.is_consumed && p.meal)
                      .reduce((sum, p) => {
                        return sum + ((p.meal?.items || []).reduce((itemSum, item) => {
                          const product = item.product
                          return itemSum + (product?.carbs || 0) * item.amount
                        }, 0))
                      }, 0)
                  )}g
                </div>
                <div className="text-xs text-gray-500">
                  / {Math.round(
                    plannedMeals
                      .filter(p => p.meal)
                      .reduce((sum, p) => {
                        return sum + ((p.meal?.items || []).reduce((itemSum, item) => {
                          const product = item.product
                          return itemSum + (product?.carbs || 0) * item.amount
                        }, 0))
                      }, 0)
                  )}g
                </div>
              </div>
            </div>
          </div>
        )}

      {/* Duplicate from previous day */}
      <button
        onClick={handleDuplicateFromPreviousDay}
        className="w-full bg-blue-600 text-white px-4 py-3 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
        </svg>
        Duplikuj z wczoraj
      </button>

      {/* Copy day from household member */}
      <div className="bg-white rounded-lg border border-gray-200 p-3 space-y-3">
        <div className="text-sm font-semibold text-gray-900">Kopiuj dzień od domownika</div>
        <select
          value={copyFromUserId}
          onChange={(e) => setCopyFromUserId(e.target.value)}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-black focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
        >
          <option value="">Wybierz domownika...</option>
          {householdMembers.map((member) => (
            <option key={member.user_id} value={member.user_id}>
              {member.display_name || 'Bez nazwy'}
            </option>
          ))}
        </select>
        <button
          onClick={handleCopyFromMember}
          disabled={!copyFromUserId}
          className="w-full bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
        >
          Kopiuj dzień od domownika
        </button>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-3 space-y-3">
        <div className="text-sm font-semibold text-gray-900">Wyślij dzień do domownika</div>
        <select
          value={sendToUserId}
          onChange={(e) => setSendToUserId(e.target.value)}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-black focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
        >
          <option value="">Wybierz domownika...</option>
          {householdMembers.map((member) => (
            <option key={member.user_id} value={member.user_id}>
              {member.display_name || 'Bez nazwy'}
            </option>
          ))}
        </select>
        <button
          onClick={handleSendDayToMember}
          disabled={!sendToUserId}
          className="w-full bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-emerald-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
        >
          Wyślij dzień do domownika
        </button>
      </div>
    </div>
  )
}
