'use client'

import { useEffect, useState } from 'react'
import { format, startOfWeek, addDays } from 'date-fns'
import { supabase, Meal, MealCategory } from '@/lib/supabase/client'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { useUserSettings } from '@/hooks/useUserSettings'
import { fetchMealsWithDetails, type MealWithDetails } from '@/lib/meals-data'
import { useFeedback } from '@/components/ui/Feedback'
import {
  buildWeekProgress,
  filterMissingMealTypes,
  getUniquePlansByMealType,
  getWeekDays,
  pickRandomMeal,
  toCopiedPlanRows,
  type DayProgress,
  type MealPlanRow,
  type WeekPlanRow,
} from '@/lib/plan'
import type { HouseholdMember, PlannedMeal } from './types'

/** Fetches the user's meal_plan rows for one date and attaches loaded meals. Returns null when the query yields no data. */
async function fetchDayPlans(
  householdId: string,
  userId: string,
  dateStr: string,
  allMeals: MealWithDetails[]
): Promise<PlannedMeal[] | null> {
  const { data } = await supabase
    .from('meal_plan')
    .select('*')
    .eq('household_id', householdId)
    .eq('user_id', userId)
    .eq('date', dateStr)

  if (!data) return null

  return data.map((plan: PlannedMeal) => {
    const meal = allMeals.find((m) => m.id === plan.meal_id)
    return { ...plan, meal }
  })
}

/**
 * Data + mutations for the day planner: user settings (with realtime), household
 * members, all meals, the selected day's plan, week progress and day actions.
 */
export function useMealPlan() {
  const { user, household, isLoading: userLoading } = useCurrentUser()
  const { toast, confirm } = useFeedback()
  const [selectedDate, setSelectedDate] = useState(new Date())
  // Shared cache with realtime updates; creates default settings on first use
  const { settings: userSettings } = useUserSettings(user?.id)
  const [plannedMeals, setPlannedMeals] = useState<PlannedMeal[]>([])
  const [allMeals, setAllMeals] = useState<MealWithDetails[]>([])
  // true once the meals query finished (even with zero meals), so the day plan can stop loading
  const [mealsLoaded, setMealsLoaded] = useState(false)
  const [weekProgress, setWeekProgress] = useState<DayProgress[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [householdMembers, setHouseholdMembers] = useState<HouseholdMember[]>([])
  const [copyFromUserId, setCopyFromUserId] = useState('')
  const [sendToUserId, setSendToUserId] = useState('')
  const [copySuccessMsg, setCopySuccessMsg] = useState('')
  const [sendSuccessMsg, setSendSuccessMsg] = useState('')

  // Fetch all meals for household
  useEffect(() => {
    const householdId = household?.id
    const userId = user?.id
    if (!householdId || !userId) return

    let cancelled = false

    async function fetchMeals(householdId: string, userId: string) {
      try {
        // Batched loader: a fixed number of queries per household instead of 4 per meal
        const mealsWithDetails = await fetchMealsWithDetails(supabase, { householdId, userId })
        if (!cancelled) setAllMeals(mealsWithDetails)
      } catch (error) {
        console.error('Error fetching meals:', error)
      } finally {
        if (!cancelled) setMealsLoaded(true)
      }
    }

    fetchMeals(householdId, userId)

    return () => {
      cancelled = true
    }
  }, [household?.id, user?.id])

  // Fetch household members for copy from member
  useEffect(() => {
    const householdId = household?.id
    if (!householdId) {
      return
    }

    async function fetchMembers() {
      const { data: membersData } = await supabase
        .from('household_users')
        .select('user_id')
        .eq('household_id', householdId)

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
    const userId = user?.id
    const householdId = household?.id
    if (!userId || !householdId) return

    async function fetchPlannedMeals(userId: string, householdId: string) {
      setIsLoading(true)

      const dateStr = format(selectedDate, 'yyyy-MM-dd')
      const plansWithMeals = await fetchDayPlans(householdId, userId, dateStr, allMeals)
      setPlannedMeals(plansWithMeals ?? [])

      setIsLoading(false)
    }

    // Wait for the meals list so plans can be joined with meal details, but do not
    // hang on "Ładowanie planu..." forever when the household has no meals yet.
    if (allMeals.length > 0 || mealsLoaded) {
      fetchPlannedMeals(userId, householdId)
    }
  }, [user?.id, household?.id, selectedDate, allMeals, mealsLoaded])

  // Fetch week progress
  useEffect(() => {
    const userId = user?.id
    const householdId = household?.id
    if (!userId || !householdId || allMeals.length === 0) return

    // Re-runs on plannedMeals changes so the progress bar follows consumed toggles;
    // `cancelled` drops responses from superseded runs.
    let cancelled = false

    async function fetchWeekProgress() {
      const weekDays = getWeekDays(selectedDate)
      const weekStartStr = weekDays[0]
      const weekEndStr = weekDays[6]

      // One query for the whole week instead of one per day
      const { data } = await supabase
        .from('meal_plan')
        .select('date, meal_id, is_consumed')
        .eq('household_id', householdId)
        .eq('user_id', userId)
        .gte('date', weekStartStr)
        .lte('date', weekEndStr)

      if (cancelled) return

      const kcalByMealId = new Map(allMeals.map((m) => [m.id, m.totalKcal]))
      setWeekProgress(buildWeekProgress(data as WeekPlanRow[] | null, kcalByMealId, weekDays))
    }

    fetchWeekProgress()

    return () => {
      cancelled = true
    }
  }, [user?.id, household?.id, selectedDate, allMeals, plannedMeals])

  async function handleDuplicateFromPreviousDay() {
    const userId = user?.id
    const householdId = household?.id
    if (!userId || !householdId) return

    const previousDate = new Date(selectedDate)
    previousDate.setDate(previousDate.getDate() - 1)
    const previousDateStr = format(previousDate, 'yyyy-MM-dd')
    const currentDateStr = format(selectedDate, 'yyyy-MM-dd')

    // Fetch meals from previous day
    const { data: previousMeals } = await supabase
      .from('meal_plan')
      .select('*')
      .eq('household_id', householdId)
      .eq('user_id', userId)
      .eq('date', previousDateStr)

    if (!previousMeals || previousMeals.length === 0) {
      toast('Brak posiłków z poprzedniego dnia', { type: 'info' })
      return
    }

    const uniquePreviousMeals = getUniquePlansByMealType(previousMeals as MealPlanRow[])

    // Create new meal plans for current day (without consumed/skipped status)
    const newMealPlans = toCopiedPlanRows(uniquePreviousMeals, { userId, householdId, date: currentDateStr })

    // Check which meal types already exist
    const mealsToAdd = filterMissingMealTypes(newMealPlans, plannedMeals)

    if (mealsToAdd.length === 0) {
      // All slots are filled - ask for confirmation
      const confirmed = await confirm({
        message: 'Wszystkie kategorie posiłków są już zaplanowane. Czy chcesz je zastąpić posiłkami z wczoraj?',
        danger: true,
        confirmLabel: 'Zastąp',
      })
      if (!confirmed) return

      // Delete all current meals for today and add previous day's meals
      const existingPlanIds = plannedMeals.map(p => p.id)
      await supabase.from('meal_plan').delete().in('id', existingPlanIds)

      const { error } = await supabase.from('meal_plan').insert(newMealPlans)
      if (error) {
        toast('Błąd podczas duplikowania posiłków', { type: 'error' })
        console.error(error)
        return
      }
    } else {
      // Some slots are empty - add without confirmation
      const { error } = await supabase.from('meal_plan').insert(mealsToAdd)

      if (error) {
        toast('Błąd podczas duplikowania posiłków', { type: 'error' })
        console.error(error)
        return
      }
    }

    // Refresh planned meals
    const dateStr = format(selectedDate, 'yyyy-MM-dd')
    const plansWithMeals = await fetchDayPlans(householdId, userId, dateStr, allMeals)
    if (plansWithMeals) setPlannedMeals(plansWithMeals)
  }

  async function handleCopyFromMember() {
    const userId = user?.id
    const householdId = household?.id
    if (!userId || !householdId || !copyFromUserId) return

    const dateStr = format(selectedDate, 'yyyy-MM-dd')

    const { data: sourceMeals } = await supabase
      .from('meal_plan')
      .select('*')
      .eq('household_id', householdId)
      .eq('user_id', copyFromUserId)
      .eq('date', dateStr)

    if (!sourceMeals || sourceMeals.length === 0) {
      toast('Brak posiłków u wybranego domownika na ten dzień', { type: 'info' })
      return
    }

    const uniqueSourceMeals = getUniquePlansByMealType(sourceMeals as MealPlanRow[])

    const newMealPlans = toCopiedPlanRows(uniqueSourceMeals, { userId, householdId, date: dateStr })

    const mealsToAdd = filterMissingMealTypes(newMealPlans, plannedMeals)

    if (mealsToAdd.length === 0) {
      const confirmed = await confirm({
        message: 'Wszystkie kategorie posiłków są już zaplanowane. Czy chcesz je zastąpić planem domownika?',
        danger: true,
        confirmLabel: 'Zastąp',
      })
      if (!confirmed) return

      const existingPlanIds = plannedMeals.map(p => p.id)
      await supabase.from('meal_plan').delete().in('id', existingPlanIds)

      const { error } = await supabase.from('meal_plan').insert(newMealPlans)
      if (error) {
        toast('Błąd podczas kopiowania dnia domownika', { type: 'error' })
        console.error(error)
        return
      }
    } else {
      const { error } = await supabase.from('meal_plan').insert(mealsToAdd)
      if (error) {
        toast('Błąd podczas kopiowania dnia domownika', { type: 'error' })
        console.error(error)
        return
      }
    }

    const plansWithMeals = await fetchDayPlans(householdId, userId, dateStr, allMeals)
    if (plansWithMeals) setPlannedMeals(plansWithMeals)

    setCopySuccessMsg('Dzień domownika skopiowany pomyślnie!')
    setTimeout(() => setCopySuccessMsg(''), 4000)
  }

  async function handleSendDayToMember() {
    const userId = user?.id
    const householdId = household?.id
    if (!userId || !householdId || !sendToUserId) return

    const dateStr = format(selectedDate, 'yyyy-MM-dd')

    const { data: sourceMeals } = await supabase
      .from('meal_plan')
      .select('*')
      .eq('household_id', householdId)
      .eq('user_id', userId)
      .eq('date', dateStr)

    if (!sourceMeals || sourceMeals.length === 0) {
      toast('Brak posiłków do wysłania na ten dzień', { type: 'info' })
      return
    }

    const uniqueSourceMeals = getUniquePlansByMealType(sourceMeals as MealPlanRow[])

    const newMealPlans = toCopiedPlanRows(uniqueSourceMeals, { userId: sendToUserId, householdId, date: dateStr })

    const { data: existingPlans } = await supabase
      .from('meal_plan')
      .select('*')
      .eq('household_id', householdId)
      .eq('user_id', sendToUserId)
      .eq('date', dateStr)

    if (existingPlans && existingPlans.length > 0) {
      const confirmed = await confirm({
        message: 'Domownik ma już zaplanowane posiłki na ten dzień. Czy chcesz je zastąpić?',
        danger: true,
        confirmLabel: 'Zastąp',
      })
      if (!confirmed) return

      const existingPlanIds = existingPlans.map((p: { id: string }) => p.id)
      await supabase.from('meal_plan').delete().in('id', existingPlanIds)
    }

    const { error } = await supabase.from('meal_plan').insert(newMealPlans)
    if (error) {
      toast('Błąd podczas wysyłania dnia do domownika', { type: 'error' })
      console.error(error)
      return
    }

    setSendSuccessMsg('Dzień wysłany do domownika pomyślnie!')
    setTimeout(() => setSendSuccessMsg(''), 4000)
  }

  function handleWeekChange(direction: 'prev' | 'next') {
    const today = new Date()
    const currentWeekStart = startOfWeek(selectedDate, { weekStartsOn: 1 })
    const targetWeekStart = addDays(currentWeekStart, direction === 'next' ? 7 : -7)
    const todayWeekStart = startOfWeek(today, { weekStartsOn: 1 })
    const isTodaysWeek = targetWeekStart.getTime() === todayWeekStart.getTime()

    if (isTodaysWeek) {
      setSelectedDate(today)
    } else if (direction === 'next') {
      setSelectedDate(targetWeekStart) // poniedziałek
    } else {
      setSelectedDate(addDays(targetWeekStart, 6)) // niedziela
    }
  }

  async function handleSelectMeal(category: MealCategory, pickedMeal: Meal) {
    if (!user?.id || !household?.id) return

    // Child components type meals loosely; resolve the fully loaded meal from allMeals.
    const meal = allMeals.find((m) => m.id === pickedMeal.id) ?? (pickedMeal as MealWithDetails)

    const dateStr = format(selectedDate, 'yyyy-MM-dd')


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
        toast('Błąd podczas aktualizacji posiłku: ' + error.message, { type: 'error' })
        return
      }


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
        toast('Błąd podczas zapisywania posiłku: ' + error.message, { type: 'error' })
        return
      }


      if (data) {
        setPlannedMeals((current) => [
          ...current,
          { ...data, meal },
        ])
      }
    }
  }

  function handleRandomMeal(category: MealCategory) {
    if (allMeals.length === 0) return

    const selectedMeal = pickRandomMeal(allMeals, category, format(selectedDate, 'yyyy-MM-dd'))

    if (selectedMeal) {
      handleSelectMeal(category, selectedMeal)
    }
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

  return {
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
  }
}
