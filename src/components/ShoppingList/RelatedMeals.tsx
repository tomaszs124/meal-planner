'use client'

import type { ShoppingListMeal } from './types'

/** "Z przepisów:" list in the expanded area of a shopping list row; each meal opens its recipe. */
export default function RelatedMeals({
  meals,
  onOpenMeal,
  getMemberDisplayNameByUserId,
}: {
  meals: Array<{ meal: ShoppingListMeal; source_user_id: string | null }>
  onOpenMeal: (meal: ShoppingListMeal, sourceUserId: string | null) => void
  getMemberDisplayNameByUserId: (userId: string | null | undefined) => string
}) {
  if (meals.length === 0) return null
  return (
    <div className="space-y-2">
      <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">Z przepisów:</p>
      {meals.map(({ meal, source_user_id }) => (
        <button
          key={`${meal.id}:${source_user_id || ''}`}
          type="button"
          onClick={() => onOpenMeal(meal, source_user_id)}
          className="w-full flex items-center gap-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3 hover:border-brand-300 hover:bg-brand-50 dark:hover:bg-brand-950 transition-colors text-left cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
        >
          {meal.images && meal.images.length > 0 ? (
            <div
              className="w-12 h-12 flex-shrink-0 rounded-lg bg-cover bg-center"
              style={{ backgroundImage: `url(${meal.images[0].image_url})` }}
            />
          ) : (
            <div className="w-12 h-12 flex-shrink-0 rounded-lg bg-gradient-to-br from-gray-100 dark:from-gray-700 to-gray-200 dark:to-gray-800 flex items-center justify-center">
              <svg className="w-5 h-5 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">{meal.name}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">{getMemberDisplayNameByUserId(source_user_id)}</p>
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
          <svg className="w-4 h-4 text-gray-400 dark:text-gray-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      ))}
    </div>
  )
}
