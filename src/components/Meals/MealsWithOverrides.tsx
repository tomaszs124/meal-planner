'use client'

import { useEffect, useState } from 'react'
import { supabase, Product, Meal } from '@/lib/supabase/client'
import { useCurrentUser } from '@/hooks/useCurrentUser'

function calculateNutrition(amount: number, unitWeightGrams: number | null, valuePer100g: number): number {
  const weightGrams = amount * (unitWeightGrams || 1)
  return (weightGrams / 100) * valuePer100g
}

// Helper function to format amount without trailing zeros
function formatAmount(amount: number): string {
  return Number(amount.toFixed(2)).toString()
}

// Funkcja tłumacząca jednostki na polski
function translateUnit(unitType: string): string {
  const units: { [key: string]: string } = {
    '100g': 'g',
    'piece': 'szt',
    'tablespoon': 'łyżka',
    'teaspoon': 'łyżeczka',
  }
  return units[unitType] || unitType
}

type MealItem = {
  id: string
  meal_id: string
  product_id: string
  amount: number
  unit_type: string
  product?: Product
}

type Override = {
  meal_id: string
  product_id: string
  amount: number
}

type MealWithItems = Meal & {
  items: MealItem[]
  totalKcal: number
  totalProtein: number
  totalFat: number
  totalCarbs: number
}

export default function MealsWithOverrides() {
  const { user, household, isLoading: userLoading } = useCurrentUser()
  const [meals, setMeals] = useState<MealWithItems[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [isLoading, setIsLoading] = useState(true)
  
  // Override'y dla aktualnego użytkownika (w przyszłości z tabeli meal_user_overrides)
  const [userOverrides, setUserOverrides] = useState<Override[]>([])
  
  // Edycja override'a
  const [editingOverride, setEditingOverride] = useState<{ meal_id: string; product_id: string } | null>(null)
  const [overrideAmount, setOverrideAmount] = useState<number>(0)

  // Fetch products
  useEffect(() => {
    if (!household?.id) return

    async function fetchProducts() {
      const { data } = await supabase
        .from('products')
        .select('*')
        .eq('household_id', household.id)
        .order('name')

      if (data) {
        setProducts(data)
      }
    }

    fetchProducts()
  }, [household?.id])

  // Fetch meals
  useEffect(() => {
    if (!household?.id) return

    async function fetchMeals() {
      setIsLoading(true)

      const { data: mealsData } = await supabase
        .from('meals')
        .select('*')
        .eq('household_id', household.id)
        .order('created_at', { ascending: false })

      if (mealsData) {
        const mealsWithItems = await Promise.all(
          mealsData.map(async (meal) => {
            const { data: itemsData } = await supabase
              .from('meal_items')
              .select('*')
              .eq('meal_id', meal.id)

            const items = itemsData || []

            const itemsWithProducts = items.map((item) => ({
              ...item,
              product: products.find((p) => p.id === item.product_id),
            }))

            return {
              ...meal,
              items: itemsWithProducts,
              totalKcal: 0,
              totalProtein: 0,
              totalFat: 0,
              totalCarbs: 0,
            }
          })
        )

        setMeals(mealsWithItems)
      }

      setIsLoading(false)
    }

    if (products.length > 0) {
      fetchMeals()
    }
  }, [household?.id, products])

  // Pobierz ilość produktu (bazową lub override)
  function getProductAmount(mealId: string, productId: string, baseAmount: number): number {
    const override = userOverrides.find(
      (o) => o.meal_id === mealId && o.product_id === productId
    )
    return override ? override.amount : baseAmount
  }

  // Zapisz override
  function saveOverride(mealId: string, productId: string, amount: number) {
    setUserOverrides((current) => {
      const existing = current.findIndex(
        (o) => o.meal_id === mealId && o.product_id === productId
      )
      
      if (existing >= 0) {
        const updated = [...current]
        updated[existing] = { meal_id: mealId, product_id: productId, amount }
        return updated
      } else {
        return [...current, { meal_id: mealId, product_id: productId, amount }]
      }
    })
    
    setEditingOverride(null)
  }

  // Usuń override (wróć do wartości bazowej)
  function removeOverride(mealId: string, productId: string) {
    setUserOverrides((current) =>
      current.filter((o) => !(o.meal_id === mealId && o.product_id === productId))
    )
  }

  // Wylicz kalorie dla posiłku z uwzględnieniem override'ów
  function calculateMealNutrition(meal: MealWithItems) {
    return meal.items.reduce(
      (acc, item) => {
        if (item.product) {
          const amount = getProductAmount(meal.id, item.product_id, item.amount)
          acc.totalKcal += calculateNutrition(amount, item.product.unit_weight_grams, item.product.kcal_per_unit)
          acc.totalProtein += calculateNutrition(amount, item.product.unit_weight_grams, item.product.protein || 0)
          acc.totalFat += calculateNutrition(amount, item.product.unit_weight_grams, item.product.fat || 0)
          acc.totalCarbs += calculateNutrition(amount, item.product.unit_weight_grams, item.product.carbs || 0)
        }
        return acc
      },
      { totalKcal: 0, totalProtein: 0, totalFat: 0, totalCarbs: 0 }
    )
  }

  // Rozpocznij edycję override'a
  function startEditOverride(mealId: string, productId: string, currentAmount: number) {
    setEditingOverride({ meal_id: mealId, product_id: productId })
    setOverrideAmount(currentAmount)
  }

  if (userLoading || isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-gray-500">Ładowanie...</div>
      </div>
    )
  }

  if (!household) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-sm text-yellow-800">
        Musisz najpierw dołączyć do gospodarstwa.
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto p-4 space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Posiłki z personalizacją</h2>
        <p className="text-sm text-gray-500 mt-1">Dostosuj ilości produktów do swoich potrzeb</p>
      </div>

      {/* Info box */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-800">
        <strong>Jak to działa?</strong>
        <ul className="list-disc ml-5 mt-2 space-y-1">
          <li>Każdy posiłek ma bazowe ilości produktów</li>
          <li>Możesz dostosować ilości dla siebie klikając "Personalizuj"</li>
          <li>Kalorie i makroskładniki przeliczą się automatycznie</li>
        </ul>
      </div>

      {/* Meals list */}
      <div className="space-y-4">
        {meals.length === 0 ? (
          <div className="bg-gray-50 rounded-lg border border-gray-200 p-8 text-center">
            <p className="text-gray-500 text-sm">Brak posiłków</p>
            <p className="text-gray-400 text-xs mt-1">Przejdź do zarządzania posiłkami aby dodać przepisy</p>
          </div>
        ) : (
          meals.map((meal) => {
            const nutrition = calculateMealNutrition(meal)
            const hasOverrides = meal.items.some((item) =>
              userOverrides.some((o) => o.meal_id === meal.id && o.product_id === item.product_id)
            )

            return (
              <div
                key={meal.id}
                className={`bg-white rounded-lg shadow-sm border p-4 ${
                  hasOverrides ? 'border-blue-400' : 'border-gray-200'
                }`}
              >
                {/* Meal header */}
                <div className="mb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-gray-900">
                        {meal.name}
                        {hasOverrides && (
                          <span className="ml-2 text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded">
                            Spersonalizowane
                          </span>
                        )}
                      </h3>
                      {meal.description && (
                        <p className="text-sm text-gray-600 mt-1">{meal.description}</p>
                      )}
                    </div>
                  </div>

                  {/* Nutrition summary */}
                  <div className="flex flex-wrap gap-2 mt-3 text-sm">
                    <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded font-semibold">
                      {Math.round(nutrition.totalKcal)} kcal
                    </span>
                    {nutrition.totalProtein > 0 && (
                      <span className="bg-green-100 text-green-800 px-2 py-1 rounded">
                        B: {nutrition.totalProtein.toFixed(1)}g
                      </span>
                    )}
                    {nutrition.totalFat > 0 && (
                      <span className="bg-yellow-100 text-yellow-800 px-2 py-1 rounded">
                        T: {nutrition.totalFat.toFixed(1)}g
                      </span>
                    )}
                    {nutrition.totalCarbs > 0 && (
                      <span className="bg-purple-100 text-purple-800 px-2 py-1 rounded">
                        W: {nutrition.totalCarbs.toFixed(1)}g
                      </span>
                    )}
                  </div>
                </div>

                {/* Ingredients list */}
                <div className="bg-gray-50 rounded-lg p-3">
                  <h4 className="text-xs font-semibold text-gray-700 mb-2">Składniki:</h4>
                  <div className="space-y-2">
                    {meal.items.map((item) => {
                      const currentAmount = getProductAmount(meal.id, item.product_id, item.amount)
                      const isOverridden = userOverrides.some(
                        (o) => o.meal_id === meal.id && o.product_id === item.product_id
                      )
                      const isEditing =
                        editingOverride?.meal_id === meal.id &&
                        editingOverride?.product_id === item.product_id

                      return (
                        <div
                          key={item.id}
                          className={`flex items-center justify-between gap-2 p-2 rounded ${
                            isOverridden ? 'bg-blue-50 border border-blue-200' : 'bg-white'
                          }`}
                        >
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className="text-sm text-gray-900 font-medium">
                                {item.product?.name}
                              </span>
                              {isOverridden && (
                                <span className="text-xs bg-blue-600 text-white px-1.5 py-0.5 rounded">
                                  Zmienione
                                </span>
                              )}
                            </div>
                            
                            {isEditing ? (
                              <div className="flex items-center gap-2 mt-2">
                                <input
                                  type="number"
                                  step="0.5"
                                  value={overrideAmount}
                                  onChange={(e) => setOverrideAmount(parseFloat(e.target.value) || 0)}
                                  className="w-24 rounded border border-gray-300 px-2 py-1 text-sm"
                                  autoFocus
                                />
                                <span className="text-xs text-gray-600">
                                  {translateUnit(item.unit_type)}
                                </span>
                                <button
                                  onClick={() => saveOverride(meal.id, item.product_id, overrideAmount)}
                                  className="text-xs bg-green-600 text-white px-2 py-1 rounded hover:bg-green-500"
                                >
                                  Zapisz
                                </button>
                                <button
                                  onClick={() => setEditingOverride(null)}
                                  className="text-xs bg-gray-200 text-gray-700 px-2 py-1 rounded hover:bg-gray-300"
                                >
                                  Anuluj
                                </button>
                              </div>
                            ) : (
                              <div className="flex items-center gap-2 mt-1">
                                <span className="text-sm text-gray-600">
                                  {formatAmount(currentAmount)} {translateUnit(item.unit_type)}
                                </span>
                                {isOverridden && (
                                  <span className="text-xs text-gray-500 line-through">
                                    (bazowo: {formatAmount(item.amount)})
                                  </span>
                                )}
                                {item.product && (
                                  <span className="text-xs text-gray-500">
                                    • {Math.round(calculateNutrition(currentAmount, item.product.unit_weight_grams, item.product.kcal_per_unit))} kcal
                                  </span>
                                )}
                              </div>
                            )}
                          </div>

                          {!isEditing && (
                            <div className="flex gap-1">
                              <button
                                onClick={() =>
                                  startEditOverride(meal.id, item.product_id, currentAmount)
                                }
                                className="text-xs text-blue-600 hover:text-blue-700 px-2 py-1 rounded hover:bg-blue-50"
                              >
                                Personalizuj
                              </button>
                              {isOverridden && (
                                <button
                                  onClick={() => removeOverride(meal.id, item.product_id)}
                                  className="text-xs text-red-600 hover:text-red-700 px-2 py-1 rounded hover:bg-red-50"
                                >
                                  Reset
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* Stats */}
      {meals.length > 0 && (
        <div className="bg-gray-50 rounded-lg border border-gray-200 p-4 text-center text-sm text-gray-600">
          Wszystkich posiłków: <span className="font-semibold text-gray-900">{meals.length}</span>
          {userOverrides.length > 0 && (
            <>
              {' • '}
              Spersonalizowanych składników:{' '}
              <span className="font-semibold text-blue-600">{userOverrides.length}</span>
            </>
          )}
        </div>
      )}
    </div>
  )
}
