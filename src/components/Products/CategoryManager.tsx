'use client'

import { useState } from 'react'
import type { ProductCategoryRecord } from '@/lib/supabase/client'
import Button from '@/components/ui/Button'

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
        <Button type="submit" disabled={isAddingCategory || !newCategoryName.trim()}>
          {isAddingCategory ? 'Dodawanie...' : 'Dodaj kategorię'}
        </Button>
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
                  <Button variant="primary" size="sm" onClick={() => saveCategoryEdit(category)}>
                    Zapisz
                  </Button>
                  <Button size="sm" onClick={cancelCategoryEdit}>
                    Anuluj
                  </Button>
                </>
              ) : (
                <>
                  <span className="flex-1 text-sm text-gray-800">{category.name}</span>
                  <Button variant="ghost" size="sm" onClick={() => startCategoryEdit(category)} aria-label={`Edytuj kategorię ${category.name}`}>
                    Edytuj
                  </Button>
                  <Button variant="danger" size="sm" onClick={() => deleteCategory(category)} aria-label={`Usuń kategorię ${category.name}`}>
                    Usuń
                  </Button>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
