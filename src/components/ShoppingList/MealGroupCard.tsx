'use client'

import type { Dispatch, SetStateAction } from 'react'
import type { MealGroupData, ShoppingListItemWithProduct, ShoppingListMeal } from './types'
import { getSingleItemAmountLabel } from './shoppingListUtils'

/**
 * Dish view card: meal header (thumbnail, name, tags, delete) with servings
 * controls, followed by the meal's ingredient rows.
 */
export default function MealGroupCard({
  mealGroup,
  mealServingsById,
  editingServings,
  setEditingServings,
  updatingServingsKey,
  updateMealServings,
  deleteMealGroup,
  toggleSingleItem,
  onOpenMeal,
  getMemberDisplayNameByUserId,
}: {
  mealGroup: MealGroupData
  mealServingsById: Record<string, number>
  editingServings: Record<string, string>
  setEditingServings: Dispatch<SetStateAction<Record<string, string>>>
  updatingServingsKey: string | null
  updateMealServings: (mealGroup: MealGroupData, nextServings: number) => Promise<void>
  deleteMealGroup: (mealGroup: MealGroupData) => Promise<void>
  toggleSingleItem: (item: ShoppingListItemWithProduct) => Promise<void>
  onOpenMeal: (meal: ShoppingListMeal, sourceUserId: string | null) => void
  getMemberDisplayNameByUserId: (userId: string | null | undefined) => string
}) {
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
      {/* Meal header */}
      <div className="p-4 bg-gray-50 border-b border-gray-200">
        <div className="flex items-start gap-3">
          {/* Meal image thumbnail — clickable */}
          {mealGroup.meal?.images && mealGroup.meal.images.length > 0 ? (
            <button
              type="button"
              onClick={() => {
                if (mealGroup.meal) {
                  onOpenMeal(mealGroup.meal, mealGroup.source_user_id)
                }
              }}
              className="w-16 h-16 flex-shrink-0 rounded-lg bg-gray-100 bg-cover bg-center cursor-pointer hover:opacity-80 transition-opacity"
              style={{ backgroundImage: `url(${mealGroup.meal.images[0].image_url})` }}
              aria-label={`Otwórz przepis: ${mealGroup.meal.name}`}
            />
          ) : (
            <button
              type="button"
              onClick={() => {
                if (mealGroup.meal) {
                  onOpenMeal(mealGroup.meal, mealGroup.source_user_id)
                }
              }}
              className="w-16 h-16 flex-shrink-0 rounded-lg bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center cursor-pointer hover:from-gray-200 hover:to-gray-300 transition-colors"
              aria-label={`Otwórz przepis: ${mealGroup.meal?.name}`}
            >
              <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </button>
          )}

          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <button
                  type="button"
                  onClick={() => {
                    if (mealGroup.meal) {
                      onOpenMeal(mealGroup.meal, mealGroup.source_user_id)
                    }
                  }}
                  className="text-left font-semibold text-gray-900 hover:text-blue-600 transition-colors cursor-pointer"
                >
                  {mealGroup.meal?.name || 'Nieznane danie'} ({getMemberDisplayNameByUserId(mealGroup.source_user_id)})
                </button>
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
              type="button"
              aria-label="Zmniejsz liczbę porcji"
              onClick={() => {
                const current = mealServingsById[mealGroup.group_key] ?? 1
                const next = Math.max(0.5, Number((current - 0.5).toFixed(1)))
                void updateMealServings(mealGroup, next)
              }}
              disabled={updatingServingsKey !== null}
              className="w-7 h-7 flex items-center justify-center bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 transition-colors font-bold text-base disabled:opacity-40 disabled:cursor-not-allowed"
            >
              −
            </button>
            <input
              type="number"
              inputMode="decimal"
              min="0.5"
              step="0.5"
              aria-label="Liczba porcji"
              disabled={updatingServingsKey !== null}
              value={editingServings[mealGroup.group_key] ?? (mealServingsById[mealGroup.group_key] ?? 1)}
              onChange={(e) => {
                setEditingServings((prev) => ({ ...prev, [mealGroup.group_key]: e.target.value }))
              }}
              onBlur={(e) => {
                const value = parseFloat(e.target.value)
                setEditingServings((prev) => {
                  const next = { ...prev }
                  delete next[mealGroup.group_key]
                  return next
                })
                if (!isNaN(value) && value > 0) {
                  void updateMealServings(mealGroup, value)
                }
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') e.currentTarget.blur()
              }}
              className="w-16 px-2 py-1 text-center border-2 border-indigo-300 rounded-lg font-semibold text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed"
            />
            <button
              type="button"
              aria-label="Zwiększ liczbę porcji"
              onClick={() => {
                const current = mealServingsById[mealGroup.group_key] ?? 1
                const next = Number((current + 0.5).toFixed(1))
                void updateMealServings(mealGroup, next)
              }}
              disabled={updatingServingsKey !== null}
              className="w-7 h-7 flex items-center justify-center bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 transition-colors font-bold text-base disabled:opacity-40 disabled:cursor-not-allowed"
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
          return (
            <div
              key={item.id}
              role="button"
              tabIndex={0}
              onClick={() => {
                void toggleSingleItem(item)
              }}
              onKeyDown={(e) => {
                // Only the row itself; keys on the nested checkbox keep their native behaviour
                if (e.target !== e.currentTarget || e.repeat) return
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  void toggleSingleItem(item)
                }
              }}
              className={`flex items-center gap-3 py-2 transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                item.is_checked ? 'opacity-60' : 'opacity-100'
              }`}
            >
              <input
                type="checkbox"
                onClick={(e) => e.stopPropagation()}
                checked={item.is_checked}
                aria-label={item.name ?? undefined}
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
                  {getSingleItemAmountLabel(item)}
                </p>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
