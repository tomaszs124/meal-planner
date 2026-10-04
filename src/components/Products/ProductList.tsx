'use client'

import type { Product, ProductCategoryRecord } from '@/lib/supabase/client'
import ProductFilters from './ProductFilters'
import ProductRow from './ProductRow'
import type { ProductFormValues } from './productFormHelpers'

type ProductListProps = {
  products: Product[]
  categories: ProductCategoryRecord[]
  searchQuery: string
  onSearchChange: (value: string) => void
  filterCategory: string
  onFilterCategoryChange: (value: string) => void
  editingId: string | null
  editValues: ProductFormValues
  onEditChange: (patch: Partial<ProductFormValues>) => void
  onStartEdit: (product: Product) => void
  onSaveEdit: (productId: string) => void
  onCancelEdit: () => void
  onDelete: (productId: string) => void
  activeTooltipId: string | null
  onActiveTooltipChange: (productId: string | null) => void
}

/** Search/filter bar, empty states and the filtered rows (sorted by name). */
export default function ProductList({
  products,
  categories,
  searchQuery,
  onSearchChange,
  filterCategory,
  onFilterCategoryChange,
  editingId,
  editValues,
  onEditChange,
  onStartEdit,
  onSaveEdit,
  onCancelEdit,
  onDelete,
  activeTooltipId,
  onActiveTooltipChange,
}: ProductListProps) {
  const filtered = products
    .filter((p) => {
      const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase())
      const matchesCategory = !filterCategory || p.category === filterCategory
      return matchesSearch && matchesCategory
    })
    .sort((a, b) => a.name.localeCompare(b.name, 'pl'))

  let content: React.ReactNode
  if (products.length === 0) {
    content = (
      <div className="bg-gray-50 rounded-lg border border-gray-200 p-8 text-center">
        <p className="text-gray-500 text-sm">Brak produktów</p>
        <p className="text-gray-400 text-xs mt-1">Dodaj pierwszy produkt powyżej</p>
      </div>
    )
  } else if (filtered.length === 0) {
    content = (
      <div className="bg-gray-50 rounded-lg border border-gray-200 p-8 text-center">
        <p className="text-gray-500 text-sm">Brak wyników</p>
        <p className="text-gray-400 text-xs mt-1">Spróbuj zmienić kryteria wyszukiwania</p>
      </div>
    )
  } else {
    content = filtered.map((product) => (
      <ProductRow
        key={product.id}
        product={product}
        categories={categories}
        isEditing={editingId === product.id}
        editValues={editValues}
        onEditChange={onEditChange}
        onStartEdit={() => onStartEdit(product)}
        onSaveEdit={() => onSaveEdit(product.id)}
        onCancelEdit={onCancelEdit}
        onDelete={() => onDelete(product.id)}
        isNotesOpen={activeTooltipId === product.id}
        onToggleNotes={() => onActiveTooltipChange(activeTooltipId === product.id ? null : product.id)}
      />
    ))
  }

  return (
    <div className="space-y-3">
      {/* Search and filter */}
      <ProductFilters
        categories={categories}
        searchQuery={searchQuery}
        onSearchChange={onSearchChange}
        filterCategory={filterCategory}
        onFilterCategoryChange={onFilterCategoryChange}
      />

      {content}
    </div>
  )
}
