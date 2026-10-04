'use client'

import type { Product, ProductCategoryRecord } from '@/lib/supabase/client'
import ProductForm from './ProductForm'
import { unitLabel, type ProductFormValues } from './productFormHelpers'

type ProductRowProps = {
  product: Product
  categories: ProductCategoryRecord[]
  isEditing: boolean
  editValues: ProductFormValues
  onEditChange: (patch: Partial<ProductFormValues>) => void
  onStartEdit: () => void
  onSaveEdit: () => void
  onCancelEdit: () => void
  onDelete: () => void
  isNotesOpen: boolean
  onToggleNotes: () => void
}

/** One product card: summary view, or the inline edit form while editing. */
export default function ProductRow({
  product,
  categories,
  isEditing,
  editValues,
  onEditChange,
  onStartEdit,
  onSaveEdit,
  onCancelEdit,
  onDelete,
  isNotesOpen,
  onToggleNotes,
}: ProductRowProps) {
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
      {isEditing ? (
        // Edit mode
        <ProductForm
          mode="edit"
          values={editValues}
          onChange={onEditChange}
          categories={categories}
          onSave={onSaveEdit}
          onCancel={onCancelEdit}
        />
      ) : (
        // View mode
        <div className="flex items-center justify-between gap-4">
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold text-gray-900 truncate">
              {product.name}
            </h3>
            <div className="flex flex-wrap gap-2 mt-1 text-xs text-gray-600">
              <span className="bg-gray-100 px-2 py-0.5 rounded">
                {product.category}
              </span>
              <span>{product.kcal_per_unit} kcal</span>
              {product.protein && <span>• B: {product.protein}g</span>}
              {product.fat && <span>• T: {product.fat}g</span>}
              {product.carbs && <span>• W: {product.carbs}g</span>}
              <span>
                • {unitLabel(product.unit_type)}
                {product.unit_weight_grams && ` (${product.unit_weight_grams}g)`}
              </span>
            </div>
          </div>
          <div className="flex gap-2 flex-shrink-0 items-center">
            {product.notes && (
              <div className="relative">
                <button
                  type="button"
                  onClick={onToggleNotes}
                  className="w-6 h-6 flex items-center justify-center rounded-full bg-gray-200 text-gray-600 hover:bg-gray-300 transition-colors text-xs font-bold"
                  aria-label="Pokaż notatkę"
                >
                  i
                </button>
                {isNotesOpen && (
                  <div className="absolute right-0 bottom-full mb-2 w-64 bg-gray-900 text-white text-xs rounded-lg p-3 shadow-lg z-10">
                    {product.notes}
                    <div className="absolute right-2 top-full w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900" />
                  </div>
                )}
              </div>
            )}
            <button
              onClick={onStartEdit}
              className="text-blue-600 hover:text-blue-700 text-sm font-medium px-3 py-1 rounded hover:bg-blue-50 transition-colors"
            >
              Edytuj
            </button>
            <button
              onClick={onDelete}
              className="text-red-600 hover:text-red-700 text-sm font-medium px-3 py-1 rounded hover:bg-red-50 transition-colors"
            >
              Usuń
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
