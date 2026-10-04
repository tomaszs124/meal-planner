'use client'

import type { Dispatch, SetStateAction } from 'react'
import type { GroupedItem, MealGroupData, ShoppingListItemWithProduct, ShoppingListMeal } from './types'
import { getGroupedItemAmountLabel, groupItems, groupItemsByMeal } from './shoppingListUtils'
import MealGroupCard from './MealGroupCard'

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
          {groupItems(customItems).map((groupedItem) => (
            <div
              key={groupedItem.key}
              role="button"
              tabIndex={0}
              onClick={() => {
                void toggleGroupedItem(groupedItem)
              }}
              onKeyDown={(e) => {
                // Only the row itself; keys on the nested checkbox/button keep their native behaviour
                if (e.target !== e.currentTarget || e.repeat) return
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  void toggleGroupedItem(groupedItem)
                }
              }}
              className={`bg-white rounded-lg shadow-sm border border-gray-200 p-4 flex items-center gap-3 transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                groupedItem.allChecked ? 'opacity-60' : 'opacity-100'
              }`}
            >
              <input
                type="checkbox"
                onClick={(e) => e.stopPropagation()}
                checked={groupedItem.allChecked}
                aria-label={groupedItem.name}
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
                {getGroupedItemAmountLabel(groupedItem) && (
                  <p className="text-xs text-gray-500 mt-0.5">
                    {getGroupedItemAmountLabel(groupedItem)}
                  </p>
                )}
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  void deleteGroupedItem(groupedItem)
                }}
                aria-label={`Usuń ${groupedItem.name}`}
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
}
