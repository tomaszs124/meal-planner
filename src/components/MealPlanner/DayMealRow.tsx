'use client'

import { useState } from 'react'
import Image from 'next/image'
import type { MealCategory } from '@/lib/supabase/client'
import type { MealWithDetails } from '@/lib/meals-data'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import Button from '@/components/ui/Button'
import MealPickerModal from './MealPickerModal'
import MealDetailsModal from './MealDetailsModal'
import { formatMealMacros } from './format'
import { CheckIcon, DiceIcon, PlateIcon, PlusIcon, SkipIcon, SwapIcon } from './icons'
import { HeartIcon } from '@/components/ui/FavoriteButton'
import { useFavoriteIds } from '@/lib/favorites'

type DayMealRowProps = {
  category: MealCategory
  categoryLabel: string
  selectedMeal: MealWithDetails | null
  isConsumed: boolean
  isSkipped: boolean
  householdId: string
  /** Preloaded meals from the planner; the picker skips its own fetch when provided */
  meals?: MealWithDetails[]
  onSelectMeal: (meal: MealWithDetails) => void
  onRandomMeal: () => void
  onToggleConsumed: () => void
  onToggleSkipped: () => void
}

/** Subtle 4 px left accent per category (same hues as MealSlot's card backgrounds). */
const CATEGORY_ACCENT: Record<MealCategory, string> = {
  breakfast: 'border-l-rose-300',
  second_breakfast: 'border-l-orange-300',
  lunch: 'border-l-sky-300',
  dinner: 'border-l-indigo-300',
  snack: 'border-l-emerald-300',
}

function Thumbnail({ meal, favorite = false }: { meal: MealWithDetails | null; favorite?: boolean }) {
  const image = meal?.images?.[0]
  return (
    <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-gray-100 dark:bg-gray-700">
      {favorite && (
        <span
          className="absolute left-0.5 top-0.5 z-10 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-white/90 text-rose-500 shadow-sm dark:bg-gray-900/80"
          title="Ulubione"
        >
          <HeartIcon filled className="h-3 w-3" />
        </span>
      )}
      {/* Placeholder sits underneath; a broken image hides itself and reveals it */}
      <div className="absolute inset-0 flex items-center justify-center text-gray-400 dark:text-gray-500">
        <PlateIcon className="h-6 w-6" />
      </div>
      {image && meal && (
        <Image
          src={image.image_url}
          alt={meal.name}
          fill
          sizes="56px"
          className="object-cover"
          onError={(e) => {
            e.currentTarget.style.display = 'none'
          }}
        />
      )}
    </div>
  )
}

/**
 * One compact row of the day plan (phones and tablets): thumbnail, category caption,
 * meal name, kcal/macro line, status badge and Zjedz / Pomiń / Zmień actions.
 * Tapping the thumbnail/text opens MealDetailsModal; an empty category offers Wybierz / Losuj.
 */
export default function DayMealRow({
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
}: DayMealRowProps) {
  const { user } = useCurrentUser()
  const [showPicker, setShowPicker] = useState(false)
  const [showDetailsModal, setShowDetailsModal] = useState(false)
  const favoriteIds = useFavoriteIds()

  const caption = (
    <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">{categoryLabel}</div>
  )

  return (
    <>
      <div
        className={`flex flex-col gap-3 rounded-lg border border-l-4 border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-3 shadow-sm sm:flex-row sm:items-center ${CATEGORY_ACCENT[category]} ${
          isConsumed || isSkipped ? 'opacity-75' : ''
        }`}
      >
        {selectedMeal ? (
          <div
            role="button"
            tabIndex={0}
            aria-label={`${categoryLabel}: ${selectedMeal.name}. Pokaż szczegóły`}
            className="-m-1 flex min-w-0 flex-1 cursor-pointer items-start gap-3 rounded-lg p-1 transition-colors hover:bg-gray-50 dark:hover:bg-gray-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
            onClick={() => setShowDetailsModal(true)}
            onKeyDown={(e) => {
              if (e.repeat) return
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                setShowDetailsModal(true)
              }
            }}
          >
            <Thumbnail meal={selectedMeal} favorite={favoriteIds.has(selectedMeal.id)} />
            <div className="min-w-0 flex-1">
              {caption}
              <div className={`line-clamp-2 text-sm font-semibold leading-snug text-gray-900 dark:text-gray-100 ${isSkipped ? 'line-through' : ''}`}>
                {selectedMeal.name}
              </div>
              <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className="text-xs text-gray-500 dark:text-gray-400">{formatMealMacros(selectedMeal)}</span>
                {isConsumed && (
                  <span className="inline-flex items-center gap-0.5 rounded-full bg-green-100 dark:bg-green-900 px-2 py-0.5 text-[11px] font-medium text-green-800 dark:text-green-200">
                    <CheckIcon className="h-3 w-3" />
                    Zjedzony
                  </span>
                )}
                {isSkipped && (
                  <span className="inline-flex items-center rounded-full bg-orange-100 dark:bg-orange-900 px-2 py-0.5 text-[11px] font-medium text-orange-800 dark:text-orange-200">
                    Pominięty
                  </span>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <Thumbnail meal={null} />
            <div className="min-w-0 flex-1">
              {caption}
              <div className="text-sm text-gray-500 dark:text-gray-400">Nie zaplanowano</div>
            </div>
          </div>
        )}

        {/* Actions: own row under the text on phones, to the right from `sm` */}
        <div className="flex flex-wrap gap-2 sm:shrink-0 [&>button]:flex-1 sm:[&>button]:flex-none">
          {selectedMeal ? (
            <>
              <Button
                size="sm"
                variant={isConsumed ? 'primary' : 'secondary'}
                aria-pressed={isConsumed}
                icon={<CheckIcon />}
                onClick={onToggleConsumed}
              >
                {isConsumed ? 'Zjedzony' : 'Zjedz'}
              </Button>
              <Button
                size="sm"
                variant={isSkipped ? 'primary' : 'secondary'}
                aria-pressed={isSkipped}
                icon={<SkipIcon />}
                onClick={onToggleSkipped}
              >
                {isSkipped ? 'Pominięty' : 'Pomiń'}
              </Button>
              <Button size="sm" icon={<SwapIcon />} onClick={() => setShowPicker(true)}>
                Zmień
              </Button>
            </>
          ) : (
            <>
              <Button size="sm" icon={<PlusIcon />} onClick={() => setShowPicker(true)}>
                Wybierz
              </Button>
              <Button size="sm" icon={<DiceIcon />} onClick={onRandomMeal} aria-label={`Losuj posiłek: ${categoryLabel}`}>
                Losuj
              </Button>
            </>
          )}
        </div>
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
        meal={selectedMeal}
        userId={user?.id}
        householdId={householdId}
        showVariantSelector={true}
        initialVariantUserId={user?.id}
      />
    </>
  )
}
