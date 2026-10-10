'use client'

import { useMemo, useState } from 'react'
import { supabase, Product } from '@/lib/supabase/client'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { useProducts } from '@/hooks/useProducts'
import { useFeedback } from '@/components/ui/Feedback'
import CategoryManager from './CategoryManager'
import ProductForm from './ProductForm'
import ProductList from './ProductList'
import { useProductCategories } from './useProductCategories'
import { emptyProductForm, getDefaultCategoryName, isProductFormValid, productToFormValues, toProductPayload } from './productFormHelpers'
import type { ProductFormValues } from './productFormHelpers'
import { ProductsSkeleton } from '@/components/ui/Skeleton'
import { PageHeader } from '@/components/Layout/PageShell'
import Button from '@/components/ui/Button'

export default function Products() {
  const { toast, confirm } = useFeedback()
  const { user, household, isLoading: userLoading } = useCurrentUser()
  const { products: productsByName, isLoading: productsLoading, setProducts, refresh: refreshProducts } = useProducts(household?.id)
  // This tab lists the newest products first (the shared cache is sorted by name).
  const products = useMemo(
    () => [...productsByName].sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at)),
    [productsByName]
  )

  // Add form state
  const [newForm, setNewForm] = useState<ProductFormValues>(() => emptyProductForm())
  const [isAdding, setIsAdding] = useState(false)
  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<ProductFormValues>(() => emptyProductForm())
  const [activeTooltipId, setActiveTooltipId] = useState<string | null>(null)
  // Filter state
  const [searchQuery, setSearchQuery] = useState('')
  // Category manager and the add form are tucked behind header buttons so the list comes first
  const [showCategories, setShowCategories] = useState(false)
  const [showAddForm, setShowAddForm] = useState(false)
  const [filterCategory, setFilterCategory] = useState<string>('')

  // Keep the category selected in the add/edit forms valid when categories change.
  const setFormCategory = (name: string) => (f: ProductFormValues) => ({ ...f, category: name })
  const { categories, isLoading, isAddingCategory, addCategory, renameCategory, deleteCategory } = useProductCategories({
    householdId: household?.id,
    userId: user?.id,
    products,
    setProducts,
    toast,
    confirm,
    onLoaded: (loaded) => {
      if (loaded.length === 0) return
      const fallback = getDefaultCategoryName(loaded)
      setNewForm((current) =>
        current.category && loaded.some((c) => c.name === current.category) ? current : { ...current, category: fallback }
      )
    },
    onAdded: (name) => setNewForm((current) => (current.category ? current : { ...current, category: name })),
    onRenamed: (previousName, name) => {
      if (newForm.category === previousName) setNewForm(setFormCategory(name))
      if (editForm.category === previousName) setEditForm(setFormCategory(name))
    },
    onDeleted: (name, remaining) => {
      if (newForm.category === name) setNewForm(setFormCategory(getDefaultCategoryName(remaining)))
      if (editForm.category === name) setEditForm(setFormCategory(getDefaultCategoryName(remaining)))
    },
  })

  // Add new product
  async function addProduct(e: React.FormEvent) {
    e.preventDefault()
    if (!household?.id || !user?.id) return
    if (!isProductFormValid(newForm)) {
      toast('Uzupełnij nazwę, kalorie (≥ 0), wagę jednostki (> 0) i kategorię', { type: 'error' })
      return
    }

    setIsAdding(true)

    const { data, error } = await supabase.from('products').insert({
      household_id: household.id,
      ...toProductPayload(newForm),
      created_by: user.id,
    }).select().single()

    if (!error && data) {
      // Add to list immediately (optimistic update)
      setProducts((current) => [data as Product, ...current])
      setNewForm(emptyProductForm(getDefaultCategoryName(categories)))
    }

    setIsAdding(false)
  }

  function startEdit(product: Product) {
    setEditingId(product.id)
    setEditForm(productToFormValues(product))
  }

  function cancelEdit() {
    setEditingId(null)
    setEditForm(emptyProductForm(getDefaultCategoryName(categories)))
  }

  async function saveEdit(productId: string) {
    if (!isProductFormValid(editForm)) {
      toast('Uzupełnij nazwę, kalorie (≥ 0), wagę jednostki (> 0) i kategorię', { type: 'error' })
      return
    }

    // Optimistic update - update list immediately
    const updatedProduct = toProductPayload(editForm)

    setProducts((current) => current.map((p) => (p.id === productId ? { ...p, ...updatedProduct } : p)))

    const { error } = await supabase
      .from('products')
      .update(updatedProduct)
      .eq('id', productId)

    if (!error) {
      setEditingId(null)
    } else {
      // Rollback on error - refetch from database
      await refreshProducts()
    }
  }

  async function deleteProduct(productId: string) {
    if (!(await confirm({ message: 'Czy na pewno chcesz usunąć ten produkt?', danger: true, confirmLabel: 'Usuń' }))) return

    // Optimistic update - remove from list immediately
    const previousProducts = [...products]
    setProducts((current) => current.filter((p) => p.id !== productId))

    const { error } = await supabase.from('products').delete().eq('id', productId)

    if (error) {
      toast('Nie udało się usunąć produktu', { type: 'error' })
      // Rollback on error
      setProducts(previousProducts)
    }
  }

  if (userLoading || isLoading || productsLoading) {
    return (
      <ProductsSkeleton />
    )
  }

  if (!household) {
    return (
      <div className="bg-yellow-50 dark:bg-yellow-950 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 text-sm text-yellow-800 dark:text-yellow-200">
        Musisz najpierw dołączyć do gospodarstwa.
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Produkty"
        subtitle="Zarządzaj bazą produktów spożywczych"
        actions={
          <>
            <Button onClick={() => setShowCategories((v) => !v)} aria-expanded={showCategories}>
              {showCategories ? 'Ukryj kategorie' : 'Kategorie'}
            </Button>
            <Button
              variant={showAddForm ? 'secondary' : 'primary'}
              onClick={() => setShowAddForm((v) => !v)}
              aria-expanded={showAddForm}
            >
              {showAddForm ? 'Ukryj formularz' : 'Dodaj produkt'}
            </Button>
          </>
        }
      />

      {showCategories && (
        <CategoryManager
          categories={categories}
          isAddingCategory={isAddingCategory}
          onAdd={addCategory}
          onRename={renameCategory}
          onDelete={deleteCategory}
        />
      )}

      {showAddForm && (
        <ProductForm
          mode="add"
          values={newForm}
          onChange={(patch) => setNewForm((current) => ({ ...current, ...patch }))}
          categories={categories}
          isSubmitting={isAdding}
          onSubmit={addProduct}
        />
      )}

      <ProductList
        products={products}
        categories={categories}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        filterCategory={filterCategory}
        onFilterCategoryChange={setFilterCategory}
        editingId={editingId}
        editValues={editForm}
        onEditChange={(patch) => setEditForm((current) => ({ ...current, ...patch }))}
        onStartEdit={startEdit}
        onSaveEdit={saveEdit}
        onCancelEdit={cancelEdit}
        onDelete={deleteProduct}
        activeTooltipId={activeTooltipId}
        onActiveTooltipChange={setActiveTooltipId}
      />

      {/* Stats */}
      {products.length > 0 && (
        <div className="bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 p-4 text-center text-sm text-gray-600 dark:text-gray-400">
          Wszystkich produktów: <span className="font-semibold text-gray-900 dark:text-gray-100">{products.length}</span>
        </div>
      )}
    </div>
  )
}
