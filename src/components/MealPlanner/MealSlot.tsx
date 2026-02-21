'use client'

import { useState } from 'react'
import { Meal, MealCategory, Product, MealImage, Tag } from '@/lib/supabase/client'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import MealPickerModal from './MealPickerModal'
import MealDetailsModal from './MealDetailsModal'

// Helper function to calculate nutrition values based on weight
function calculateNutrition(amount: number, unitWeightGrams: number | null, valuePer100g: number): number {
  const weightGrams = amount * (unitWeightGrams || 100)
  return (weightGrams / 100) * valuePer100g
}

type MealWithDetails = Meal & {
  totalKcal?: number
  images?: MealImage[]
  tags?: Tag[]
  items?: {
    product?: Product
    amount: number
  }[]
  isUserVariant?: boolean
}

type MealSlotProps = {
  category: MealCategory
  categoryLabel: string
  selectedMeal: MealWithDetails | null
  isConsumed: boolean
  isSkipped: boolean
  householdId: string
  onSelectMeal: (meal: MealWithDetails) => void
  onRandomMeal: () => void
  onToggleConsumed: () => void
  onToggleSkipped: () => void
}

const CATEGORY_COLORS: Record<MealCategory, string> = {
  breakfast: 'bg-yellow-50 border-yellow-200',
  second_breakfast: 'bg-orange-50 border-orange-200',
  lunch: 'bg-red-50 border-red-200',
  dinner: 'bg-purple-50 border-purple-200',
  snack: 'bg-green-50 border-green-200',
}

export default function MealSlot({
  category,
  categoryLabel,
  selectedMeal,
  isConsumed,
  isSkipped,
  householdId,
  onSelectMeal,
  onRandomMeal,
  onToggleConsumed,
  onToggleSkipped,
}: MealSlotProps) {
  const { user } = useCurrentUser()
  const [showPicker, setShowPicker] = useState(false)
  const [showDetailsModal, setShowDetailsModal] = useState(false)

  const colorClass = CATEGORY_COLORS[category] || 'bg-gray-50 border-gray-200'

  return (
    <>
      <div className={`rounded-lg border-2 p-4 ${colorClass}`}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-gray-900">{categoryLabel}</h3>
        </div>

        {selectedMeal ? (
          <div 
            className="bg-white rounded-lg overflow-hidden border border-gray-200 cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => setShowDetailsModal(true)}
          >
            {/* Meal image */}
            {selectedMeal.images && selectedMeal.images.length > 0 ? (
              <div className="relative w-full h-32 bg-gray-100">
                <img
                  src={selectedMeal.images[0].image_url}
                  alt={selectedMeal.name}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none'
                  }}
                />
              </div>
            ) : (
              <div className="w-full h-32 bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center">
                <span className="text-gray-400 text-sm">Brak zdjęcia</span>
              </div>
            )}

            {/* Meal info */}
            <div className="p-3 space-y-2">
              {/* Meal name */}
              <h4 className="font-semibold text-gray-900 text-sm">{selectedMeal.name}</h4>

              {/* Tags */}
              {selectedMeal.tags && selectedMeal.tags.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {selectedMeal.tags.map((tag) => (
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
                  ))}
                </div>
              )}

              {/* Calories and Macros */}
              <div className="text-xs text-gray-600">
                {Math.round(selectedMeal.totalKcal || 0)} kcal • B: {Math.round(
                  (selectedMeal.items || []).reduce((sum, item) => {
                    const product = item.product
                    return sum + (product ? calculateNutrition(item.amount, product.unit_weight_grams, product.protein || 0) : 0)
                  }, 0)
                )}g • T: {Math.round(
                  (selectedMeal.items || []).reduce((sum, item) => {
                    const product = item.product
                    return sum + (product ? calculateNutrition(item.amount, product.unit_weight_grams, product.fat || 0) : 0)
                  }, 0)
                )}g • W: {Math.round(
                  (selectedMeal.items || []).reduce((sum, item) => {
                    const product = item.product
                    return sum + (product ? calculateNutrition(item.amount, product.unit_weight_grams, product.carbs || 0) : 0)
                  }, 0)
                )}g
              </div>

              {/* Action buttons */}
              <div className="flex gap-2 pt-1">
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    setShowPicker(true)
                  }}
                  className="flex-1 px-3 py-2 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors flex items-center justify-center gap-1"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Zmień
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    onToggleSkipped()
                  }}
                  className={`flex-1 px-3 py-2 text-xs font-medium rounded-lg transition-colors flex items-center justify-center gap-1 ${
                    isSkipped
                      ? 'bg-orange-500 text-white hover:bg-orange-600'
                      : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  {isSkipped ? 'Pominięty' : 'Pomiń'}
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    onToggleConsumed()
                  }}
                  className={`flex-1 px-3 py-2 text-xs font-medium rounded-lg transition-colors flex items-center justify-center gap-1 ${
                    isConsumed
                      ? 'bg-green-600 text-white hover:bg-green-700'
                      : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  {isConsumed ? 'Zjedzony' : 'Zjedz'}
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <button
              onClick={() => setShowPicker(true)}
              className="w-full bg-white border-2 border-dashed border-gray-300 rounded-lg p-3 text-sm font-medium text-gray-600 hover:border-blue-500 hover:text-blue-600 transition-all"
            >
              + Wybierz posiłek
            </button>
            <button
              onClick={onRandomMeal}
              className="w-full bg-white border border-gray-300 rounded-lg p-2 text-xs font-medium text-gray-600 hover:bg-gray-50 transition-all"
            >
              🎲 Losuj
            </button>
          </div>
        )}
      </div>

      <MealPickerModal
        isOpen={showPicker}
        onClose={() => setShowPicker(false)}
        onSelectMeal={onSelectMeal}
        category={category}
        householdId={householdId}
      />
      <MealDetailsModal
        isOpen={showDetailsModal}
        onClose={() => setShowDetailsModal(false)}
        meal={selectedMeal ? { ...selectedMeal, isUserVariant: selectedMeal.isUserVariant } : null}
        userId={user?.id}
        householdId={householdId}
        showVariantSelector={true}
      />
    </>
  )
}
