'use client'

import { useState } from 'react'
import type { ProductCategoryRecord } from '@/lib/supabase/client'

type CategoryManagerProps = {
  categories: ProductCategoryRecord[]
  isAddingCategory: boolean
  onAdd: (name: string) => Promise<boolean>
  onRename: (category: ProductCategoryRecord, name: string) => Promise<boolean>
  onDelete: (category: ProductCategoryRecord) => Promise<boolean>
}

/** Add / rename / delete block for product categories. */
export default function CategoryManager({
  categories,
  isAddingCategory,
  onAdd,
  onRename,
  onDelete,
}: CategoryManagerProps) {
  const [newCategoryName, setNewCategoryName] = useState('')
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null)
  const [editingCategoryName, setEditingCategoryName] = useState('')

  async function addCategory(e: React.FormEvent) {
    e.preventDefault()
    if (await onAdd(newCategoryName)) {
      setNewCategoryName('')
    }
  }

  function startCategoryEdit(category: ProductCategoryRecord) {
    setEditingCategoryId(category.id)
    setEditingCategoryName(category.name)
  }

  function cancelCategoryEdit() {
    setEditingCategoryId(null)
    setEditingCategoryName('')
  }

  async function saveCategoryEdit(category: ProductCategoryRecord) {
    if (await onRename(category, editingCategoryName)) {
      cancelCategoryEdit()
    }
  }

  async function deleteCategory(category: ProductCategoryRecord) {
    if ((await onDelete(category)) && editingCategoryId === category.id) {
      cancelCategoryEdit()
    }
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-gray-900">Kategorie produktów</h3>
        <p className="text-xs text-gray-500 mt-1">Nazwy kategorii, które przypisujesz produktom</p>
      </div>

      <form onSubmit={addCategory} className="flex flex-col sm:flex-row gap-3">
        <input
          type="text"
          value={newCategoryName}
          onChange={(e) => setNewCategoryName(e.target.value)}
          placeholder="Np. Przyprawy"
          aria-label="Nazwa nowej kategorii"
          disabled={isAddingCategory}
          className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-sm text-black focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
        />
        <button
          type="submit"
          disabled={isAddingCategory || !newCategoryName.trim()}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
        >
          {isAddingCategory ? 'Dodawanie...' : 'Dodaj kategorię'}
        </button>
      </form>

      {categories.length === 0 ? (
        <p className="text-sm text-gray-500">Brak kategorii. Dodaj pierwszą kategorię.</p>
      ) : (
        <div className="space-y-2">
          {categories.map((category) => (
            <div key={category.id} className="flex items-center gap-2">
              {editingCategoryId === category.id ? (
                <>
                  <input
                    type="text"
                    value={editingCategoryName}
                    onChange={(e) => setEditingCategoryName(e.target.value)}
                    aria-label="Nazwa kategorii"
                    className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-sm text-black focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <button
                    type="button"
                    onClick={() => saveCategoryEdit(category)}
                    className="rounded-lg bg-green-600 px-3 py-2 text-sm font-semibold text-white hover:bg-green-500 transition-colors"
                  >
                    Zapisz
                  </button>
                  <button
                    type="button"
                    onClick={cancelCategoryEdit}
                    className="rounded-lg bg-gray-200 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-300 transition-colors"
                  >
                    Anuluj
                  </button>
                </>
              ) : (
                <>
                  <span className="flex-1 text-sm text-gray-800">{category.name}</span>
                  <button
                    type="button"
                    onClick={() => startCategoryEdit(category)}
                    className="text-blue-600 hover:text-blue-700 text-sm font-medium px-3 py-1 rounded hover:bg-blue-50 transition-colors"
                  >
                    Edytuj
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteCategory(category)}
                    className="text-red-600 hover:text-red-700 text-sm font-medium px-3 py-1 rounded hover:bg-red-50 transition-colors"
                  >
                    Usuń
                  </button>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
