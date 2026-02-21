'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import { supabase, Meal, MealCategory, Product, MealImage, Tag } from '@/lib/supabase/client'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import MealDetailsModal from './MealDetailsModal'

function calculateNutrition(amount: number, unitWeightGrams: number | null, valuePer100g: number): number {
  const weightGrams = amount * (unitWeightGrams || 1)
  return (weightGrams / 100) * valuePer100g
}

type MealWithDetails = Meal & {
  items?: {
    product?: Product
    amount: number
  }[]
  images?: MealImage[]
  tags?: Tag[]
  totalKcal?: number
  isUserVariant?: boolean
}

type MealPickerModalProps = {
  isOpen: boolean
  onClose: () => void
  onSelectMeal: (meal: MealWithDetails) => void
  category: MealCategory
  householdId: string
}

export default function MealPickerModal({ isOpen, onClose, onSelectMeal, category, householdId }: MealPickerModalProps) {
  const { user } = useCurrentUser()
  const [meals, setMeals] = useState<MealWithDetails[]>([])
  const [tags, setTags] = useState<Tag[]>([])
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [selectedMealForDetails, setSelectedMealForDetails] = useState<MealWithDetails | null>(null)

  // Fetch tags for household
  useEffect(() => {
    if (!isOpen || !householdId) return

    async function fetchTags() {
      const { data } = await supabase
        .from('tags')
        .select('*')
        .eq('household_id', householdId)
        .order('name')

      if (data) {
        setTags(data)
      }
    }

    fetchTags()
  }, [isOpen, householdId])

  useEffect(() => {
    const userId = user?.id
    if (!isOpen || !householdId || !userId) return

    async function fetchMeals() {
      setIsLoading(true)

      // Pobierz wszystkie posiłki dla household
      const { data: mealsData } = await supabase
        .from('meals')
        .select('*')
        .eq('household_id', householdId)
        .order('created_at', { ascending: false })

      if (mealsData) {
        // Pobierz szczegóły dla każdego posiłku
        const mealsWithDetails = await Promise.all(
          mealsData.map(async (meal) => {
            // Check if user has overrides for this meal
            const { data: overridesData } = await supabase
              .from('meal_item_overrides')
              .select('*, product:products(*)')
              .eq('meal_id', meal.id)
              .eq('user_id', userId)

            let itemsData
            if (overridesData && overridesData.length > 0) {
              // User has overrides - use them
              itemsData = overridesData
            } else {
              // No overrides - use default meal_items
              const { data } = await supabase
                .from('meal_items')
                .select('*, product:products(*)')
                .eq('meal_id', meal.id)
              itemsData = data
            }

            // Fetch meal images
            const { data: imagesData } = await supabase
              .from('meal_images')
              .select('*')
              .eq('meal_id', meal.id)
              .order('uploaded_at', { ascending: false })

            // Fetch meal tags
            type MealTagRow = { tags: Tag | null }

            const { data: mealTagsData } = await supabase
              .from('meal_tags')
              .select('tag_id, tags(*)')
              .eq('meal_id', meal.id)

            const items = itemsData || []
            const images = imagesData || []
            const mealTags = ((mealTagsData as MealTagRow[] | null) || [])
              .map((mt) => mt.tags)
              .filter((tag): tag is Tag => Boolean(tag))
            const totalKcal = items.reduce((sum, item) => {
              const product = item.product as unknown as Product
              if (!product) return sum
              return sum + calculateNutrition(item.amount, product.unit_weight_grams, product.kcal_per_unit)
            }, 0)

            return {
              ...meal,
              items,
              images,
              tags: mealTags,
              totalKcal,
              isUserVariant: overridesData && overridesData.length > 0,
            }
          })
        )

        setMeals(mealsWithDetails)
      }

      setIsLoading(false)
    }

    fetchMeals()
  }, [isOpen, householdId, user?.id])

  if (!isOpen) return null

  // Filtruj posiłki po zapytaniu wyszukiwania i tagach
  const filteredMeals = meals.filter((meal) => {
    // Text search filter
    const query = searchQuery.toLowerCase()
    const nameMatch = meal.name.toLowerCase().includes(query)
    const ingredientMatch = meal.items?.some((item) =>
      item.product?.name?.toLowerCase().includes(query)
    )
    const textMatch = nameMatch || ingredientMatch

    // Tag filter
    const tagMatch = selectedTags.length === 0 || 
      selectedTags.every(tagId => meal.tags?.some(mealTag => mealTag.id === tagId))

    return textMatch && tagMatch
  })

  // Podziel na kategorie
  const primaryMeals = filteredMeals.filter((m) => m.primary_category === category)
  const alternativeMeals = filteredMeals.filter(
    (m) => m.primary_category !== category && m.alternative_categories?.includes(category)
  )
  const otherMeals = filteredMeals.filter(
    (m) => m.primary_category !== category && !m.alternative_categories?.includes(category)
  )

  function toggleTag(tagId: string) {
    setSelectedTags(prev => 
      prev.includes(tagId) 
        ? prev.filter(id => id !== tagId)
        : [...prev, tagId]
    )
  }

  return (
    <div className="fixed inset-0 bg-white/30 backdrop-blur-sm flex items-center justify-center z-[60] pt-8 pb-6">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-900">Wybierz posiłek</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Search */}
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Szukaj po nazwie lub składnikach..."
            className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm text-black focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />

          {/* Tags filter */}
          {tags.length > 0 && (
            <div className="mt-3">
              <div className="flex flex-wrap gap-2">
                {tags.map((tag) => (
                  <button
                    key={tag.id}
                    onClick={() => toggleTag(tag.id)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                      selectedTags.includes(tag.id)
                        ? 'ring-2 ring-offset-2 ring-blue-500 opacity-100'
                        : 'opacity-60 hover:opacity-100'
                    }`}
                    style={{ 
                      backgroundColor: tag.color, 
                      color: tag.text_color 
                    }}
                  >
                    {tag.name}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {isLoading ? (
            <div className="text-center py-8 text-gray-500">Ładowanie...</div>
          ) : (
            <div className="space-y-6">
              {/* Primary category meals */}
              {primaryMeals.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-3">Polecane</h3>
                  <div className="space-y-2">
                    {primaryMeals.map((meal) => (
                      <MealCard key={meal.id} meal={meal} onShowDetails={() => setSelectedMealForDetails(meal)} />
                    ))}
                  </div>
                </div>
              )}

              {/* Alternative category meals */}
              {alternativeMeals.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-3">Alternatywne</h3>
                  <div className="space-y-2">
                    {alternativeMeals.map((meal) => (
                      <MealCard key={meal.id} meal={meal} onShowDetails={() => setSelectedMealForDetails(meal)} />
                    ))}
                  </div>
                </div>
              )}

              {/* Other meals */}
              {otherMeals.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-3">Pozostałe</h3>
                  <div className="space-y-2">
                    {otherMeals.map((meal) => (
                      <MealCard key={meal.id} meal={meal} onShowDetails={() => setSelectedMealForDetails(meal)} />
                    ))}
                  </div>
                </div>
              )}

              {filteredMeals.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  {searchQuery ? 'Nie znaleziono posiłków' : 'Brak posiłków'}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <MealDetailsModal
        isOpen={selectedMealForDetails !== null}
        onClose={() => setSelectedMealForDetails(null)}
        meal={selectedMealForDetails}
        onSelectMeal={(meal) => {
          onSelectMeal(meal)
          setSelectedMealForDetails(null)
          onClose()
        }}
        userId={user?.id}
        householdId={householdId}
      />
    </div>
  )
}

function MealCard({ meal, onShowDetails }: { meal: MealWithDetails; onShowDetails: () => void }) {
  return (
    <button
      onClick={onShowDetails}
      className="w-full text-left p-3 border border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-all"
    >
      <div className="flex items-start gap-3">
        {/* Meal image thumbnail */}
        {meal.images && meal.images.length > 0 ? (
          <div className="w-16 h-16 flex-shrink-0 rounded-lg overflow-hidden bg-gray-100">
            <Image
              src={meal.images[0].image_url}
              alt={meal.name}
              width={64}
              height={64}
              className="w-full h-full object-cover"
            />
          </div>
        ) : (
          <div className="w-16 h-16 flex-shrink-0 rounded-lg bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center">
            <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
        )}

        <div className="flex-1 min-w-0">
          <h4 className="font-semibold text-gray-900">{meal.name}</h4>
          {meal.items && meal.items.length > 0 && (
            <p className="text-xs text-gray-500 mt-1 truncate">
              {meal.items.slice(0, 3).map((item) => item.product?.name).filter(Boolean).join(', ')}
              {meal.items.length > 3 && '...'}
            </p>
          )}
          {meal.tags && meal.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {meal.tags.map((tag) => (
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
        </div>
        {meal.totalKcal !== undefined && (
          <span className="ml-2 text-sm font-semibold text-blue-600 flex-shrink-0">
            {Math.round(meal.totalKcal)} kcal
          </span>
        )}
      </div>
    </button>
  )
}
