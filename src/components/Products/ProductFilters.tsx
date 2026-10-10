'use client'

import type { ProductCategoryRecord } from '@/lib/supabase/client'

type ProductFiltersProps = {
  categories: ProductCategoryRecord[]
  searchQuery: string
  onSearchChange: (value: string) => void
  filterCategory: string
  onFilterCategoryChange: (value: string) => void
}

/** Name search + category filter above the product list. */
export default function ProductFilters({
  categories,
  searchQuery,
  onSearchChange,
  filterCategory,
  onFilterCategoryChange,
}: ProductFiltersProps) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1">
          <label htmlFor="product-search" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Szukaj po nazwie</label>
          <input
            id="product-search"
            type="search"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Np. jajka, mleko..."
            className="w-full rounded-lg border border-gray-300 dark:border-gray-600 px-4 py-2 text-sm text-black dark:text-gray-100 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>
        <div className="sm:w-56">
          <label htmlFor="product-filter-category" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Kategoria</label>
          <select
            id="product-filter-category"
            value={filterCategory}
            onChange={(e) => onFilterCategoryChange(e.target.value)}
            className="w-full rounded-lg border border-gray-300 dark:border-gray-600 px-4 py-2 text-sm text-black dark:text-gray-100 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500"
          >
            <option value="">Wszystkie kategorie</option>
            {categories.map((category) => (
              <option key={category.id} value={category.name}>{category.name}</option>
            ))}
          </select>
        </div>
      </div>
    </div>
  )
}
