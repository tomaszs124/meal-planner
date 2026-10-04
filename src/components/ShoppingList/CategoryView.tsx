'use client'

import type { GroupedItem, ShoppingListItemWithProduct, ShoppingListMeal } from './types'
import { UNCATEGORIZED_LABEL, groupItems } from './shoppingListUtils'
import GroupedItemRow from './GroupedItemRow'

/**
 * "Wg kategorii" view: items grouped by product category (custom items land in the
 * uncategorized bucket). Each aggregated row can be expanded to show the recipes
 * it comes from.
 */
export default function CategoryView({
  items,
  expandedCategoryGroupKey,
  setExpandedCategoryGroupKey,
  activeProductTooltip,
  setActiveProductTooltip,
  toggleGroupedItem,
  deleteGroupedItem,
  onOpenMeal,
  getMemberDisplayNameByUserId,
}: {
  items: ShoppingListItemWithProduct[]
  expandedCategoryGroupKey: string | null
  setExpandedCategoryGroupKey: (key: string | null) => void
  activeProductTooltip: string | null
  setActiveProductTooltip: (key: string | null) => void
  toggleGroupedItem: (groupedItem: GroupedItem) => Promise<void>
  deleteGroupedItem: (groupedItem: GroupedItem) => Promise<void>
  onOpenMeal: (meal: ShoppingListMeal, sourceUserId: string | null) => void
  getMemberDisplayNameByUserId: (userId: string | null | undefined) => string
}) {
  return (
    <>
      {[
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
            {groupedCategoryItems.map((groupedItem) => {
              const relatedMeals: Array<{ meal: NonNullable<typeof items[number]['meal']>; source_user_id: string | null }> = []
              const seenMealKeys = new Set<string>()
              items
                .filter((item) => groupedItem.itemIds.includes(item.id) && item.meal)
                .forEach((item) => {
                  const mk = `${item.meal!.id}:${item.source_user_id || ''}`
                  if (!seenMealKeys.has(mk)) {
                    seenMealKeys.add(mk)
                    relatedMeals.push({ meal: item.meal!, source_user_id: item.source_user_id })
                  }
                })
              const hasMeals = relatedMeals.length > 0
              const isExpanded = expandedCategoryGroupKey === groupedItem.key
              return (
                <div key={groupedItem.key}>
                  <GroupedItemRow
                    groupedItem={groupedItem}
                    className={`bg-white shadow-sm border border-gray-200 p-4 flex items-center gap-3 transition-opacity ${
                      groupedItem.allChecked ? 'opacity-60' : 'opacity-100'
                    } ${isExpanded && hasMeals ? 'rounded-t-lg border-b-0' : 'rounded-lg'}`}
                    activeProductTooltip={activeProductTooltip}
                    setActiveProductTooltip={setActiveProductTooltip}
                    onToggle={toggleGroupedItem}
                    onDelete={deleteGroupedItem}
                  >
                    {hasMeals && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          setExpandedCategoryGroupKey(isExpanded ? null : groupedItem.key)
                        }}
                        className="text-gray-400 hover:text-gray-600 p-1 rounded hover:bg-gray-100 transition-colors flex-shrink-0"
                        aria-label={isExpanded ? 'Ukryj przepisy' : 'Pokaż przepisy'}
                      >
                        <svg
                          className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                          fill="none" stroke="currentColor" viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>
                    )}
                  </GroupedItemRow>
                  {isExpanded && hasMeals && (
                    <div className="border border-t-0 border-gray-200 rounded-b-lg bg-gray-50 px-3 pb-3 pt-2 space-y-2">
                      <p className="text-xs text-gray-500 font-medium">Z przepisów:</p>
                      {relatedMeals.map(({ meal, source_user_id }) => (
                        <button
                          key={`${meal.id}:${source_user_id || ''}`}
                          type="button"
                          onClick={() => {
                            onOpenMeal(meal, source_user_id)
                          }}
                          className="w-full flex items-center gap-3 bg-white rounded-lg border border-gray-200 p-3 hover:border-blue-300 hover:bg-blue-50 transition-colors text-left cursor-pointer"
                        >
                          {meal.images && meal.images.length > 0 ? (
                            <div
                              className="w-12 h-12 flex-shrink-0 rounded-lg bg-cover bg-center"
                              style={{ backgroundImage: `url(${meal.images[0].image_url})` }}
                            />
                          ) : (
                            <div className="w-12 h-12 flex-shrink-0 rounded-lg bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center">
                              <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                              </svg>
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-gray-900 truncate">
                              {meal.name}
                            </p>
                            <p className="text-xs text-gray-500">{getMemberDisplayNameByUserId(source_user_id)}</p>
                            {meal.tags && meal.tags.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-1">
                                {meal.tags.map((tagRelation) => {
                                  const tag = tagRelation.tags
                                  if (!tag) return null
                                  return (
                                    <span
                                      key={tag.id}
                                      className="px-2 py-0.5 rounded-full text-[10px] font-medium"
                                      style={{ backgroundColor: tag.color, color: tag.text_color }}
                                    >
                                      {tag.name}
                                    </span>
                                  )
                                })}
                              </div>
                            )}
                          </div>
                          <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )
      })}
    </>
  )
}
