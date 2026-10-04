'use client'

import type { Product } from '@/lib/supabase/client'
import { calculateNutrition, formatAmount } from '@/lib/nutrition'
import { translateUnit } from './mealHelpers'
import {
  addProductToSelection,
  removeProductFromSelection,
  selectionTotals,
  updateProductSelection,
} from './useMealForm'
import type { ProductSelection } from './types'

// "Produkty — Bazowy przepis" block of the meal form: ingredient rows with per-row kcal/macros and the dish total
export default function ProductSelectionList({
  products,
  selectedProducts,
  setSelectedProducts,
}: {
  products: Product[]
  selectedProducts: ProductSelection[]
  setSelectedProducts: (list: ProductSelection[]) => void
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">Produkty — Bazowy przepis (wspólny dla wszystkich)</label>

      {selectedProducts.length === 0 ? (
        <p className="text-sm text-gray-500 mb-2">Kliknij przycisk poniżej aby dodać produkty</p>
      ) : (
        <div className="space-y-3 mb-2">
          {selectedProducts.map((sp, index) => {
            const product = products.find((p) => p.id === sp.product_id)
            const kcal = product ? Math.round(calculateNutrition(sp.amount, product.unit_weight_grams, product.kcal_per_unit)) : 0
            const protein = product && product.protein ? calculateNutrition(sp.amount, product.unit_weight_grams, product.protein).toFixed(1) : null
            const fat = product && product.fat ? calculateNutrition(sp.amount, product.unit_weight_grams, product.fat).toFixed(1) : null
            const carbs = product && product.carbs ? calculateNutrition(sp.amount, product.unit_weight_grams, product.carbs).toFixed(1) : null
            const totalWeight = product ? Math.round(sp.amount * (product.unit_weight_grams || 1)) : 0

            return (
              <div key={index} className="border border-gray-200 rounded-lg p-3 bg-gray-50">
                <div className="flex gap-2 items-end">
                  <div className="flex-1">
                    <label className="block text-xs font-medium text-gray-600 mb-1">Produkt</label>
                    <select
                      value={sp.product_id}
                      aria-label={`Produkt ${index + 1}`}
                      onChange={(e) =>
                        updateProductSelection(index, 'product_id', e.target.value, selectedProducts, setSelectedProducts)
                      }
                      className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm text-black focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
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
                      inputMode="decimal"
                      step="0.5"
                      value={sp.amount}
                      aria-label={`Ilość: ${product?.name ?? `produkt ${index + 1}`}`}
                      onChange={(e) =>
                        updateProductSelection(index, 'amount', e.target.value, selectedProducts, setSelectedProducts)
                      }
                      className="w-24 rounded-lg border border-gray-300 px-4 py-2 text-sm text-black focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                    />
                  </div>
                  <span className="flex items-center text-sm text-gray-600 w-32 pb-2">
                    {product?.unit_type === '100g'
                      ? `${totalWeight}g`
                      : `${formatAmount(sp.amount)} ${translateUnit(product?.unit_type || '')} (${totalWeight}g)`
                    }
                  </span>
                  <button
                    type="button"
                    onClick={() => removeProductFromSelection(index, selectedProducts, setSelectedProducts)}
                    aria-label={`Usuń ${product?.name ?? `produkt ${index + 1}`}`}
                    className="text-red-600 hover:text-red-700 px-2 pb-2"
                  >
                    ✕
                  </button>
                </div>
                {product && (
                  <div className="flex gap-2 mt-2 text-xs">
                    <span className="bg-blue-100 text-blue-800 px-2 py-0.5 rounded">
                      {kcal} kcal
                    </span>
                    {protein && (
                      <span className="bg-green-100 text-green-800 px-2 py-0.5 rounded">
                        B: {protein}g
                      </span>
                    )}
                    {fat && (
                      <span className="bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded">
                        T: {fat}g
                      </span>
                    )}
                    {carbs && (
                      <span className="bg-purple-100 text-purple-800 px-2 py-0.5 rounded">
                        W: {carbs}g
                      </span>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {selectedProducts.length > 0 && (() => {
        const totals = selectionTotals(selectedProducts, products)

        return (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-2">
            <div className="text-xs font-semibold text-gray-700 mb-2">Suma dla całego dania:</div>
            <div className="flex flex-wrap gap-2 text-sm">
              <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded font-semibold">
                {Math.round(totals.kcal)} kcal
              </span>
              {totals.protein > 0 && (
                <span className="bg-green-100 text-green-800 px-2 py-1 rounded">
                  B: {totals.protein.toFixed(1)}g
                </span>
              )}
              {totals.fat > 0 && (
                <span className="bg-yellow-100 text-yellow-800 px-2 py-1 rounded">
                  T: {totals.fat.toFixed(1)}g
                </span>
              )}
              {totals.carbs > 0 && (
                <span className="bg-purple-100 text-purple-800 px-2 py-1 rounded">
                  W: {totals.carbs.toFixed(1)}g
                </span>
              )}
            </div>
          </div>
        )
      })()}

      <button
        type="button"
        onClick={() => addProductToSelection(products, selectedProducts, setSelectedProducts)}
        className="text-sm text-blue-600 hover:text-blue-700 font-medium"
      >
        + Dodaj produkt
      </button>
    </div>
  )
}
