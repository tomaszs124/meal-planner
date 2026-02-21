'use client'

import { useEffect, useState, useRef } from 'react'
import { format, addDays, startOfMonth, endOfMonth, startOfWeek, endOfWeek, isSameMonth, isSameDay, parseISO } from 'date-fns'
import { pl } from 'date-fns/locale'
import { supabase, ShoppingListItem, Product, Profile, UserSettings, Meal, MealImage, Tag } from '@/lib/supabase/client'
import { useCurrentUser } from '@/hooks/useCurrentUser'

const UNCATEGORIZED_LABEL = 'Pozostałe'
// Helper function to format amount without trailing zeros
function formatAmount(amount: number): string {
  return Number(amount.toFixed(2)).toString()
}

// Funkcja tłumacząca jednostki na polski
function translateUnit(unitType: string): string {
  const units: { [key: string]: string } = {
    '100g': 'g',
    'piece': 'szt',
    'tablespoon': 'łyżka',
    'teaspoon': 'łyżeczka',
  }
  return units[unitType] || unitType
}
type HouseholdMember = {
  user_id: string
  profile?: Profile
  settings?: UserSettings
}

type ShoppingListItemWithProduct = ShoppingListItem & {
  product?: Product
  meal?: Meal & {
    images?: MealImage[]
    tags?: { tag_id: string; tags: Tag }[]
  }
}

type GroupedItem = {
  key: string
  name: string
  product_id: string | null
  product?: Product
  totalAmount: number
  unit_type: string | null
  custom_amount_text: string | null
  itemIds: string[]
  allChecked: boolean
  anyChecked: boolean
}

// Date Range Picker Component
function DateRangePicker({ 
  startDate, 
  endDate, 
  onStartChange, 
  onEndChange 
}: { 
  startDate: string
  endDate: string
  onStartChange: (date: string) => void
  onEndChange: (date: string) => void
}) {
  const [isOpen, setIsOpen] = useState(false)
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [selectingStart, setSelectingStart] = useState(true)
  const pickerRef = useRef<HTMLDivElement>(null)

  // Close on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (pickerRef.current && !pickerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const monthStart = startOfMonth(currentMonth)
  const monthEnd = endOfMonth(currentMonth)
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 })
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 })

  const days = []
  let day = calendarStart
  while (day <= calendarEnd) {
    days.push(day)
    day = addDays(day, 1)
  }

  const handleDayClick = (day: Date) => {
    const dateStr = format(day, 'yyyy-MM-dd')
    
    if (selectingStart) {
      onStartChange(dateStr)
      onEndChange(dateStr)
      setSelectingStart(false)
    } else {
      const start = parseISO(startDate)
      if (day < start) {
        onStartChange(dateStr)
      } else {
        onEndChange(dateStr)
      }
      setIsOpen(false)
      setSelectingStart(true)
    }
  }

  const start = parseISO(startDate)
  const end = parseISO(endDate)

  return (
    <div className="relative" ref={pickerRef}>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        Zakres dat
      </label>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center gap-2 p-3 rounded-lg border border-gray-300 bg-white hover:border-gray-400 transition-colors"
      >
        <svg className="w-5 h-5 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
        <span className="text-sm text-gray-700">
          {format(start, 'd MMM yyyy', { locale: pl })} → {format(end, 'd MMM yyyy', { locale: pl })}
        </span>
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-2 bg-white rounded-lg shadow-xl border border-gray-200 p-4 z-50 w-80">
          {/* Month navigation */}
          <div className="flex items-center justify-between mb-4">
            <button
              type="button"
              onClick={() => setCurrentMonth(addDays(currentMonth, -30))}
              className="p-1 hover:bg-gray-100 rounded"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <span className="font-semibold text-gray-900">
              {format(currentMonth, 'LLLL yyyy', { locale: pl })}
            </span>
            <button
              type="button"
              onClick={() => setCurrentMonth(addDays(currentMonth, 30))}
              className="p-1 hover:bg-gray-100 rounded"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>

          {/* Weekday headers */}
          <div className="grid grid-cols-7 gap-1 mb-2">
            {['Pn', 'Wt', 'Śr', 'Cz', 'Pt', 'So', 'Nd'].map((day) => (
              <div key={day} className="text-center text-xs font-medium text-gray-500 p-1">
                {day}
              </div>
            ))}
          </div>

          {/* Calendar days */}
          <div className="grid grid-cols-7 gap-1">
            {days.map((day, idx) => {
              const isCurrentMonth = isSameMonth(day, currentMonth)
              const isStart = isSameDay(day, start)
              const isEnd = isSameDay(day, end)
              const isInRange = day >= start && day <= end
              
              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleDayClick(day)}
                  className={`
                    p-2 text-sm rounded transition-colors
                    ${!isCurrentMonth ? 'text-gray-300' : 'text-gray-700'}
                    ${isStart || isEnd ? 'bg-blue-600 text-white font-bold' : ''}
                    ${isInRange && !isStart && !isEnd ? 'bg-blue-100' : ''}
                    ${isCurrentMonth && !isInRange ? 'hover:bg-gray-100' : ''}
                  `}
                >
                  {format(day, 'd')}
                </button>
              )
            })}
          </div>

          <div className="mt-3 text-xs text-gray-500 text-center">
            {selectingStart ? 'Wybierz datę początkową' : 'Wybierz datę końcową'}
          </div>
        </div>
      )}
    </div>
  )
}

export default function ShoppingListEnhanced() {
  const { user, household, isLoading: userLoading } = useCurrentUser()
  const [items, setItems] = useState<ShoppingListItemWithProduct[]>([])
  const [householdMembers, setHouseholdMembers] = useState<HouseholdMember[]>([])
  const [selectedMembers, setSelectedMembers] = useState<string[]>([])
  const [startDate, setStartDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [groupBy, setGroupBy] = useState<'category' | 'product' | 'dish'>('category')
  
  // Add custom item form
  const [newItemName, setNewItemName] = useState('')
  const [newItemAmount, setNewItemAmount] = useState('')
  const [isAdding, setIsAdding] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [mealServingsById, setMealServingsById] = useState<Record<string, number>>({})
  const [generatedRange, setGeneratedRange] = useState<{ startDate: string; endDate: string } | null>(null)

  // Fetch household members
  useEffect(() => {
    if (!household?.id) return

    async function fetchMembers() {
      const { data: householdUsersData } = await supabase
        .from('household_users')
        .select('user_id')
        .eq('household_id', household!.id)

      if (householdUsersData) {
        const userIds = householdUsersData.map((hu) => hu.user_id)

        const { data: profilesData } = await supabase
          .from('profiles')
          .select('*')
          .in('id', userIds)

        const { data: settingsData } = await supabase
          .from('user_settings')
          .select('*')
          .in('user_id', userIds)

        const profileById = new Map((profilesData || []).map((profile) => [profile.id, profile]))
        const settingsByUserId = new Map((settingsData || []).map((settings) => [settings.user_id, settings]))

        const membersWithProfiles = householdUsersData.map((hu) => ({
          user_id: hu.user_id,
          profile: profileById.get(hu.user_id),
          settings: settingsByUserId.get(hu.user_id),
        }))

        setHouseholdMembers(membersWithProfiles)
        // Auto-select current user
        if (user?.id) {
          setSelectedMembers([user.id])
        }
      }
    }

    fetchMembers()
  }, [household, user?.id])

  // Fetch shopping list items
  useEffect(() => {
    if (!household?.id) return

    async function fetchItems() {
      const { data: stateData } = await supabase
        .from('shopping_list_state')
        .select('generated_start_date, generated_end_date, meal_servings')
        .eq('household_id', household!.id)
        .maybeSingle()

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
        .eq('household_id', household!.id)
        .order('created_at', { ascending: false })
        .order('id', { ascending: true })

      if (!error && data) {
        setItems(data as unknown as ShoppingListItemWithProduct[])
      }
    }

    fetchItems()

    const refreshInterval = setInterval(() => {
      void fetchItems()
    }, 3000)

    // Subscribe to realtime changes
    const channel = supabase
      .channel('shopping-list-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'shopping_list_items',
          filter: `household_id=eq.${household!.id}`,
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
          filter: `household_id=eq.${household!.id}`,
        },
        (payload) => {
          if (payload.eventType === 'DELETE') {
            setGeneratedRange(null)
            return
          }

          const next = payload.new as { generated_start_date?: string | null; generated_end_date?: string | null; meal_servings?: Record<string, number> | null }
          if (next.generated_start_date && next.generated_end_date) {
            setGeneratedRange({
              startDate: next.generated_start_date,
              endDate: next.generated_end_date,
            })
          }

          setMealServingsById((next.meal_servings || {}) as Record<string, number>)
        }
      )
      .subscribe()

    return () => {
      clearInterval(refreshInterval)
      channel.unsubscribe()
    }
  }, [household])

  // Generate shopping list from meal plans
  async function generateFromMealPlans() {
    if (!household?.id || selectedMembers.length === 0) return

    setIsGenerating(true)

    try {
      // Fetch meal plans for selected members and date range
      const { data: mealPlansData } = await supabase
        .from('meal_plan')
        .select('*, meals!inner(*)')
        .eq('household_id', household.id)
        .in('user_id', selectedMembers)
        .gte('date', startDate)
        .lte('date', endDate)

      if (!mealPlansData || mealPlansData.length === 0) {
        alert('Brak zaplanowanych posiłków w wybranym okresie')
        setIsGenerating(false)
        return
      }

      // Fetch meal items with products - need to check overrides per user
      const allItemsData: Array<{
        meal_id: string
        source_user_id: string
        product_id: string
        amount: number
        unit_type: string
        product?: Product
      }> = []
      
      for (const mealPlan of mealPlansData) {
        // Check if this user has overrides for this meal
        const { data: overridesData } = await supabase
          .from('meal_item_overrides')
          .select('*, product:products(*)')
          .eq('meal_id', mealPlan.meal_id)
          .eq('user_id', mealPlan.user_id)

        if (overridesData && overridesData.length > 0) {
          // User has overrides - use them
          overridesData.forEach(item => {
            allItemsData.push({
              ...item,
              meal_id: mealPlan.meal_id,
              source_user_id: mealPlan.user_id,
            })
          })
        } else {
          // No overrides - use default meal_items
          const { data: defaultItems } = await supabase
            .from('meal_items')
            .select('*, product:products(*)')
            .eq('meal_id', mealPlan.meal_id)
          
          if (defaultItems) {
            defaultItems.forEach(item => {
              allItemsData.push({
                ...item,
                meal_id: mealPlan.meal_id,
                source_user_id: mealPlan.user_id,
              })
            })
          }
        }
      }

      if (allItemsData.length === 0) {
        alert('Brak składników w zaplanowanych posiłkach')
        setIsGenerating(false)
        return
      }

      // Group by (meal_id, product_id) - each meal keeps its own ingredients
      // but sum amounts if same meal appears multiple times
      const mealProductMap = new Map<string, {
        meal_id: string
        source_user_id: string
        product: Product
        totalAmount: number
        unit_type: string
      }>()

      allItemsData.forEach((item) => {
        const product = item.product as unknown as Product
        if (!product) return

        const key = `${item.meal_id}:${item.source_user_id}:${product.id}`
        
        if (mealProductMap.has(key)) {
          const existing = mealProductMap.get(key)!
          existing.totalAmount += item.amount
        } else {
          mealProductMap.set(key, {
            meal_id: item.meal_id,
            source_user_id: item.source_user_id,
            product,
            totalAmount: item.amount,
            unit_type: item.unit_type,
          })
        }
      })

      // Clear existing items (optional - you might want to ask user)
      if (items.length > 0) {
        const confirmClear = confirm('Czy chcesz wyczyścić istniejącą listę zakupów przed wygenerowaniem nowej?')
        if (confirmClear) {
          await supabase
            .from('shopping_list_items')
            .delete()
            .eq('household_id', household.id)
        }
      }

      // Insert items into shopping list
      const itemsToInsert = Array.from(mealProductMap.values()).map(({ meal_id, source_user_id, product, totalAmount, unit_type }) => ({
        household_id: household.id,
        meal_id: meal_id,
        source_user_id: source_user_id,
        product_id: product.id,
        name: product.name,
        amount: totalAmount,
        unit_type: unit_type,
        custom_amount_text: null, // Products from database don't use custom text
        is_checked: false,
        added_by: user?.id || null,
      }))

      const { error } = await supabase
        .from('shopping_list_items')
        .insert(itemsToInsert)

      if (error) {
        alert('Błąd podczas generowania listy: ' + error.message)
      } else {
        const nextGeneratedRange = { startDate, endDate }
        const { error: stateError } = await supabase
          .from('shopping_list_state')
          .upsert({
            household_id: household.id,
            generated_start_date: nextGeneratedRange.startDate,
            generated_end_date: nextGeneratedRange.endDate,
            meal_servings: {},
            updated_by: user?.id || null,
          })

        if (!stateError) {
          setGeneratedRange(nextGeneratedRange)
          setMealServingsById({})
        }

        const { data: refreshedItems, error: refreshError } = await supabase
          .from('shopping_list_items')
          .select('*, product:products(*), meal:meals(id, name, description, images:meal_images(*), tags:meal_tags(tag_id, tags(*)))')
          .eq('household_id', household.id)
          .order('created_at', { ascending: false })
          .order('id', { ascending: true })

        if (!refreshError && refreshedItems) {
          setItems(refreshedItems as unknown as ShoppingListItemWithProduct[])
        }
        alert('Lista zakupów została wygenerowana!')
      }
    } catch (error) {
      console.error('Error generating shopping list:', error)
      alert('Wystąpił błąd podczas generowania listy')
    }

    setIsGenerating(false)
  }

  // Group items by product_id or name and sum amounts
  function groupItems(items: ShoppingListItemWithProduct[]): GroupedItem[] {
    const groups = new Map<string, GroupedItem>()

    items.forEach((item) => {
      // Use product_id if available, otherwise use name as key.
      // Also split by checked status so bought and unbought parts are separate rows.
      const baseKey = item.product_id || `name:${item.name}`
      const key = `${baseKey}:${item.is_checked ? 'checked' : 'unchecked'}`
      
      if (groups.has(key)) {
        const existing = groups.get(key)!
        existing.totalAmount += item.amount
        existing.itemIds.push(item.id)
        existing.allChecked = existing.allChecked && item.is_checked
        existing.anyChecked = existing.anyChecked || item.is_checked
      } else {
        groups.set(key, {
          key,
          name: item.name || 'Unnamed item',
          product_id: item.product_id,
          product: item.product,
          totalAmount: item.amount,
          unit_type: item.unit_type,
          custom_amount_text: item.custom_amount_text,
          itemIds: [item.id],
          allChecked: item.is_checked,
          anyChecked: item.is_checked,
        })
      }
    })

    return Array.from(groups.values()).sort((a, b) => {
      const byName = a.name.localeCompare(b.name, 'pl')
      if (byName !== 0) return byName
      // Unchecked first, checked second
      if (a.allChecked === b.allChecked) return 0
      return a.allChecked ? 1 : -1
    })
  }

  // Toggle member selection
  function toggleMember(userId: string) {
    setSelectedMembers((current) =>
      current.includes(userId)
        ? current.filter((id) => id !== userId)
        : [...current, userId]
    )
  }

  function getMemberDisplayName(member: HouseholdMember): string {
    const settingsName = member.settings?.name?.trim()
    if (settingsName) return settingsName

    const profileName = member.profile?.display_name?.trim()
    if (profileName) return profileName

    return 'Użytkownik'
  }

  function getMemberDisplayNameByUserId(userId: string | null | undefined): string {
    if (!userId) return 'Użytkownik'
    const member = householdMembers.find((householdMember) => householdMember.user_id === userId)
    if (!member) return 'Użytkownik'
    return getMemberDisplayName(member)
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

  // Add custom item
  async function addItem(e: React.FormEvent) {
    e.preventDefault()
    if (!household?.id || !newItemName.trim()) return

    setIsAdding(true)

    const amountValue = newItemAmount.trim()
    const parsedAmount = parseFloat(amountValue)
    
    // If it's a valid number, use it as amount; otherwise save as custom text
    const isNumeric = !isNaN(parsedAmount) && amountValue !== ''

    const { error } = await supabase.from('shopping_list_items').insert({
      household_id: household.id,
      name: newItemName.trim(),
      amount: isNumeric ? parsedAmount : 1, // Use 1 as dummy value if text
      custom_amount_text: isNumeric ? null : (amountValue || null),
      is_checked: false,
      added_by: user?.id || null,
    })

    if (!error) {
      setNewItemName('')
      setNewItemAmount('')
    }

    setIsAdding(false)
  }

  // Delete grouped item (deletes all items in the group)
  async function deleteGroupedItem(groupedItem: GroupedItem) {
    setItems((current) => current.filter((i) => !groupedItem.itemIds.includes(i.id)))

    const { error } = await supabase
      .from('shopping_list_items')
      .delete()
      .in('id', groupedItem.itemIds)

    if (error) {
      const { data } = await supabase
        .from('shopping_list_items')
        .select('*, product:products(*), meal:meals(id, name, description, images:meal_images(*), tags:meal_tags(tag_id, tags(*)))')
        .eq('household_id', household!.id)
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

    if (!confirm(`Czy chcesz usunąć ${checkedIds.length} zaznaczonych elementów?`)) return

    const { error } = await supabase
      .from('shopping_list_items')
      .delete()
      .in('id', checkedIds)

    if (error) {
      alert('Błąd podczas usuwania elementów')
    }
  }

  // Group items by meal_id for dish view
  function groupItemsByMeal(items: ShoppingListItemWithProduct[]) {
    const mealGroups = new Map<string, {
      meal_id: string
      source_user_id: string | null
      meal: (Meal & { images?: MealImage[]; tags?: { tag_id: string; tags: Tag }[] }) | undefined
      items: ShoppingListItemWithProduct[]
      allChecked: boolean
    }>()

    const customItems: ShoppingListItemWithProduct[] = []

    items.forEach((item) => {
      if (!item.meal_id || !item.meal) {
        // Items without meal (custom items)
        customItems.push(item)
      } else {
        const groupKey = `${item.meal_id}:${item.source_user_id || 'unknown'}`
        // Items from meals
        if (mealGroups.has(groupKey)) {
          const existing = mealGroups.get(groupKey)!
          existing.items.push(item)
          existing.allChecked = existing.allChecked && item.is_checked
        } else {
          mealGroups.set(groupKey, {
            meal_id: item.meal_id,
            source_user_id: item.source_user_id,
            meal: item.meal,
            items: [item],
            allChecked: item.is_checked,
          })
        }
      }
    })

    const sortedMealGroups = Array.from(mealGroups.values())
      .map((group) => ({
        ...group,
        items: [...group.items].sort((a, b) => (a.name || '').localeCompare(b.name || '', 'pl')),
      }))
      .sort((a, b) => {
        const mealNameCompare = (a.meal?.name || '').localeCompare(b.meal?.name || '', 'pl')
        if (mealNameCompare !== 0) return mealNameCompare
        return getMemberDisplayNameByUserId(a.source_user_id).localeCompare(getMemberDisplayNameByUserId(b.source_user_id), 'pl')
      })

    return {
      mealGroups: sortedMealGroups,
      customItems,
    }
  }

  // Delete entire meal group
  async function deleteMealGroup(mealGroup: { meal_id: string; items: ShoppingListItemWithProduct[] }) {
    const itemIds = mealGroup.items.map(i => i.id)
    
    const { error } = await supabase
      .from('shopping_list_items')
      .delete()
      .in('id', itemIds)

    if (error) {
      alert('Błąd podczas usuwania dania')
      return
    }

    if (household?.id) {
      const nextMap = { ...mealServingsById }
      delete nextMap[mealGroup.meal_id]
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

  async function updateMealServings(mealId: string, nextServings: number) {
    if (!household?.id) return
    if (!Number.isFinite(nextServings) || nextServings <= 0) return

    const currentServings = mealServingsById[mealId] || 1
    if (Math.abs(currentServings - nextServings) < 0.0001) return

    const scale = nextServings / currentServings
    const mealItems = items.filter((item) => item.meal_id === mealId && !item.custom_amount_text)
    if (mealItems.length === 0) {
      setMealServingsById((current) => ({ ...current, [mealId]: nextServings }))
      return
    }

    const updatedAmounts = mealItems.map((item) => ({
      id: item.id,
      amount: Math.max(0.01, Number((item.amount * scale).toFixed(2))),
    }))

    const results = await Promise.all(
      updatedAmounts.map((updated) =>
        supabase
          .from('shopping_list_items')
          .update({ amount: updated.amount })
          .eq('id', updated.id)
      )
    )

    if (results.some((result) => result.error)) {
      alert('Błąd podczas zmiany ilości dania')
      return
    }

    const amountById = new Map(updatedAmounts.map((updated) => [updated.id, updated.amount]))
    setItems((current) =>
      current.map((item) =>
        amountById.has(item.id)
          ? { ...item, amount: amountById.get(item.id)! }
          : item
      )
    )

    const nextMap = { ...mealServingsById, [mealId]: nextServings }
    setMealServingsById(nextMap)

    await supabase
      .from('shopping_list_state')
      .upsert({
        household_id: household.id,
        meal_servings: nextMap,
        updated_by: user?.id || null,
      })
  }

  if (userLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-gray-500">Ładowanie...</div>
      </div>
    )
  }

  if (!household) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-sm text-yellow-800">
        Musisz najpierw dołączyć do gospodarstwa.
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto p-4 space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Lista zakupów</h2>
        <p className="text-sm text-gray-500 mt-1">
          Generuj listę z planów posiłków lub dodawaj własne produkty
        </p>
      </div>

      {/* Generate from meal plans */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 space-y-4">
        <h3 className="text-lg font-semibold text-gray-900">Generuj z planów posiłków</h3>
        
        {/* Date range */}
        <DateRangePicker
          startDate={startDate}
          endDate={endDate}
          onStartChange={setStartDate}
          onEndChange={setEndDate}
        />

        {generatedRange && (
          <div className="rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-xs text-blue-800">
            Aktualna lista została wygenerowana dla: 
            <span className="font-semibold"> {format(parseISO(generatedRange.startDate), 'dd.MM.yyyy')} - {format(parseISO(generatedRange.endDate), 'dd.MM.yyyy')}</span>
          </div>
        )}

        {/* Household members selection */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Wybierz osoby z gospodarstwa
          </label>
          <div className="space-y-2">
            {householdMembers.map((member) => (
              <label
                key={member.user_id}
                className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-2 rounded"
              >
                <input
                  type="checkbox"
                  checked={selectedMembers.includes(member.user_id)}
                  onChange={() => toggleMember(member.user_id)}
                  className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-2 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-900">
                  {getMemberDisplayName(member)}
                  {member.user_id === user?.id && ' (Ty)'}
                </span>
              </label>
            ))}
          </div>
        </div>

        {/* Generate button */}
        <button
          onClick={generateFromMealPlans}
          disabled={isGenerating || selectedMembers.length === 0}
          className="w-full rounded-lg bg-green-600 px-6 py-3 text-sm font-semibold text-white hover:bg-green-500 focus:outline-none focus:ring-2 focus:ring-green-500 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
        >
          {isGenerating ? 'Generowanie...' : 'Generuj listę zakupów'}
        </button>
      </div>

      {/* View options */}
      <div className="flex items-center justify-between bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <div className="flex gap-2">
          <button
            onClick={() => setGroupBy('category')}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              groupBy === 'category'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Wg kategorii
          </button>
          <button
            onClick={() => setGroupBy('dish')}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              groupBy === 'dish'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Wg dania
          </button>
          <button
            onClick={() => setGroupBy('product')}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              groupBy === 'product'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Wszystkie produkty
          </button>
        </div>
        <button
          onClick={clearCheckedItems}
          disabled={items.filter(i => i.is_checked).length === 0}
          className="px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:text-gray-400 disabled:hover:bg-transparent"
        >
          Usuń zaznaczone
        </button>
      </div>

      {/* Shopping list items */}
      <div className="space-y-4">
        {items.length === 0 ? (
          <div className="bg-gray-50 rounded-lg border border-gray-200 p-8 text-center">
            <p className="text-gray-500 text-sm">Brak produktów na liście zakupów</p>
            <p className="text-gray-400 text-xs mt-1">Wygeneruj listę z planów posiłków lub dodaj produkty ręcznie</p>
          </div>
        ) : (
          <>
            {groupBy === 'category' ? (
              // Group by category
              [
                ...Array.from(
                  new Set(
                    items
                      .map((item) => item.product?.category)
                      .filter((category): category is string => Boolean(category))
                  )
                )
                  .sort((a, b) => a.localeCompare(b, 'pl'))
                  .map((category) => ({ key: category, label: category, category })),
                { key: '__uncategorized__', label: UNCATEGORIZED_LABEL, category: null as string | null },
              ].map(({ key, label, category }) => {
                const categoryItems = items.filter(item => {
                  // For items with product, check product.category
                  if (item.product) {
                    return category !== null && item.product.category === category
                  }
                  // For custom items (no product), show in uncategorized bucket
                  return category === null
                })

                if (categoryItems.length === 0) return null

                const groupedCategoryItems = groupItems(categoryItems)

                return (
                  <div key={key} className="space-y-2">
                    <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                      {label}
                      <span className="text-sm font-normal text-gray-500">
                        ({groupedCategoryItems.length})
                      </span>
                    </h3>
                    {groupedCategoryItems.map((groupedItem) => (
                      <div
                        key={groupedItem.key}
                        onClick={() => {
                          void toggleGroupedItem(groupedItem)
                        }}
                        className={`bg-white rounded-lg shadow-sm border border-gray-200 p-4 flex items-center gap-3 transition-opacity ${
                          groupedItem.allChecked ? 'opacity-60' : 'opacity-100'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={groupedItem.allChecked}
                          onChange={(e) => {
                            e.stopPropagation()
                            void toggleGroupedItem(groupedItem)
                          }}
                          className="h-5 w-5 rounded border-gray-300 text-blue-600 focus:ring-2 focus:ring-blue-500 cursor-pointer"
                        />
                        <div className="flex-1 min-w-0">
                          <p
                            className={`text-sm font-medium ${
                              groupedItem.allChecked ? 'line-through text-gray-500' : 'text-gray-900'
                            }`}
                          >
                            {groupedItem.name}
                          </p>
                          {(groupedItem.product || groupedItem.custom_amount_text) && (
                            <p className="text-xs text-gray-500 mt-0.5">
                              {groupedItem.custom_amount_text ? (
                                groupedItem.custom_amount_text
                              ) : groupedItem.product ? (
                                groupedItem.unit_type === '100g'
                                  ? `${Math.round(groupedItem.totalAmount * (groupedItem.product.unit_weight_grams || 1))}g`
                                  : `${formatAmount(groupedItem.totalAmount)} ${translateUnit(groupedItem.unit_type || '')} (${Math.round(groupedItem.totalAmount * (groupedItem.product.unit_weight_grams || 1))}g)`
                              ) : null}
                            </p>
                          )}
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            void deleteGroupedItem(groupedItem)
                          }}
                          className="text-red-600 hover:text-red-700 text-sm font-medium px-2 py-1 rounded hover:bg-red-50 transition-colors"
                          aria-label="Usuń produkt"
                        >
                          Usuń
                        </button>
                      </div>
                    ))}
                  </div>
                )
              })
            ) : groupBy === 'product' ? (
              // Show all items grouped
              <div className="space-y-2">
                {groupItems(items).map((groupedItem) => (
                  <div
                    key={groupedItem.key}
                    onClick={() => {
                      void toggleGroupedItem(groupedItem)
                    }}
                    className={`bg-white rounded-lg shadow-sm border border-gray-200 p-4 flex items-center gap-3 transition-opacity ${
                      groupedItem.allChecked ? 'opacity-60' : 'opacity-100'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={groupedItem.allChecked}
                      onChange={(e) => {
                        e.stopPropagation()
                        void toggleGroupedItem(groupedItem)
                      }}
                      className="h-5 w-5 rounded border-gray-300 text-blue-600 focus:ring-2 focus:ring-blue-500 cursor-pointer"
                    />
                    <div className="flex-1 min-w-0">
                      <p
                        className={`text-sm font-medium ${
                          groupedItem.allChecked ? 'line-through text-gray-500' : 'text-gray-900'
                        }`}
                      >
                        {groupedItem.name}
                      </p>
                      {(groupedItem.product || groupedItem.custom_amount_text) && (
                        <p className="text-xs text-gray-500 mt-0.5">
                          {groupedItem.custom_amount_text ? (
                            groupedItem.custom_amount_text
                          ) : groupedItem.product ? (
                            groupedItem.unit_type === '100g'
                              ? `${Math.round(groupedItem.totalAmount * (groupedItem.product.unit_weight_grams || 1))}g`
                              : `${formatAmount(groupedItem.totalAmount)} ${translateUnit(groupedItem.unit_type || '')} (${Math.round(groupedItem.totalAmount * (groupedItem.product.unit_weight_grams || 1))}g)`
                          ) : null}
                        </p>
                      )}
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        void deleteGroupedItem(groupedItem)
                      }}
                      className="text-red-600 hover:text-red-700 text-sm font-medium px-2 py-1 rounded hover:bg-red-50 transition-colors"
                      aria-label="Usuń produkt"
                    >
                      Usuń
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              // Group by dish (meal)
              (() => {
                const { mealGroups, customItems } = groupItemsByMeal(items)
                
                return (
                  <div className="space-y-4">
                    {/* Meal groups */}
                    {mealGroups.map((mealGroup) => (
                      <div key={`${mealGroup.meal_id}:${mealGroup.source_user_id || 'unknown'}`} className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                        {/* Meal header */}
                        <div className="p-4 bg-gray-50 border-b border-gray-200">
                          <div className="flex items-start gap-3">
                            {/* Meal image thumbnail */}
                            {mealGroup.meal?.images && mealGroup.meal.images.length > 0 ? (
                              <div
                                className="w-16 h-16 flex-shrink-0 rounded-lg bg-gray-100 bg-cover bg-center"
                                style={{ backgroundImage: `url(${mealGroup.meal.images[0].image_url})` }}
                                aria-label={mealGroup.meal.name}
                              />
                            ) : (
                              <div className="w-16 h-16 flex-shrink-0 rounded-lg bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center">
                                <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                </svg>
                              </div>
                            )}

                            <div className="flex-1 min-w-0">
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                  <h4 className="font-semibold text-gray-900">
                                    {mealGroup.meal?.name || 'Nieznane danie'} ({getMemberDisplayNameByUserId(mealGroup.source_user_id)})
                                  </h4>
                                  {mealGroup.meal?.tags && mealGroup.meal.tags.length > 0 && (
                                    <div className="flex flex-wrap gap-1 mt-2">
                                      {mealGroup.meal.tags.map((tagRelation) => {
                                        const tag = tagRelation.tags
                                        if (!tag) return null
                                        return (
                                          <span
                                            key={tag.id}
                                            className="px-2 py-0.5 rounded-full text-[10px] font-medium"
                                            style={{ 
                                              backgroundColor: tag.color, 
                                              color: tag.text_color 
                                            }}
                                          >
                                            {tag.name}
                                          </span>
                                        )
                                      })}
                                    </div>
                                  )}
                                </div>
                                <button
                                  onClick={() => deleteMealGroup(mealGroup)}
                                  className="text-red-600 hover:text-red-700 p-1.5 rounded hover:bg-red-50 transition-colors flex-shrink-0"
                                  title="Usuń danie"
                                  aria-label="Usuń danie"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M9 7V4a1 1 0 011-1h4a1 1 0 011 1v3M4 7h16" />
                                  </svg>
                                </button>
                              </div>

                              <div className="mt-3 flex items-center gap-2">
                              <button
                                onClick={() => {
                                  const current = mealServingsById[mealGroup.meal_id] || 1
                                  const next = Math.max(0.5, Number((current - 0.5).toFixed(1)))
                                  void updateMealServings(mealGroup.meal_id, next)
                                }}
                                className="w-7 h-7 flex items-center justify-center bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 transition-colors font-bold text-base"
                              >
                                −
                              </button>
                              <input
                                type="number"
                                min="0.5"
                                step="0.5"
                                value={mealServingsById[mealGroup.meal_id] || 1}
                                onChange={(e) => {
                                  const value = parseFloat(e.target.value)
                                  if (!isNaN(value) && value > 0) {
                                    void updateMealServings(mealGroup.meal_id, value)
                                  }
                                }}
                                className="w-16 px-2 py-1 text-center border-2 border-indigo-300 rounded-lg font-semibold text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                              />
                              <button
                                onClick={() => {
                                  const current = mealServingsById[mealGroup.meal_id] || 1
                                  const next = Number((current + 0.5).toFixed(1))
                                  void updateMealServings(mealGroup.meal_id, next)
                                }}
                                className="w-7 h-7 flex items-center justify-center bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 transition-colors font-bold text-base"
                              >
                                +
                              </button>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Ingredients list */}
                        <div className="p-4 space-y-2">
                          {mealGroup.items.map((item) => {
                            const totalWeight = item.product ? Math.round(item.amount * (item.product.unit_weight_grams || 1)) : 0
                            return (
                              <div
                                key={item.id}
                                onClick={() => {
                                  void toggleSingleItem(item)
                                }}
                                className={`flex items-center gap-3 py-2 transition-opacity ${
                                  item.is_checked ? 'opacity-60' : 'opacity-100'
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  checked={item.is_checked}
                                  onChange={(e) => {
                                    e.stopPropagation()
                                    void toggleSingleItem(item)
                                  }}
                                  className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-2 focus:ring-blue-500 cursor-pointer"
                                />
                                <div className="flex-1 min-w-0">
                                  <p
                                    className={`text-sm font-medium ${
                                      item.is_checked ? 'line-through text-gray-500' : 'text-gray-900'
                                    }`}
                                  >
                                    {item.name}
                                  </p>
                                  <p className="text-xs text-gray-500 mt-0.5">
                                    {item.custom_amount_text ? (
                                      item.custom_amount_text
                                    ) : item.product && item.unit_type === '100g' ? (
                                      `${totalWeight}g`
                                    ) : item.product ? (
                                      `${formatAmount(item.amount)} ${translateUnit(item.unit_type || '')} (${totalWeight}g)`
                                    ) : null}
                                  </p>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    ))}

                    {/* Custom items without meal */}
                    {customItems.length > 0 && (
                      <div className="space-y-2">
                        <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                          Pozostałe produkty
                          <span className="text-sm font-normal text-gray-500">
                            ({customItems.length})
                          </span>
                        </h3>
                        {groupItems(customItems).map((groupedItem) => (
                          <div
                            key={groupedItem.key}
                            onClick={() => {
                              void toggleGroupedItem(groupedItem)
                            }}
                            className={`bg-white rounded-lg shadow-sm border border-gray-200 p-4 flex items-center gap-3 transition-opacity ${
                              groupedItem.allChecked ? 'opacity-60' : 'opacity-100'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={groupedItem.allChecked}
                              onChange={(e) => {
                                e.stopPropagation()
                                void toggleGroupedItem(groupedItem)
                              }}
                              className="h-5 w-5 rounded border-gray-300 text-blue-600 focus:ring-2 focus:ring-blue-500 cursor-pointer"
                            />
                            <div className="flex-1 min-w-0">
                              <p
                                className={`text-sm font-medium ${
                                  groupedItem.allChecked ? 'line-through text-gray-500' : 'text-gray-900'
                                }`}
                              >
                                {groupedItem.name}
                              </p>
                              {(groupedItem.product || groupedItem.custom_amount_text) && (
                                <p className="text-xs text-gray-500 mt-0.5">
                                  {groupedItem.custom_amount_text ? (
                                    groupedItem.custom_amount_text
                                  ) : groupedItem.product ? (
                                    groupedItem.unit_type === '100g'
                                      ? `${Math.round(groupedItem.totalAmount * (groupedItem.product.unit_weight_grams || 1))}g`
                                      : `${formatAmount(groupedItem.totalAmount)} ${translateUnit(groupedItem.unit_type || '')} (${Math.round(groupedItem.totalAmount * (groupedItem.product.unit_weight_grams || 1))}g)`
                                  ) : null}
                                </p>
                              )}
                            </div>
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                void deleteGroupedItem(groupedItem)
                              }}
                              className="text-red-600 hover:text-red-700 text-sm font-medium px-2 py-1 rounded hover:bg-red-50 transition-colors"
                            >
                              Usuń
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })()
            )}
          </>
        )}
      </div>

      {/* Stats */}
      {items.length > 0 && (
        <div className="bg-gray-50 rounded-lg border border-gray-200 p-4 flex justify-between text-sm">
          <span className="text-gray-600">
            Produktów: <span className="font-semibold text-gray-900">{groupItems(items).length}</span>
          </span>
          <span className="text-gray-600">
            Kupionych: <span className="font-semibold text-gray-900">{groupItems(items).filter((i) => i.allChecked).length}</span>
          </span>
          <span className="text-gray-600">
            Pozostało: <span className="font-semibold text-gray-900">{items.filter((i) => !i.is_checked).length}</span>
          </span>
        </div>
      )}

      {/* Add custom item */}
      <form onSubmit={addItem} className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <h3 className="text-sm font-semibold text-gray-900 mb-3">Dodaj własny produkt</h3>
        <div className="flex gap-2 flex-col sm:flex-row">
          <input
            type="text"
            value={newItemName}
            onChange={(e) => setNewItemName(e.target.value)}
            placeholder="Nazwa produktu"
            disabled={isAdding}
            className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-sm text-black focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
          />
          <input
            type="text"
            value={newItemAmount}
            onChange={(e) => setNewItemAmount(e.target.value)}
            placeholder="Ilość (np. 2, garść, opakowanie)"
            disabled={isAdding}
            className="w-40 rounded-lg border border-gray-300 px-4 py-2 text-sm text-black focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
          />
          <button
            type="submit"
            disabled={isAdding || !newItemName.trim()}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
          >
            {isAdding ? 'Dodawanie...' : 'Dodaj'}
          </button>
        </div>
      </form>
    </div>
  )
}
