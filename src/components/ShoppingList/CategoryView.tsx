'use client'

import type { GroupedItem, ShoppingListItemWithProduct, ShoppingListMeal } from './types'
import { getRelatedMeals, groupByCategory } from './shoppingListUtils'
import GroupedItemRow from './GroupedItemRow'
import RelatedMeals from './RelatedMeals'

/**
 * "Wg kategorii" view: items grouped by product category (custom items land in the
 * uncategorized bucket). Each aggregated row can be expanded to show the recipes
 * it comes from and the delete action.
 */
export default function CategoryView({
  items,
  expandedRowKey,
  setExpandedRowKey,
  activeProductTooltip,
  setActiveProductTooltip,
  toggleGroupedItem,
  deleteGroupedItem,
  onOpenMeal,
  getMemberDisplayNameByUserId,
}: {
  items: ShoppingListItemWithProduct[]
  expandedRowKey: string | null
  setExpandedRowKey: (key: string | null) => void
  activeProductTooltip: string | null
  setActiveProductTooltip: (key: string | null) => void
  toggleGroupedItem: (groupedItem: GroupedItem) => Promise<void>
  deleteGroupedItem: (groupedItem: GroupedItem) => Promise<void>
  onOpenMeal: (meal: ShoppingListMeal, sourceUserId: string | null) => void
  getMemberDisplayNameByUserId: (userId: string | null | undefined) => string
}) {
  return (
    <>
      {groupByCategory(items).map(({ key, label, groupedItems: groupedCategoryItems }) => (
        <div key={key} className="space-y-2">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            {label}
            <span className="text-sm font-normal text-gray-500 dark:text-gray-400">({groupedCategoryItems.length})</span>
          </h3>
          {groupedCategoryItems.map((groupedItem) => {
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
                details={
                  isExpanded && (
                    <RelatedMeals
                      meals={getRelatedMeals(items, groupedItem)}
                      onOpenMeal={onOpenMeal}
                      getMemberDisplayNameByUserId={getMemberDisplayNameByUserId}
                    />
                  )
                }
              />
            )
          })}
        </div>
      ))}
    </>
  )
}
