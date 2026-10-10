'use client'

import type { Product } from '@/lib/supabase/client'
import IngredientRows from './IngredientRows'
import type { ProductSelection } from './types'

// "Składniki" section of the meal form: the base recipe shared by the whole household
export default function ProductSelectionList({
  products,
  selectedProducts,
  setSelectedProducts,
  disabled,
  isLoading,
}: {
  products: Product[]
  selectedProducts: ProductSelection[]
  setSelectedProducts: (list: ProductSelection[]) => void
  disabled?: boolean
  isLoading?: boolean
}) {
  if (isLoading) {
    return (
      <ul className="space-y-2" aria-busy="true" aria-label="Ładowanie składników">
        {[0, 1, 2].map((i) => (
          <li key={i} className="h-12 animate-pulse rounded-lg bg-gray-100 dark:bg-gray-700" />
        ))}
      </ul>
    )
  }

  return (
    <IngredientRows
      products={products}
      rows={selectedProducts}
      onChange={setSelectedProducts}
      disabled={disabled}
      emptyText="Brak składników. Dodaj pierwszy, żeby policzyć kalorie."
    />
  )
}
