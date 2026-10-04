import { formatAmount } from '@/lib/nutrition'
import { getMealGroupKey } from '@/lib/shopping'
import type { GroupedItem, HouseholdMember, MealGroupData, ShoppingListItemWithProduct } from './types'

export const UNCATEGORIZED_LABEL = 'Pozostałe'

// Translates unit types to Polish labels
export function translateUnit(unitType: string): string {
  const units: { [key: string]: string } = {
    '100g': 'g',
    'piece': 'szt',
    'tablespoon': 'łyżka',
    'teaspoon': 'łyżeczka',
    'leaf': 'liść',
    'cube': 'kostka',
    'slice': 'plaster',
  }
  return units[unitType] || unitType
}

export function getGroupedItemAmountLabel(groupedItem: GroupedItem): string | null {
  if (groupedItem.custom_amount_text) {
    return groupedItem.custom_amount_text
  }

  if (groupedItem.product) {
    if (groupedItem.unit_type === '100g') {
      return `${Math.round(groupedItem.totalAmount * (groupedItem.product.unit_weight_grams || 1))}g`
    }

    return `${[formatAmount(groupedItem.totalAmount), translateUnit(groupedItem.unit_type || '')].filter(Boolean).join(' ')} (${Math.round(groupedItem.totalAmount * (groupedItem.product.unit_weight_grams || 1))}g)`
  }

  if (groupedItem.totalAmount > 0) {
    return formatAmount(groupedItem.totalAmount)
  }

  return null
}

export function getSingleItemAmountLabel(item: ShoppingListItemWithProduct): string | null {
  if (item.custom_amount_text) {
    return item.custom_amount_text
  }

  if (item.product) {
    const totalWeight = Math.round(item.amount * (item.product.unit_weight_grams || 1))
    if (item.unit_type === '100g') {
      return `${totalWeight}g`
    }

    return `${[formatAmount(item.amount), translateUnit(item.unit_type || '')].filter(Boolean).join(' ')} (${totalWeight}g)`
  }

  if (item.amount > 0) {
    return formatAmount(item.amount)
  }

  return null
}

export function getMemberDisplayName(member: HouseholdMember): string {
  const settingsName = member.settings?.name?.trim()
  if (settingsName) return settingsName

  const profileName = member.profile?.display_name?.trim()
  if (profileName) return profileName

  return 'Użytkownik'
}

// Group items by product_id or name and sum amounts
export function groupItems(items: ShoppingListItemWithProduct[]): GroupedItem[] {
  const groups = new Map<string, GroupedItem>()

  items.forEach((item) => {
    // Use product_id if available, otherwise use name as key.
    // Also split by checked status so bought and unbought parts are separate rows.
    const baseKey = item.product_id || `name:${item.name}`
    const key = `${baseKey}:${item.is_checked ? 'checked' : 'unchecked'}`

    if (groups.has(key)) {
      const existing = groups.get(key)!
      existing.totalAmount = Math.round((existing.totalAmount + parseFloat(String(item.amount))) * 10000) / 10000
      existing.itemIds.push(item.id)
      existing.allChecked = existing.allChecked && item.is_checked
      existing.anyChecked = existing.anyChecked || item.is_checked
    } else {
      groups.set(key, {
        key,
        name: item.name || 'Bez nazwy',
        product_id: item.product_id,
        product: item.product,
        totalAmount: parseFloat(String(item.amount)),
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

// Group items by meal_id (+ source user) for dish view
export function groupItemsByMeal(
  items: ShoppingListItemWithProduct[],
  getMemberDisplayNameByUserId: (userId: string | null | undefined) => string
): { mealGroups: MealGroupData[]; customItems: ShoppingListItemWithProduct[] } {
  const mealGroups = new Map<string, MealGroupData>()

  const customItems: ShoppingListItemWithProduct[] = []

  items.forEach((item) => {
    if (!item.meal_id || !item.meal) {
      // Items without meal (custom items)
      customItems.push(item)
    } else {
      const groupKey = getMealGroupKey(item.meal_id, item.source_user_id)
      // Items from meals
      if (mealGroups.has(groupKey)) {
        const existing = mealGroups.get(groupKey)!
        existing.items.push(item)
        existing.allChecked = existing.allChecked && item.is_checked
      } else {
        mealGroups.set(groupKey, {
          group_key: groupKey,
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
