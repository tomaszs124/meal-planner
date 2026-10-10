'use client'

import { useState } from 'react'
import Image from 'next/image'
import { Meal, MealCategory, Product, MealImage, Tag } from '@/lib/supabase/client'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import MealPickerModal from './MealPickerModal'
import type { MealWithDetails as LoadedMeal } from '@/lib/meals-data'
import MealDetailsModal from './MealDetailsModal'
import Button from '@/components/ui/Button'
import { formatMealMacros } from './format'
import { CheckIcon, DiceIcon, PlusIcon, SkipIcon, SwapIcon } from './icons'

type MealWithDetails = Meal & {
  totalKcal?: number
  totalProtein?: number
  totalFat?: number
  totalCarbs?: number
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
  /** Preloaded meals from the planner; the picker skips its own fetch when provided */
  meals?: LoadedMeal[]
  onSelectMeal: (meal: MealWithDetails) => void
  onRandomMeal: () => void
  onToggleConsumed: () => void
  onToggleSkipped: () => void
}

const CATEGORY_COLORS: Record<MealCategory, string> = {
  breakfast: 'bg-yellow-50 dark:bg-yellow-950 border-yellow-200 dark:border-yellow-800',
  second_breakfast: 'bg-orange-50 dark:bg-orange-950 border-orange-200 dark:border-orange-800',
  lunch: 'bg-sky-50 dark:bg-sky-950 border-sky-200 dark:border-sky-800',
  dinner: 'bg-indigo-50 dark:bg-indigo-950 border-indigo-200 dark:border-indigo-800',
  snack: 'bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800',
}

export default function MealSlot({
  category,
  categoryLabel,
  selectedMeal,
  isConsumed,
  isSkipped,
  householdId,
  meals,
  onSelectMeal,
  onRandomMeal,
  onToggleConsumed,
  onToggleSkipped,
}: MealSlotProps) {
  const { user } = useCurrentUser()
  const [showPicker, setShowPicker] = useState(false)
  const [showDetailsModal, setShowDetailsModal] = useState(false)

  const colorClass = CATEGORY_COLORS[category] || 'bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-700'

  return (
    <>
      <div className={`rounded-lg border-2 p-4 ${colorClass}`}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-gray-900 dark:text-gray-100">{categoryLabel}</h3>
        </div>

        {selectedMeal ? (
          <div
            role="button"
            tabIndex={0}
            className="bg-white dark:bg-gray-800 rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700 cursor-pointer hover:shadow-md transition-shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
            onClick={() => setShowDetailsModal(true)}
            onKeyDown={(e) => {
              // Only the card itself; Enter/Space on the nested action buttons keep their own click
              if (e.target !== e.currentTarget || e.repeat) return
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                setShowDetailsModal(true)
              }
            }}
          >
            {/* Meal image */}
            {selectedMeal.images && selectedMeal.images.length > 0 ? (
              <div className="relative w-full h-32 bg-gray-100 dark:bg-gray-700">
                <Image
                  src={selectedMeal.images[0].image_url}
                  alt={selectedMeal.name}
                  fill
                  sizes="(max-width: 768px) 100vw, 400px"
                  className="object-cover"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none'
                  }}
                />
              </div>
            ) : (
              <div className="w-full h-32 bg-gradient-to-br from-gray-100 dark:from-gray-700 to-gray-200 dark:to-gray-800 flex items-center justify-center">
                <span className="text-gray-400 dark:text-gray-500 text-sm">Brak zdjęcia</span>
              </div>
            )}

            {/* Meal info */}
            <div className="p-3 space-y-2">
              {/* Meal name */}
              <h4 className="font-semibold text-gray-900 dark:text-gray-100 text-sm">{selectedMeal.name}</h4>

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
              <div className="text-xs text-gray-600 dark:text-gray-400">{formatMealMacros(selectedMeal)}</div>

              {/* Action buttons */}
              <div className="flex flex-wrap gap-2 pt-1 [&>button]:min-w-0 [&>button]:flex-1">
                <Button
                  size="sm"
                  icon={<SwapIcon />}
                  onClick={(e) => {
                    e.stopPropagation()
                    setShowPicker(true)
                  }}
                >
                  Zmień
                </Button>
                <Button
                  size="sm"
                  variant={isSkipped ? 'primary' : 'secondary'}
                  aria-pressed={isSkipped}
                  icon={<SkipIcon />}
                  onClick={(e) => {
                    e.stopPropagation()
                    onToggleSkipped()
                  }}
                >
                  {isSkipped ? 'Pominięty' : 'Pomiń'}
                </Button>
                <Button
                  size="sm"
                  variant={isConsumed ? 'primary' : 'secondary'}
                  aria-pressed={isConsumed}
                  icon={<CheckIcon />}
                  onClick={(e) => {
                    e.stopPropagation()
                    onToggleConsumed()
                  }}
                >
                  {isConsumed ? 'Zjedzony' : 'Zjedz'}
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <Button fullWidth icon={<PlusIcon />} onClick={() => setShowPicker(true)}>
              Wybierz posiłek
            </Button>
            <Button fullWidth size="sm" variant="ghost" icon={<DiceIcon />} onClick={onRandomMeal} aria-label="Losuj posiłek">
              Losuj
            </Button>
          </div>
        )}
      </div>

      <MealPickerModal
        meals={meals}
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
        initialVariantUserId={user?.id}
      />
    </>
  )
}
