'use client'

import { useState } from 'react'
import type { Product } from '@/lib/supabase/client'
import { calculateNutrition, formatAmount } from '@/lib/nutrition'
import { translateUnit } from './mealHelpers'
import { selectionTotals } from './useMealForm'
import {
  appendRow,
  formatAmountInput,
  parseAmount,
  removeRow,
  setRowAmount,
  setRowProduct,
} from './mealFormHelpers'
import ProductPicker from './ProductPicker'
import type { ProductSelection } from './types'

/**
 * Compact editable ingredient list shared by the base recipe and the member variants:
 * one row = product picker · amount · unit/weight · kcal · remove, then a totals line
 * and the "add ingredient" picker.
 */
export default function IngredientRows({
  products,
  rows,
  onChange,
  disabled,
  scope,
  tone = 'neutral',
  emptyText = 'Brak składników. Dodaj pierwszy poniżej.',
}: {
  products: Product[]
  rows: ProductSelection[]
  onChange: (rows: ProductSelection[]) => void
  disabled?: boolean
  /** Appended to accessible names so screen readers can tell variants apart */
  scope?: string
  tone?: 'neutral' | 'variant'
  emptyText?: string
}) {
  const suffix = scope ? ` (${scope})` : ''
  const totals = selectionTotals(rows, products)
  const rowBorder = tone === 'variant' ? 'border-indigo-200' : 'border-gray-200'

  return (
    <div className="space-y-2">
      {rows.length === 0 ? (
        <p className="text-sm text-gray-500">{emptyText}</p>
      ) : (
        <ul className="space-y-2">
          {rows.map((row, index) => {
            const product = products.find((p) => p.id === row.product_id)
            const kcal = product ? Math.round(calculateNutrition(row.amount, product.unit_weight_grams, product.kcal_per_unit)) : 0
            const grams = product ? Math.round(row.amount * (product.unit_weight_grams || 1)) : 0
            const name = product?.name ?? `produkt ${index + 1}`

            return (
              <li key={`${row.product_id}-${index}`} className={`rounded-lg border ${rowBorder} bg-white p-2`}>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="min-w-0 flex-1 basis-48">
                    <ProductPicker
                      products={products}
                      value={row.product_id}
                      onSelect={(next) => onChange(setRowProduct(rows, index, next, products))}
                      label={`Produkt ${index + 1}${suffix}`}
                      disabled={disabled}
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <AmountInput
                      value={row.amount}
                      onChange={(amount) => onChange(setRowAmount(rows, index, amount))}
                      label={`Ilość: ${name}${suffix}`}
                      disabled={disabled}
                    />
                    <span className="w-24 text-sm text-gray-600 tabular-nums" aria-live="polite">
                      {product?.unit_type === '100g'
                        ? `${grams} g`
                        : `${formatAmount(row.amount)} ${translateUnit(product?.unit_type || '')} · ${grams} g`}
                    </span>
                    <span className="w-16 text-right text-sm font-medium text-gray-900 tabular-nums">{kcal} kcal</span>
                    <button
                      type="button"
                      onClick={() => onChange(removeRow(rows, index))}
                      disabled={disabled}
                      aria-label={`Usuń ${name}${suffix}`}
                      className="rounded-md p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600 focus:outline-none focus:ring-2 focus:ring-red-500 disabled:opacity-50"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
        <ProductPicker
          products={products}
          value={null}
          onSelect={(product) => onChange(appendRow(rows, product))}
          label={`Dodaj składnik${suffix}`}
          disabled={disabled}
        />
        {rows.length > 0 && <NutritionSummary totals={totals} />}
      </div>
    </div>
  )
}

/** kcal + macro chips, used under every ingredient list */
export function NutritionSummary({
  totals,
  size = 'sm',
}: {
  totals: { kcal: number; protein: number; fat: number; carbs: number }
  size?: 'sm' | 'md'
}) {
  const chip = size === 'md' ? 'px-2.5 py-1 text-sm' : 'px-2 py-0.5 text-xs'
  return (
    <div className="flex flex-wrap items-center gap-1.5" aria-label="Wartości odżywcze">
      <span className={`rounded bg-blue-100 font-semibold text-blue-800 ${chip}`}>{Math.round(totals.kcal)} kcal</span>
      {totals.protein > 0 && <span className={`rounded bg-green-100 text-green-800 ${chip}`}>B: {totals.protein.toFixed(1)} g</span>}
      {totals.fat > 0 && <span className={`rounded bg-yellow-100 text-yellow-800 ${chip}`}>T: {totals.fat.toFixed(1)} g</span>}
      {totals.carbs > 0 && <span className={`rounded bg-purple-100 text-purple-800 ${chip}`}>W: {totals.carbs.toFixed(1)} g</span>}
    </div>
  )
}

/**
 * Text field for an amount. Keeps what the user is typing ("0," / "0.2") as text and
 * only pushes valid numbers up, so decimals and commas are not fought by a number input.
 */
function AmountInput({
  value,
  onChange,
  label,
  disabled,
}: {
  value: number
  onChange: (amount: number) => void
  label: string
  disabled?: boolean
}) {
  const [text, setText] = useState(() => formatAmountInput(value))
  // External change (e.g. product swapped and amount reset): resync during render unless the text already means this value
  const [seenValue, setSeenValue] = useState(value)
  if (value !== seenValue) {
    setSeenValue(value)
    if (parseAmount(text) !== value) setText(formatAmountInput(value))
  }

  return (
    <input
      type="text"
      inputMode="decimal"
      value={text}
      aria-label={label}
      disabled={disabled}
      onChange={(e) => {
        const next = e.target.value
        setText(next)
        const parsed = parseAmount(next)
        if (parsed !== null) onChange(parsed)
      }}
      onBlur={() => setText(formatAmountInput(value))}
      onFocus={(e) => e.target.select()}
      className="w-20 rounded-lg border border-gray-300 bg-white px-2.5 py-2 text-right text-sm text-gray-900 tabular-nums focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
    />
  )
}
