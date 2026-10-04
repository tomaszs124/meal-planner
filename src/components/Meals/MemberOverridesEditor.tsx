'use client'

import type { Product } from '@/lib/supabase/client'
import { calculateNutrition, formatAmount } from '@/lib/nutrition'
import { translateUnit } from './mealHelpers'
import {
  addProductToMemberOverride,
  removeProductFromMemberOverride,
  selectionTotals,
  toggleMemberOverride,
  updateMemberOverrideProduct,
} from './useMealForm'
import type { HouseholdMember, MemberOverrides, ProductSelection } from './types'

// "Wersje dla domowników" block of the meal form: per-member ingredient variants
export default function MemberOverridesEditor({
  products,
  householdMembers,
  currentUserId,
  baseProducts,
  overrides,
  setOverrides,
  isAdding,
  addButtonDisabled,
}: {
  products: Product[]
  householdMembers: HouseholdMember[]
  currentUserId: string | undefined
  baseProducts: ProductSelection[]
  overrides: MemberOverrides
  setOverrides: (overrides: MemberOverrides) => void
  // Both forms disable the variant inputs while a new meal is being added
  isAdding: boolean
  // "+ Dodaj produkt" of a variant: disabled while adding in the add form, never disabled in the edit form
  addButtonDisabled: boolean | undefined
}) {
  return (
    <div className="space-y-4 border-t border-gray-200 pt-4">
      <h3 className="text-sm font-semibold text-gray-900">Wersje dla domowników — zmienne tylko dla tej osoby</h3>
      <p className="text-xs text-gray-600">Możesz dostosować składniki dla każdego członka gospodarstwa indywidualnie. Zmiany tutaj nie wpłyną na bazowy przepis ani na wersje innych osób.</p>

      {householdMembers.filter((member) => member.user_id !== currentUserId).length === 0 ? (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-sm text-yellow-800">
          <p className="font-medium">Brak innych członków gospodarstwa</p>
          <p className="text-xs mt-1">Aby użyć tej funkcji, dodaj innych użytkowników do gospodarstwa.</p>
        </div>
      ) : baseProducts.length === 0 ? (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800">
          <p className="font-medium">Dodaj najpierw produkty</p>
          <p className="text-xs mt-1">Nadpisania składników będą dostępne po dodaniu produktów do posiłku.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {householdMembers.map((member) => {
            const hasOverride = !!overrides[member.user_id]
            const memberProducts = overrides[member.user_id] || []

            return (
              <div key={member.user_id} className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                <div className="flex items-center justify-between mb-3">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={hasOverride}
                      onChange={() => toggleMemberOverride(
                        member.user_id,
                        baseProducts,
                        overrides,
                        setOverrides
                      )}
                      disabled={isAdding}
                      className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                    />
                    <span className="text-sm font-medium text-gray-900">
                      {member.display_name} {member.user_id === currentUserId ? '(Ty)' : ''}
                    </span>
                  </label>
                </div>

                {hasOverride && (
                  <div className="space-y-2 pl-0 bg-indigo-50 border-l-4 border-indigo-500 rounded p-3 ml-0">
                    <div className="text-xs font-semibold text-indigo-700 mb-2">Wariant — tylko dla {member.display_name}</div>
                    {memberProducts.map((sp, index) => {
                      const product = products.find((p) => p.id === sp.product_id)
                      const kcal = product ? Math.round(calculateNutrition(sp.amount, product.unit_weight_grams, product.kcal_per_unit)) : 0
                      const totalWeight = product ? Math.round(sp.amount * (product.unit_weight_grams || 1)) : 0

                      return (
                        <div key={index} className="border border-indigo-300 rounded-lg p-2 bg-white">
                          <div className="flex gap-2 items-end">
                            <div className="flex-1">
                              <label className="block text-xs font-medium text-gray-600 mb-1">Produkt</label>
                              <select
                                value={sp.product_id}
                                onChange={(e) =>
                                  updateMemberOverrideProduct(
                                    member.user_id,
                                    index,
                                    'product_id',
                                    e.target.value,
                                    overrides,
                                    setOverrides
                                  )
                                }
                                disabled={isAdding}
                                className="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-black focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                              >
                                {products.map((p) => (
                                  <option key={p.id} value={p.id}>
                                    {p.name}
                                  </option>
                                ))}
                              </select>
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-gray-600 mb-1">Ilość</label>
                              <input
                                type="number"
                                step="0.5"
                                value={sp.amount}
                                onChange={(e) =>
                                  updateMemberOverrideProduct(
                                    member.user_id,
                                    index,
                                    'amount',
                                    e.target.value,
                                    overrides,
                                    setOverrides
                                  )
                                }
                                disabled={isAdding}
                                className="w-20 rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-black focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                              />
                            </div>
                            <span className="flex items-center text-sm text-gray-600 w-28 pb-1.5">
                              {product?.unit_type === '100g'
                                ? `${totalWeight}g`
                                : `${formatAmount(sp.amount)} ${translateUnit(product?.unit_type || '')} (${totalWeight}g)`
                              }
                            </span>
                            <span className="flex items-center text-sm text-gray-600 min-w-[60px] pb-1.5">
                              {kcal} kcal
                            </span>
                            <button
                              type="button"
                              onClick={() =>
                                removeProductFromMemberOverride(
                                  member.user_id,
                                  index,
                                  overrides,
                                  setOverrides
                                )
                              }
                              disabled={isAdding}
                              className="text-red-600 hover:text-red-700 px-2 pb-1.5"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </div>
                        </div>
                      )
                    })}

                    {memberProducts.length > 0 && (() => {
                      const totals = selectionTotals(memberProducts, products)

                      return (
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-2 mt-2">
                          <div className="flex flex-wrap gap-2 text-xs">
                            <span className="bg-blue-100 text-blue-800 px-2 py-0.5 rounded font-semibold">
                              {Math.round(totals.kcal)} kcal
                            </span>
                            {totals.protein > 0 && (
                              <span className="bg-green-100 text-green-800 px-2 py-0.5 rounded">
                                B: {totals.protein.toFixed(1)}g
                              </span>
                            )}
                            {totals.fat > 0 && (
                              <span className="bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded">
                                T: {totals.fat.toFixed(1)}g
                              </span>
                            )}
                            {totals.carbs > 0 && (
                              <span className="bg-purple-100 text-purple-800 px-2 py-0.5 rounded">
                                W: {totals.carbs.toFixed(1)}g
                              </span>
                            )}
                          </div>
                        </div>
                      )
                    })()}

                    <button
                      type="button"
                      onClick={() =>
                        addProductToMemberOverride(
                          products,
                          member.user_id,
                          overrides,
                          setOverrides
                        )
                      }
                      disabled={addButtonDisabled}
                      className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                    >
                      + Dodaj produkt
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
