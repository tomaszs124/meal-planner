'use client'

import type { Dispatch, SetStateAction } from 'react'
import type { GroupedItem, MealGroupData, ShoppingListItemWithProduct, ShoppingListMeal } from './types'
import { groupItems, groupItemsByMeal } from './shoppingListUtils'
import MealGroupCard from './MealGroupCard'
import GroupedItemRow from './GroupedItemRow'

/**
 * "Wg dania" view: one card per (meal, household member) plus the custom items
 * that are not linked to any meal.
 */
export default function DishView({
  items,
  mealServingsById,
  editingServings,
  setEditingServings,
  updatingServingsKey,
  updateMealServings,
  deleteMealGroup,
  toggleSingleItem,
  toggleGroupedItem,
  deleteGroupedItem,
  expandedRowKey,
  setExpandedRowKey,
  activeProductTooltip,
  setActiveProductTooltip,
  onOpenMeal,
  getMemberDisplayNameByUserId,
}: {
  items: ShoppingListItemWithProduct[]
  mealServingsById: Record<string, number>
  editingServings: Record<string, string>
  setEditingServings: Dispatch<SetStateAction<Record<string, string>>>
  updatingServingsKey: string | null
  updateMealServings: (mealGroup: MealGroupData, nextServings: number) => Promise<void>
  deleteMealGroup: (mealGroup: MealGroupData) => Promise<void>
  toggleSingleItem: (item: ShoppingListItemWithProduct) => Promise<void>
  toggleGroupedItem: (groupedItem: GroupedItem) => Promise<void>
  deleteGroupedItem: (groupedItem: GroupedItem) => Promise<void>
  expandedRowKey: string | null
  setExpandedRowKey: (key: string | null) => void
  activeProductTooltip: string | null
  setActiveProductTooltip: (key: string | null) => void
  onOpenMeal: (meal: ShoppingListMeal, sourceUserId: string | null) => void
  getMemberDisplayNameByUserId: (userId: string | null | undefined) => string
}) {
  const { mealGroups, customItems } = groupItemsByMeal(items, getMemberDisplayNameByUserId)

  return (
    <div className="space-y-4">
      {/* Meal groups */}
      {mealGroups.map((mealGroup) => (
        <MealGroupCard
          key={`${mealGroup.meal_id}:${mealGroup.source_user_id || 'unknown'}`}
          mealGroup={mealGroup}
          mealServingsById={mealServingsById}
          editingServings={editingServings}
          setEditingServings={setEditingServings}
          updatingServingsKey={updatingServingsKey}
          updateMealServings={updateMealServings}
          deleteMealGroup={deleteMealGroup}
          toggleSingleItem={toggleSingleItem}
          onOpenMeal={onOpenMeal}
          getMemberDisplayNameByUserId={getMemberDisplayNameByUserId}
        />
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
          {groupItems(customItems).map((groupedItem) => {
            const isExpanded = expandedRowKey === groupedItem.key
            return (
              <GroupedItemRow
                key={groupedItem.key}
                groupedItem={groupedItem}
                isExpanded={isExpanded}
                onToggleExpanded={() => setExpandedRowKey(isExpanded ? null : groupedItem.key)}
                activeProductTooltip={activeProductTooltip}
                setActiveProductTooltip={setActiveProductTooltip}
                onToggle={toggleGroupedItem}
                onDelete={deleteGroupedItem}
              />
            )
          })}
        </div>
      )}
    </div>
  )
}
