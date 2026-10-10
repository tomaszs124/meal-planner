'use client'

import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { useFocusTrap } from '@/components/ui/useFocusTrap'
import Image from 'next/image'
import { Meal, MealImage, Product, Tag } from '@/lib/supabase/client'
import { supabase } from '@/lib/supabase/client'
import { calculateNutrition, formatAmount } from '@/lib/nutrition'
import Button from '@/components/ui/Button'

type MealItem = {
  product?: Product
  amount: number
  unit_type?: string
}

type VariantItem = {
  product: Product | null
  amount: number
  unit_type: string
  product_id: string
}

type MealWithDetails = Meal & {
  totalKcal?: number
  images?: MealImage[]
  tags?: Tag[]
  items?: MealItem[]
  isUserVariant?: boolean
  variantUserName?: string
}

type HouseholdMember = {
  user_id: string
  display_name: string | null
  isMe: boolean
}

type MealDetailsModalProps = {
  isOpen: boolean
  onClose: () => void
  meal: MealWithDetails | null
  onSelectMeal?: (meal: MealWithDetails) => void
  userId?: string
  householdId?: string
  showVariantSelector?: boolean
  initialVariantUserId?: string | null
  /** Extra buttons (e.g. Edytuj / Usuń) rendered in the footer next to "Zamknij". */
  actions?: ReactNode
  /** Set to false when related controls are rendered outside the dialog. */
  ariaModal?: boolean
}

function translateUnit(unitType: string): string {
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

export default function MealDetailsModal({
  isOpen,
  onClose,
  meal,
  onSelectMeal,
  userId,
  householdId,
  showVariantSelector,
  initialVariantUserId,
  actions,
  ariaModal = true,
}: MealDetailsModalProps) {
  const titleId = useId()
  const [servings, setServings] = useState(1)
  const [householdMembers, setHouseholdMembers] = useState<HouseholdMember[]>([])
  const [selectedVariantUserId, setSelectedVariantUserId] = useState<string | null>(initialVariantUserId ?? null)
  const [activeIngredientTooltip, setActiveIngredientTooltip] = useState<number | null>(null)
  const [variantItemsByUser, setVariantItemsByUser] = useState<Record<string, VariantItem[]>>({})
  const [baseItems, setBaseItems] = useState<MealItem[] | null>(null)
  const membersCacheRef = useRef<{ householdId: string | null; userId: string | null; members: HouseholdMember[] } | null>(null)

  useEffect(() => {
    if (!isOpen || !householdId || !meal?.id || !showVariantSelector) {
      return
    }

    if (
      membersCacheRef.current?.householdId === householdId &&
      membersCacheRef.current?.userId === (userId ?? null) &&
      membersCacheRef.current.members.length > 0
    ) {
      setHouseholdMembers(membersCacheRef.current.members)
      return
    }

    async function loadVariants() {
      if (!meal?.id) return

      try {
        const { data: membersData, error } = await supabase
          .from('household_users')
          .select('user_id')
          .eq('household_id', householdId)

        if (error || !membersData || membersData.length === 0) {
          setHouseholdMembers([])
          return
        }

        const allUserIds = membersData.map((m: { user_id: string }) => m.user_id)
        // every member, the signed-in user first: the footer shows one avatar per person
        const userIds = [...allUserIds].sort((a: string, b: string) => Number(b === userId) - Number(a === userId))

        if (userIds.length === 0) {
          setHouseholdMembers([])
          return
        }

        const { data: namesData, error: namesError } = await supabase
          .from('user_settings')
          .select('user_id, name')
          .in('user_id', userIds)

        if (namesError) {
          setHouseholdMembers([])
          return
        }

        const nameMap = new Map((namesData || []).map((s: { user_id: string; name: string | null }) => [s.user_id, s.name]))

        const members: HouseholdMember[] = userIds.map((memberId: string) => {
          const name = nameMap.get(memberId)
          return {
            user_id: memberId,
            display_name: name || null,
            isMe: memberId === userId,
          }
        })

        membersCacheRef.current = { householdId: householdId ?? null, userId: userId ?? null, members }
        setHouseholdMembers(members)
      } catch {
        setHouseholdMembers([])
      }
    }

    loadVariants()
  }, [isOpen, householdId, meal?.id, userId, showVariantSelector])

  useEffect(() => {
    const variantUserId = selectedVariantUserId
    if (!variantUserId || !meal?.id) {
      return
    }

    const safeVariantUserId = String(variantUserId)

    if (variantItemsByUser[safeVariantUserId]) {
      return
    }

    async function loadVariantItems() {
      if (!meal?.id) return

      const { data } = await supabase
        .from('meal_item_overrides')
        .select('*, product:products(*)')
        .eq('meal_id', meal.id)
        .eq('user_id', safeVariantUserId)

      setVariantItemsByUser((current) => ({
        ...current,
        [safeVariantUserId]: (data as VariantItem[]) || [],
      }))
    }

    loadVariantItems()
  }, [selectedVariantUserId, meal?.id, variantItemsByUser])

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    setSelectedVariantUserId(initialVariantUserId ?? null)
    setVariantItemsByUser({})
    setBaseItems(null)
  }, [meal?.id, initialVariantUserId])
  /* eslint-enable react-hooks/set-state-in-effect */

  useEffect(() => {
    const mealId = meal?.id
    if (!mealId) return

    async function loadBaseItems() {
      const { data } = await supabase
        .from('meal_items')
        .select('*, product:products(*)')
        .eq('meal_id', mealId)

      if (data) {
        setBaseItems(data as MealItem[])
      }
    }

    loadBaseItems()
  }, [meal?.id])

  // Focus management + close on Escape. With ariaModal=false the related footer lives
  // outside the dialog (MealDetailsWithActions), so Tab must be allowed to leave it.
  const isVisible = isOpen && !!meal
  const dialogRef = useRef<HTMLDivElement>(null)
  useFocusTrap(dialogRef, { active: isVisible, onEscape: onClose, trapTab: ariaModal })

  const selectedVariantItems = selectedVariantUserId ? variantItemsByUser[selectedVariantUserId] : undefined

  let displayItems: MealItem[] | undefined
  if (selectedVariantUserId) {
    if (selectedVariantItems && selectedVariantItems.length > 0) {
      // User has an override — show it
      displayItems = selectedVariantItems.map(item => ({ ...item, product: item.product ?? undefined }))
    } else if (selectedVariantItems !== undefined) {
      // Override was fetched but is empty — user has no override, show base
      displayItems = baseItems || meal?.items
    }
    // else: still loading override — displayItems stays undefined (loading state)
  } else {
    displayItems = baseItems || meal?.items
  }

  if (!isOpen || !meal) return null

  const hasImage = !!meal.images && meal.images.length > 0

  const macros = displayItems?.reduce(
    (acc, item) => {
      const product = item.product
      if (product) {
        acc.protein += calculateNutrition(item.amount, product.unit_weight_grams, product.protein || 0)
        acc.fat += calculateNutrition(item.amount, product.unit_weight_grams, product.fat || 0)
        acc.carbs += calculateNutrition(item.amount, product.unit_weight_grams, product.carbs || 0)
      }
      return acc
    },
    { protein: 0, fat: 0, carbs: 0 }
  ) || { protein: 0, fat: 0, carbs: 0 }

  const displayKcal = displayItems?.reduce((acc, item) => {
    const product = item.product
    if (product) {
      acc += calculateNutrition(item.amount, product.unit_weight_grams, product.kcal_per_unit)
    }
    return acc
  }, 0) || meal.totalKcal || 0

  // m-0: overlays are rendered inside `space-y-*` containers, whose child margin would
  // otherwise shrink a fixed inset-0 element and let the page show through at the bottom.
  return (
    <div
      className="fixed inset-0 z-[60] m-0 flex items-stretch justify-center bg-gray-900/40 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal={ariaModal ? 'true' : undefined}
        aria-labelledby={titleId}
        className="h-full w-full max-w-2xl overflow-y-auto bg-white dark:bg-gray-800 shadow-xl sm:h-auto sm:max-h-[90vh] sm:rounded-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-3 sm:px-6 sm:py-4">
          <div>
            <h2 id={titleId} className="text-lg font-bold leading-snug text-gray-900 dark:text-gray-100 sm:text-2xl">{meal.name}</h2>
            {meal.isUserVariant && (
              <p className="text-xs text-indigo-600 dark:text-indigo-400 font-semibold mt-1">→ Przepis dostosowany dla Ciebie</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Zamknij"
            className="-mr-1.5 -mt-1.5 shrink-0 rounded-md p-1.5 text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-600 dark:hover:text-gray-300 transition-colors sm:-mt-0.5"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="px-4 py-5 sm:px-6 space-y-5">
          {/* 1. Photo (compact) + summary strip */}
          {hasImage && (
            <div className="relative -mx-4 -mt-5 sm:-mx-6">
              <Image
                src={meal.images![0].image_url}
                alt={meal.name}
                width={800}
                height={224}
                className="h-40 w-full object-cover sm:h-56"
              />
              {/* tags sit on the photo, over a soft gradient so they stay readable on any picture */}
              {meal.tags && meal.tags.length > 0 && (
                <div
                  className="absolute inset-x-0 bottom-0 flex flex-wrap gap-1.5 bg-gradient-to-t from-black/55 to-transparent px-4 pb-3 pt-8 sm:px-6"
                  aria-label="Tagi"
                >
                  {meal.tags.map((tag) => (
                    <span
                      key={tag.id}
                      className="rounded-full px-2.5 py-1 text-xs font-semibold shadow-sm"
                      style={{ backgroundColor: tag.color, color: tag.text_color }}
                    >
                      {tag.name}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
            <div className="flex flex-wrap items-center gap-1.5 text-sm" aria-label="Wartości odżywcze">
              <span className="rounded bg-brand-100 dark:bg-brand-900 px-2.5 py-1 font-semibold text-brand-800 dark:text-brand-200 tabular-nums">
                {Math.round(displayKcal * servings)} kcal
              </span>
              <span className="rounded bg-green-100 dark:bg-green-900 px-2 py-1 text-green-800 dark:text-green-200 tabular-nums">B: {(macros.protein * servings).toFixed(1)} g</span>
              <span className="rounded bg-yellow-100 dark:bg-yellow-900 px-2 py-1 text-yellow-800 dark:text-yellow-200 tabular-nums">T: {(macros.fat * servings).toFixed(1)} g</span>
              <span className="rounded bg-purple-100 dark:bg-purple-900 px-2 py-1 text-purple-800 dark:text-purple-200 tabular-nums">W: {(macros.carbs * servings).toFixed(1)} g</span>
              {servings !== 1 && <span className="text-xs text-gray-500 dark:text-gray-400">({formatAmount(servings)} porcji)</span>}
            </div>
            {!hasImage && meal.tags && meal.tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5" aria-label="Tagi">
                {meal.tags.map((tag) => (
                  <span
                    key={tag.id}
                    className="rounded-full px-2.5 py-1 text-xs font-medium"
                    style={{ backgroundColor: tag.color, color: tag.text_color }}
                  >
                    {tag.name}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* 2. Ingredients, with the variant switch right above them */}
          <div>
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
              <div className="flex items-center gap-3">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Składniki</h3>
              {showVariantSelector && householdMembers.length > 1 && (
                <div role="group" aria-label="Wersja przepisu" className="flex items-center -space-x-1">
                  {householdMembers.map((member) => {
                    const name = member.display_name || (member.isMe ? 'Ja' : '?')
                    const active = selectedVariantUserId === member.user_id
                    return (
                      <button
                        key={member.user_id}
                        type="button"
                        onClick={() => setSelectedVariantUserId(member.user_id)}
                        aria-pressed={active}
                        aria-label={`Wersja: ${name}`}
                        title={member.isMe ? `${name} (mój przepis)` : name}
                        className={`relative flex h-9 w-9 items-center justify-center rounded-full border-2 border-white text-sm font-bold transition-all dark:border-gray-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${
                          active
                            ? 'z-10 bg-brand-400 text-gray-900 shadow-md shadow-brand-500/30 scale-110'
                            : 'bg-gray-200 text-gray-600 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
                        }`}
                      >
                        {name.charAt(0).toUpperCase()}
                      </button>
                    )
                  })}
                </div>
              )}
              </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setServings(Math.max(0.5, servings - 0.5))}
                    aria-label="Zmniejsz liczbę porcji"
                    className="flex h-7 w-7 items-center justify-center rounded-full bg-gray-200 text-base font-bold text-gray-800 transition-colors hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-100 dark:hover:bg-gray-600"
                  >
                    -
                  </button>
                  <input
                    type="number"
                    inputMode="decimal"
                    aria-label="Liczba porcji"
                    value={servings}
                    onChange={(e) => setServings(Math.max(0.5, parseFloat(e.target.value) || 1))}
                    step="0.5"
                    min="0.5"
                    className="w-14 rounded-lg border border-gray-300 bg-white px-2 py-1 text-center text-sm font-semibold text-gray-900 tabular-nums focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
                  />
                  <button
                    type="button"
                    onClick={() => setServings(servings + 0.5)}
                    aria-label="Zwiększ liczbę porcji"
                    className="flex h-7 w-7 items-center justify-center rounded-full bg-gray-200 text-base font-bold text-gray-800 transition-colors hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-100 dark:hover:bg-gray-600"
                  >
                    +
                  </button>
                </div>
            </div>

            {displayItems === undefined ? (
              <ul className="space-y-2 border-t border-gray-200 dark:border-gray-700 pt-3" aria-busy="true" aria-label="Ładowanie składników">
                {[0, 1, 2, 3].map((i) => (
                  <li key={i} className="h-5 animate-pulse rounded bg-gray-100 dark:bg-gray-700" />
                ))}
              </ul>
            ) : displayItems.length === 0 ? (
              <p className="border-t border-gray-200 dark:border-gray-700 pt-3 text-sm text-gray-500 dark:text-gray-400">Brak składników.</p>
            ) : (
              <ul className="space-y-2 border-t border-gray-200 dark:border-gray-700 pt-3">
                {displayItems.map((item, index) => {
                  const totalWeight = item.product ? Math.round(item.amount * servings * (item.product.unit_weight_grams || 1)) : 0
                  const unitType = item.unit_type || item.product?.unit_type || '100g'
                  const productNotes = item.product?.notes
                  return (
                    <li key={index} className="flex items-center justify-between text-sm gap-2">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="text-gray-900 dark:text-gray-100 font-medium truncate">{item.product?.name || 'Nieznany produkt'}</span>
                        {productNotes && (
                          <div className="relative flex-shrink-0">
                            <button
                              type="button"
                              onClick={() => setActiveIngredientTooltip(activeIngredientTooltip === index ? null : index)}
                              className="w-4 h-4 flex items-center justify-center rounded-full bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-300 dark:hover:bg-gray-500 transition-colors text-[10px] font-bold leading-none"
                              aria-label="Pokaż notatkę"
                              aria-expanded={activeIngredientTooltip === index}
                            >
                              i
                            </button>
                            {activeIngredientTooltip === index && (
                              <div className="absolute left-0 bottom-full mb-2 w-56 bg-gray-900 text-white text-xs rounded-lg p-3 shadow-lg z-10">
                                {productNotes}
                                <div className="absolute left-2 top-full w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900" />
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                      <span className="text-gray-600 dark:text-gray-400 flex-shrink-0">
                        {unitType === '100g'
                          ? `${totalWeight}g`
                          : `${formatAmount(item.amount * servings)} ${translateUnit(unitType)} (${totalWeight}g)`}
                      </span>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>

          {/* 3. Recipe */}
          {meal.description && (
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">Przepis</h3>
              <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap leading-relaxed border-t border-gray-200 dark:border-gray-700 pt-3">
                {meal.description}
              </p>
            </div>
          )}
        </div>

        <div className="sticky bottom-0 flex flex-wrap items-center justify-between gap-2 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-3 sm:px-6">
          <div className="flex gap-2">{actions}</div>
          {onSelectMeal ? (
            <div className="flex gap-2">
              <Button onClick={onClose}>Anuluj</Button>
              <Button
                variant="primary"
                onClick={() => {
                  onSelectMeal(meal)
                  onClose()
                }}
              >
                Wybierz ten posiłek
              </Button>
            </div>
          ) : (
            <Button variant="primary" onClick={onClose}>
              Zamknij
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
