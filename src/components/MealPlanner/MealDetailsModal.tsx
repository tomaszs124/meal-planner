'use client'

import { useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import { Meal, MealImage, Product, Tag } from '@/lib/supabase/client'
import { supabase } from '@/lib/supabase/client'

function calculateNutrition(amount: number, unitWeightGrams: number | null, valuePer100g: number): number {
  const weightGrams = amount * (unitWeightGrams || 1)
  return (weightGrams / 100) * valuePer100g
}

function formatAmount(amount: number): string {
  return Number(amount.toFixed(2)).toString()
}

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
}

type MealDetailsModalProps = {
  isOpen: boolean
  onClose: () => void
  meal: MealWithDetails | null
  onSelectMeal?: (meal: MealWithDetails) => void
  userId?: string
  householdId?: string
  showVariantSelector?: boolean
}

function translateUnit(unitType: string): string {
  const units: { [key: string]: string } = {
    '100g': 'g',
    'piece': 'szt',
    'tablespoon': 'łyżka',
    'teaspoon': 'łyżeczka',
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
}: MealDetailsModalProps) {
  const [servings, setServings] = useState(1)
  const [householdMembers, setHouseholdMembers] = useState<HouseholdMember[]>([])
  const [selectedVariantUserId, setSelectedVariantUserId] = useState<string | null>(null)
  const [variantItemsByUser, setVariantItemsByUser] = useState<Record<string, VariantItem[]>>({})
  const [variantUserIds, setVariantUserIds] = useState<string[]>([])
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
        const userIds = userId ? allUserIds.filter((id: string) => id !== userId) : allUserIds

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

        const members: HouseholdMember[] = userIds.map((userId: string) => {
          const name = nameMap.get(userId)
          return {
            user_id: userId,
            display_name: name || null,
          }
        })

        const { data: overridesData } = await supabase
          .from('meal_item_overrides')
          .select('user_id')
          .eq('meal_id', meal.id)
          .in('user_id', userIds)

        const overrideIds = (overridesData || []).map((row: { user_id: string }) => row.user_id)
        setVariantUserIds(overrideIds)

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
    setSelectedVariantUserId(null)
    setVariantItemsByUser({})
    setVariantUserIds([])
    setBaseItems(null)
  }, [meal?.id])
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

  const selectedVariantItems = selectedVariantUserId ? variantItemsByUser[selectedVariantUserId] : undefined
  const selectedHasOverride = selectedVariantUserId
    ? variantUserIds.includes(selectedVariantUserId)
    : true
  const displayItems = selectedVariantUserId
    ? selectedHasOverride
      ? selectedVariantItems && selectedVariantItems.length > 0
        ? selectedVariantItems
        : meal?.items
      : baseItems || meal?.items
    : meal?.items

  if (!isOpen || !meal) return null

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

  return (
    <div
      className="fixed inset-0 bg-white/30 backdrop-blur-sm flex items-center justify-center z-[60] pt-8 pb-6"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between z-10">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">{meal.name}</h2>
            {meal.isUserVariant && (
              <p className="text-xs text-indigo-600 font-semibold mt-1">→ Przepis dostosowany dla Ciebie</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6 space-y-6">
          {meal.images && meal.images.length > 0 && (
            <div className="w-full">
              <Image
                src={meal.images[0].image_url}
                alt={meal.name}
                width={800}
                height={256}
                className="w-full h-64 rounded-lg border border-gray-200 object-cover"
              />
            </div>
          )}

          <div className="space-y-4">
            {meal.tags && meal.tags.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-gray-900 mb-2">Tagi</h3>
                <div className="flex flex-wrap gap-2">
                  {meal.tags.map((tag) => (
                    <span
                      key={tag.id}
                      className="px-3 py-1.5 rounded-full text-sm font-medium"
                      style={{
                        backgroundColor: tag.color,
                        color: tag.text_color,
                      }}
                    >
                      {tag.name}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {showVariantSelector && householdMembers.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-gray-900 mb-2">Warianty dla domowników</h3>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => setSelectedVariantUserId(null)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                      selectedVariantUserId === null
                        ? 'bg-blue-600 text-white ring-2 ring-offset-2 ring-blue-500'
                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    }`}
                  >
                    Mój przepis
                  </button>
                  {householdMembers.map((member) => (
                    <button
                      key={member.user_id}
                      onClick={() => setSelectedVariantUserId(member.user_id)}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                        selectedVariantUserId === member.user_id
                          ? 'bg-indigo-600 text-white ring-2 ring-offset-2 ring-indigo-500'
                          : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                      }`}
                    >
                      {member.display_name || 'Brak nazwy'}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div>
            <h3 className="text-sm font-semibold text-gray-900 mb-2">Wartości odżywcze</h3>
            <div className="flex flex-wrap gap-2">
              <div className="px-3 py-1.5 rounded-lg border border-gray-200">
                <div className="text-lg font-bold text-blue-600">{Math.round(displayKcal * servings)}</div>
                <div className="text-[10px] text-gray-600">kcal</div>
              </div>
              <div className="px-3 py-1.5 rounded-lg border border-gray-200">
                <div className="text-base font-bold text-green-600">{(macros.protein * servings).toFixed(1)}g</div>
                <div className="text-[10px] text-gray-600">Białko</div>
              </div>
              <div className="px-3 py-1.5 rounded-lg border border-gray-200">
                <div className="text-base font-bold text-yellow-600">{(macros.fat * servings).toFixed(1)}g</div>
                <div className="text-[10px] text-gray-600">Tłuszcze</div>
              </div>
              <div className="px-3 py-1.5 rounded-lg border border-gray-200">
                <div className="text-base font-bold text-purple-600">{(macros.carbs * servings).toFixed(1)}g</div>
                <div className="text-[10px] text-gray-600">Węglowodany</div>
              </div>
            </div>
          </div>

          {displayItems && displayItems.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-semibold text-gray-900">Składniki</h3>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setServings(Math.max(0.5, servings - 0.5))}
                    className="w-7 h-7 flex items-center justify-center bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 transition-colors font-bold text-base"
                  >
                    -
                  </button>
                  <input
                    type="number"
                    value={servings}
                    onChange={(e) => setServings(Math.max(0.5, parseFloat(e.target.value) || 1))}
                    step="0.5"
                    min="0.5"
                    className="w-14 px-2 py-1 text-center border-2 border-indigo-300 rounded-lg font-semibold text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <button
                    onClick={() => setServings(servings + 0.5)}
                    className="w-7 h-7 flex items-center justify-center bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 transition-colors font-bold text-base"
                  >
                    +
                  </button>
                </div>
              </div>
              <ul className="space-y-2 border-t border-gray-200 pt-3">
                {displayItems.map((item, index) => {
                  const totalWeight = item.product ? Math.round(item.amount * servings * (item.product.unit_weight_grams || 1)) : 0
                  const unitType = item.unit_type || item.product?.unit_type || '100g'
                  return (
                    <li key={index} className="flex items-center justify-between text-sm">
                      <span className="text-gray-900 font-medium">{item.product?.name || 'Nieznany produkt'}</span>
                      <span className="text-gray-600">
                        {unitType === '100g'
                          ? `${totalWeight}g`
                          : `${formatAmount(item.amount * servings)} ${translateUnit(unitType)} (${totalWeight}g)`}
                      </span>
                    </li>
                  )
                })}
              </ul>
            </div>
          )}

          {meal.description && (
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-3">Przepis</h3>
              <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed border-t border-gray-200 pt-3">
                {meal.description}
              </p>
            </div>
          )}
        </div>

        <div className="sticky bottom-0 bg-white border-t border-gray-200 px-6 py-4">
          {onSelectMeal ? (
            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="flex-1 bg-gray-200 text-gray-700 px-6 py-3 rounded-lg font-semibold hover:bg-gray-300 transition-colors"
              >
                Anuluj
              </button>
              <button
                onClick={() => {
                  onSelectMeal(meal)
                  onClose()
                }}
                className="flex-1 bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors"
              >
                Wybierz ten posiłek
              </button>
            </div>
          ) : (
            <button
              onClick={onClose}
              className="w-full bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors"
            >
              Zamknij
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
