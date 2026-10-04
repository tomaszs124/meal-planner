'use client'

import { useEffect, useRef, useState } from 'react'
import { supabase, Product, ProductCategoryRecord } from '@/lib/supabase/client'
import type { useFeedback } from '@/components/ui/Feedback'
import type { ProductsUpdater } from '@/hooks/productsCache'

type Feedback = ReturnType<typeof useFeedback>

type UseProductCategoriesOptions = {
  householdId: string | undefined
  userId: string | undefined
  /** Current products; used to block deleting a category that is still in use. */
  products: Product[]
  /** Write-through setter from useProducts; renames are applied to cached products. */
  setProducts: (updater: ProductsUpdater) => void
  toast: Feedback['toast']
  confirm: Feedback['confirm']
  /** Called after the categories are fetched for the household. */
  onLoaded?: (categories: ProductCategoryRecord[]) => void
  onAdded?: (name: string) => void
  onRenamed?: (previousName: string, name: string) => void
  onDeleted?: (name: string, remainingCategories: ProductCategoryRecord[]) => void
}

function sortByName(categories: ProductCategoryRecord[]) {
  return categories.sort((a, b) => a.name.localeCompare(b.name, 'pl'))
}

/** Product categories of a household with add / rename / delete (validated, with toasts). */
export function useProductCategories(options: UseProductCategoriesOptions) {
  const { householdId, userId, products, setProducts, toast, confirm } = options

  const [categories, setCategories] = useState<ProductCategoryRecord[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isAddingCategory, setIsAddingCategory] = useState(false)

  // Latest callbacks, so the fetch effect only depends on the household id.
  const onLoadedRef = useRef(options.onLoaded)
  useEffect(() => {
    onLoadedRef.current = options.onLoaded
  })

  // Fetch categories (products come from the shared useProducts cache)
  useEffect(() => {
    if (!householdId) return

    async function fetchData() {
      setIsLoading(true)

      const { data: categoriesData, error: categoriesError } = await supabase
        .from('product_categories')
        .select('*')
        .eq('household_id', householdId)
        .order('name', { ascending: true })

      if (!categoriesError && categoriesData) {
        setCategories(categoriesData)
        onLoadedRef.current?.(categoriesData)
      }

      setIsLoading(false)
    }

    fetchData()
  }, [householdId])

  /** Returns true when the category was created. */
  async function addCategory(name: string): Promise<boolean> {
    if (!householdId || !userId || !name.trim()) return false

    const normalizedName = name.trim()
    const isDuplicate = categories.some((category) => category.name.toLowerCase() === normalizedName.toLowerCase())
    if (isDuplicate) {
      toast('Kategoria o tej nazwie już istnieje', { type: 'error' })
      return false
    }

    setIsAddingCategory(true)

    const { data, error } = await supabase
      .from('product_categories')
      .insert({
        household_id: householdId,
        name: normalizedName,
        created_by: userId,
      })
      .select('*')
      .single()

    if (error || !data) {
      toast('Nie udało się dodać kategorii', { type: 'error' })
      setIsAddingCategory(false)
      return false
    }

    setCategories((current) => sortByName([...current, data as ProductCategoryRecord]))
    options.onAdded?.(normalizedName)
    setIsAddingCategory(false)
    return true
  }

  /** Renames the category and every product using it. Returns true on success. */
  async function renameCategory(category: ProductCategoryRecord, name: string): Promise<boolean> {
    const normalizedName = name.trim()
    if (!normalizedName) return false
    if (!householdId) return false

    const isDuplicate = categories.some(
      (currentCategory) =>
        currentCategory.id !== category.id && currentCategory.name.toLowerCase() === normalizedName.toLowerCase()
    )
    if (isDuplicate) {
      toast('Kategoria o tej nazwie już istnieje', { type: 'error' })
      return false
    }

    const previousName = category.name

    const { error: productsUpdateError } = await supabase
      .from('products')
      .update({ category: normalizedName })
      .eq('household_id', householdId)
      .eq('category', previousName)

    if (productsUpdateError) {
      toast('Nie udało się zaktualizować produktów dla tej kategorii', { type: 'error' })
      return false
    }

    const { error: categoryUpdateError } = await supabase
      .from('product_categories')
      .update({ name: normalizedName })
      .eq('id', category.id)

    if (categoryUpdateError) {
      toast('Nie udało się zaktualizować kategorii', { type: 'error' })
      return false
    }

    setCategories((current) =>
      sortByName(
        current.map((currentCategory) =>
          currentCategory.id === category.id ? { ...currentCategory, name: normalizedName } : currentCategory
        )
      )
    )

    setProducts((current) =>
      current.map((product) =>
        product.category === previousName ? { ...product, category: normalizedName } : product
      )
    )

    options.onRenamed?.(previousName, normalizedName)
    return true
  }

  /** Asks for confirmation; refuses when products still use the category. Returns true when deleted. */
  async function deleteCategory(category: ProductCategoryRecord): Promise<boolean> {
    if (!(await confirm({ message: `Usunąć kategorię "${category.name}"?`, danger: true, confirmLabel: 'Usuń' }))) return false

    const isUsedByProducts = products.some((product) => product.category === category.name)
    if (isUsedByProducts) {
      toast('Nie można usunąć kategorii, która jest przypisana do produktów', { type: 'error' })
      return false
    }

    const { error } = await supabase
      .from('product_categories')
      .delete()
      .eq('id', category.id)

    if (error) {
      toast('Nie udało się usunąć kategorii', { type: 'error' })
      return false
    }

    const remainingCategories = categories.filter((currentCategory) => currentCategory.id !== category.id)
    setCategories(remainingCategories)
    options.onDeleted?.(category.name, remainingCategories)
    return true
  }

  // Without a household there is nothing to load; report "not loading" so the page can show its empty state
  return { categories, isLoading: householdId ? isLoading : false, isAddingCategory, addCategory, renameCategory, deleteCategory }
}
