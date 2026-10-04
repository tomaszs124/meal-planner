'use client'

import { useEffect, useState, useRef } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase, type Household } from '@/lib/supabase/client'
import { useFeedback } from '@/components/ui/Feedback'
import { inChunks } from '@/lib/meals-data'
import {
  collectPlanIngredients,
  indexIngredientRows,
  scaleAmounts,
  toShoppingListInsertRows,
  type IngredientRow,
  type PlanRow,
} from '@/lib/shopping'
import type { GroupedItem, ShoppingListItemWithProduct } from './types'

/**
 * Owns the household shopping list: items, generated date range, per-meal servings,
 * the realtime subscription + polling, and every mutation. All race guards
 * (updatingServingsRef, updateInFlightRef, fetchVersionRef) live here so the
 * functions sharing them stay in one closure.
 */
export function useShoppingList(household: Household | null, user: User | null) {
  const { toast, confirm } = useFeedback()
  const [items, setItems] = useState<ShoppingListItemWithProduct[]>([])

  const [isGenerating, setIsGenerating] = useState(false)
  const [showGenerateSuccess, setShowGenerateSuccess] = useState(false)
  const [mealServingsById, setMealServingsById] = useState<Record<string, number>>({})
  const [generatedRange, setGeneratedRange] = useState<{ startDate: string; endDate: string } | null>(null)
  const [updatingServingsKey, setUpdatingServingsKey] = useState<string | null>(null)
  // Ref used as the actual mutex — updated synchronously unlike state.
  // State (updatingServingsKey) is only for disabling the UI buttons.
  const updatingServingsRef = useRef(false)
  // Blocks realtime-triggered fetchItems() while updateMealServings is in progress
  const updateInFlightRef = useRef(0)
  // Incremented whenever updateMealServings starts. fetchItems() captures this at
  // the start and discards results if the token changed while it was awaiting —
  // prevents a slow in-flight fetch from overwriting freshly-written update data.
  const fetchVersionRef = useRef(0)

  // Fetch shopping list items
  useEffect(() => {
    const householdId = household?.id
    if (!householdId) return

    async function fetchItems() {
      // Skip if our own update is in progress.
      if (updateInFlightRef.current > 0) return

      // Capture version token before any await. If updateMealServings starts
      // while this fetch is in flight, the token will change and we discard
      // the (now stale) results instead of overwriting the fresh update data.
      const versionAtStart = fetchVersionRef.current

      const { data: stateData } = await supabase
        .from('shopping_list_state')
        .select('generated_start_date, generated_end_date, meal_servings')
        .eq('household_id', householdId)
        .maybeSingle()

      if (fetchVersionRef.current !== versionAtStart) return

      if (stateData?.generated_start_date && stateData?.generated_end_date) {
        setGeneratedRange({
          startDate: stateData.generated_start_date,
          endDate: stateData.generated_end_date,
        })
      } else {
        setGeneratedRange(null)
      }

      const servingsMap = (stateData?.meal_servings || {}) as Record<string, number>
      setMealServingsById(servingsMap)

      const { data, error } = await supabase
        .from('shopping_list_items')
        .select('*, product:products(*), meal:meals(id, name, description, images:meal_images(*), tags:meal_tags(tag_id, tags(*)))')
        .eq('household_id', householdId)
        .order('created_at', { ascending: false })
        .order('id', { ascending: true })

      if (fetchVersionRef.current !== versionAtStart) return

      if (!error && data) {
        setItems(data as unknown as ShoppingListItemWithProduct[])
      }
    }

    fetchItems()

    const refreshInterval = setInterval(() => {
      void fetchItems()
    }, 30000)

    // Subscribe to realtime changes
    const channel = supabase
      .channel('shopping-list-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'shopping_list_items',
          filter: `household_id=eq.${householdId}`,
        },
        async () => {
          await fetchItems()
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'shopping_list_state',
          filter: `household_id=eq.${householdId}`,
        },
        async () => {
          await fetchItems()
        }
      )
      .subscribe()

    return () => {
      clearInterval(refreshInterval)
      channel.unsubscribe()
    }
  }, [household])

  // Generate shopping list from meal plans
  async function generateFromMealPlans(selectedMembers: string[], startDate: string, endDate: string) {
    const householdId = household?.id
    const userId = user?.id
    if (!householdId || selectedMembers.length === 0) return

    setIsGenerating(true)

    try {
      // Fetch meal plans for selected members and date range
      const { data: mealPlansData } = await supabase
        .from('meal_plan')
        .select('*, meals!inner(*)')
        .eq('household_id', householdId)
        .in('user_id', selectedMembers)
        .gte('date', startDate)
        .lte('date', endDate)

      if (!mealPlansData || mealPlansData.length === 0) {
        toast('Brak zaplanowanych posiłków w wybranym okresie', { type: 'info' })
        setIsGenerating(false)
        return
      }

      // Load ingredients for every planned meal in two batched queries
      // (base recipes + overrides of the selected members) instead of 1-2 per plan row.
      const planRows = mealPlansData as PlanRow[]
      const mealIds = Array.from(new Set(planRows.map((plan) => plan.meal_id)))
      const [baseItems, overrides] = await Promise.all([
        inChunks(mealIds, (ids) =>
          supabase.from('meal_items').select('*, product:products(*)').in('meal_id', ids)
        ),
        inChunks(mealIds, (ids) =>
          supabase
            .from('meal_item_overrides')
            .select('*, product:products(*)')
            .in('meal_id', ids)
            .in('user_id', selectedMembers)
        ),
      ])

      const { baseItemsByMeal, overridesByMealAndUser } = indexIngredientRows(
        baseItems as IngredientRow[],
        overrides as IngredientRow[]
      )
      const { items: aggregatedItems, servingsByGroupKey: generatedServingsByGroupKey } = collectPlanIngredients(
        planRows,
        baseItemsByMeal,
        overridesByMealAndUser
      )

      if (aggregatedItems.length === 0) {
        toast('Brak składników w zaplanowanych posiłkach', { type: 'info' })
        setIsGenerating(false)
        return
      }

      // Clear existing items (optional - you might want to ask user)
      if (items.length > 0) {
        const confirmClear = await confirm({ message: 'Czy chcesz wyczyścić istniejącą listę zakupów przed wygenerowaniem nowej?', danger: true, confirmLabel: 'Wyczyść', cancelLabel: 'Zachowaj' })
        if (confirmClear === null) {
          // Dismissed (Escape / backdrop): abort instead of silently appending a second copy
          setIsGenerating(false)
          return
        }
        if (confirmClear) {
          await supabase
            .from('shopping_list_items')
            .delete()
            .eq('household_id', householdId)
        }
      }

      // Insert items into shopping list
      const itemsToInsert = toShoppingListInsertRows(aggregatedItems, householdId, userId || null)

      const { error } = await supabase
        .from('shopping_list_items')
        .insert(itemsToInsert)

      if (error) {
        toast('Błąd podczas generowania listy: ' + error.message, { type: 'error' })
      } else {
        const nextGeneratedRange = { startDate, endDate }
        const { error: stateError } = await supabase
          .from('shopping_list_state')
          .upsert({
            household_id: householdId,
            generated_start_date: nextGeneratedRange.startDate,
            generated_end_date: nextGeneratedRange.endDate,
            meal_servings: generatedServingsByGroupKey,
            updated_by: userId || null,
          })

        if (!stateError) {
          setGeneratedRange(nextGeneratedRange)
          setMealServingsById(generatedServingsByGroupKey)
        }

        const { data: refreshedItems, error: refreshError } = await supabase
          .from('shopping_list_items')
          .select('*, product:products(*), meal:meals(id, name, description, images:meal_images(*), tags:meal_tags(tag_id, tags(*)))')
          .eq('household_id', householdId)
          .order('created_at', { ascending: false })
          .order('id', { ascending: true })

        if (!refreshError && refreshedItems) {
          setItems(refreshedItems as unknown as ShoppingListItemWithProduct[])
        }

        setShowGenerateSuccess(true)
        setTimeout(() => {
          setShowGenerateSuccess(false)
        }, 2000)
      }
    } catch (error) {
      console.error('Error generating shopping list:', error)
      toast('Wystąpił błąd podczas generowania listy', { type: 'error' })
    }

    setIsGenerating(false)
  }

  // Toggle item checked status for grouped item
  async function toggleGroupedItem(groupedItem: GroupedItem) {
    const newCheckedState = !groupedItem.allChecked

    // Update local state for all items in the group
    setItems((current) =>
      current.map((i) => 
        groupedItem.itemIds.includes(i.id) 
          ? { ...i, is_checked: newCheckedState } 
          : i
      )
    )

    // Update all items in database
    const { error } = await supabase
      .from('shopping_list_items')
      .update({
        is_checked: newCheckedState,
        checked_at: newCheckedState ? new Date().toISOString() : null,
        checked_by: newCheckedState ? user?.id : null,
      })
      .in('id', groupedItem.itemIds)

    if (error) {
      // Revert on error
      setItems((current) =>
        current.map((i) => 
          groupedItem.itemIds.includes(i.id) 
            ? { ...i, is_checked: !newCheckedState } 
            : i
        )
      )
    }
  }

  async function toggleSingleItem(item: ShoppingListItemWithProduct) {
    const newCheckedState = !item.is_checked

    setItems((current) =>
      current.map((currentItem) =>
        currentItem.id === item.id
          ? { ...currentItem, is_checked: newCheckedState }
          : currentItem
      )
    )

    const { error } = await supabase
      .from('shopping_list_items')
      .update({
        is_checked: newCheckedState,
        checked_at: newCheckedState ? new Date().toISOString() : null,
        checked_by: newCheckedState ? user?.id : null,
      })
      .eq('id', item.id)

    if (error) {
      setItems((current) =>
        current.map((currentItem) =>
          currentItem.id === item.id
            ? { ...currentItem, is_checked: item.is_checked }
            : currentItem
        )
      )
    }
  }

  // Delete grouped item (deletes all items in the group)
  async function deleteGroupedItem(groupedItem: GroupedItem) {
    setItems((current) => current.filter((i) => !groupedItem.itemIds.includes(i.id)))

    const { error } = await supabase
      .from('shopping_list_items')
      .delete()
      .in('id', groupedItem.itemIds)

    if (error) {
      const householdId = household?.id
      if (!householdId) return
      const { data } = await supabase
        .from('shopping_list_items')
        .select('*, product:products(*), meal:meals(id, name, description, images:meal_images(*), tags:meal_tags(tag_id, tags(*)))')
        .eq('household_id', householdId)
        .order('created_at', { ascending: false })
        .order('id', { ascending: true })

      if (data) {
        setItems(data as unknown as ShoppingListItemWithProduct[])
      }
    }
  }

  // Clear checked items
  async function clearCheckedItems() {
    if (!household?.id) return
    
    const checkedIds = items.filter(i => i.is_checked).map(i => i.id)
    if (checkedIds.length === 0) return

    if (!(await confirm({ message: `Czy chcesz usunąć ${checkedIds.length} zaznaczonych elementów?`, danger: true, confirmLabel: 'Usuń' }))) return

    const { error } = await supabase
      .from('shopping_list_items')
      .delete()
      .in('id', checkedIds)

    if (error) {
      toast('Błąd podczas usuwania elementów', { type: 'error' })
    }
  }

  // Delete entire meal group
  async function deleteMealGroup(mealGroup: { group_key: string; meal_id: string; items: ShoppingListItemWithProduct[] }) {
    const itemIds = mealGroup.items.map(i => i.id)

    const { error } = await supabase
      .from('shopping_list_items')
      .delete()
      .in('id', itemIds)

    if (error) {
      toast('Błąd podczas usuwania dania', { type: 'error' })
      return
    }

    // Remove items from local state immediately — don't wait for realtime/polling.
    setItems((current) => current.filter((i) => !itemIds.includes(i.id)))

    if (household?.id) {
      const nextMap = { ...mealServingsById }
      delete nextMap[mealGroup.group_key]
      setMealServingsById(nextMap)

      await supabase
        .from('shopping_list_state')
        .upsert({
          household_id: household.id,
          meal_servings: nextMap,
          updated_by: user?.id || null,
        })
    }
  }

  async function updateMealServings(mealGroup: { group_key: string; meal_id: string; source_user_id: string | null }, nextServings: number) {
    const householdId = household?.id
    const userId = user?.id
    if (!householdId) return
    if (!Number.isFinite(nextServings) || nextServings <= 0) return

    // updatingServingsRef is a ref (not state) so this check is synchronous.
    // Two rapid clicks both see the updated value immediately — unlike state which
    // is batched and would let both clicks pass the guard before re-rendering.
    if (updatingServingsRef.current) return
    updatingServingsRef.current = true
    // Invalidate any in-flight fetchItems() so it discards stale results.
    fetchVersionRef.current += 1

    const currentServings = mealServingsById[mealGroup.group_key] ?? 1
    if (Math.abs(currentServings - nextServings) < 0.0001) {
      updatingServingsRef.current = false
      return
    }

    const scale = nextServings / currentServings
    const mealItems = items.filter(
      (item) =>
        item.meal_id === mealGroup.meal_id &&
        (item.source_user_id || null) === (mealGroup.source_user_id || null) &&
        !item.custom_amount_text
    )

    setUpdatingServingsKey(mealGroup.group_key)
    updateInFlightRef.current += 1
    try {
      const nextMap = { ...mealServingsById, [mealGroup.group_key]: nextServings }

      if (mealItems.length === 0) {
        setMealServingsById(nextMap)
        await supabase.from('shopping_list_state').upsert({
          household_id: householdId,
          meal_servings: nextMap,
          updated_by: userId || null,
        })
        return
      }

      const updatedAmounts = scaleAmounts(mealItems, scale)

      // 1. Persist serving count first so DB is consistent when items are written.
      const { error: stateError } = await supabase
        .from('shopping_list_state')
        .upsert({
          household_id: householdId,
          meal_servings: nextMap,
          updated_by: userId || null,
        })

      if (stateError) {
        toast('Błąd podczas zmiany ilości dania', { type: 'error' })
        return
      }

      // 2. Persist new item amounts.
      const results = await Promise.all(
        updatedAmounts.map((updated) =>
          supabase
            .from('shopping_list_items')
            .update({ amount: updated.amount })
            .eq('id', updated.id)
        )
      )

      if (results.some((result) => result.error)) {
        toast('Błąd podczas zmiany ilości dania', { type: 'error' })
        return
      }

      // 3. Update local state after confirmed DB write.
      setMealServingsById(nextMap)
      const amountById = new Map(updatedAmounts.map((u) => [u.id, u.amount]))
      setItems((current) =>
        current.map((item) =>
          amountById.has(item.id) ? { ...item, amount: amountById.get(item.id)! } : item
        )
      )
    } finally {
      updatingServingsRef.current = false
      updateInFlightRef.current -= 1
      setUpdatingServingsKey(null)
    }
  }

  return {
    items,
    isGenerating,
    showGenerateSuccess,
    mealServingsById,
    generatedRange,
    updatingServingsKey,
    generateFromMealPlans,
    toggleGroupedItem,
    toggleSingleItem,
    deleteGroupedItem,
    clearCheckedItems,
    deleteMealGroup,
    updateMealServings,
  }
}
