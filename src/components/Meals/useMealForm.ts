'use client'

import { useRef, useState } from 'react'
import type { MealCategory, Product } from '@/lib/supabase/client'
import type { ToastOptions } from '@/components/ui/Feedback'
import { calculateNutrition } from '@/lib/nutrition'
import { fetchBaseMealItems, fetchMealItemOverrides } from './useMeals'
import type { MealWithItems, MemberOverrides, ProductSelection } from './types'

/**
 * State of one meal form (used twice by Meals: the "add" form and the "edit" modal).
 * Lives in the parent so the add form keeps its values while hidden, as before.
 */
export function useMealFormState() {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  // Edit mode only: image the meal had when editing started (restored when the new file is removed)
  const [imageOriginalUrl, setImageOriginalUrl] = useState<string | null>(null)
  const [selectedProducts, setSelectedProducts] = useState<ProductSelection[]>([])
  const [memberOverrides, setMemberOverrides] = useState<MemberOverrides>({})
  const [tags, setTags] = useState<string[]>([])
  const [primaryCategory, setPrimaryCategory] = useState<MealCategory | ''>('')
  const [alternativeCategories, setAlternativeCategories] = useState<MealCategory[]>([])
  // Incremented by every loadMealIntoForm call so a slow response for meal A cannot
  // overwrite the form after the user already opened meal B (or cancelled).
  const loadSeq = useRef(0)

  function reset() {
    loadSeq.current += 1
    setName('')
    setDescription('')
    setImageFile(null)
    setImagePreview(null)
    setImageOriginalUrl(null)
    setSelectedProducts([])
    setMemberOverrides({})
    setTags([])
    setPrimaryCategory('')
    setAlternativeCategories([])
  }

  return {
    loadSeq,
    name, setName,
    description, setDescription,
    imageFile, setImageFile,
    imagePreview, setImagePreview,
    imageOriginalUrl, setImageOriginalUrl,
    selectedProducts, setSelectedProducts,
    memberOverrides, setMemberOverrides,
    tags, setTags,
    primaryCategory, setPrimaryCategory,
    alternativeCategories, setAlternativeCategories,
    reset,
  }
}

export type MealFormState = ReturnType<typeof useMealFormState>

type Toast = (message: string, options?: ToastOptions) => void

// Fill the edit form from a meal: plain fields first, then the base recipe and member overrides from the DB
export async function loadMealIntoForm(form: MealFormState, meal: MealWithItems) {
  const seq = ++form.loadSeq.current
  const isStale = () => form.loadSeq.current !== seq

  form.setName(meal.name)
  form.setDescription(meal.description || '')
  form.setImageFile(null)
  const originalImage = meal.images && meal.images.length > 0 ? meal.images[0].image_url : null
  form.setImageOriginalUrl(originalImage)
  form.setImagePreview(originalImage)
  form.setTags(meal.tags?.map(t => t.id) || [])
  form.setPrimaryCategory(meal.primary_category || '')
  form.setAlternativeCategories(meal.alternative_categories || [])

  // Always fetch base meal_items from DB so the form always reflects the base recipe,
  // regardless of whether the current user has an override (meal.items may contain overrides).
  const baseMealItems = await fetchBaseMealItems(meal.id)
  if (isStale()) return

  form.setSelectedProducts(
    (baseMealItems || meal.items).map((item) => ({
      product_id: item.product_id,
      amount: item.amount,
    }))
  )

  // Load existing member overrides
  const overridesData = await fetchMealItemOverrides(meal.id)
  if (isStale()) return

  if (overridesData) {
    const overridesByMember: MemberOverrides = {}
    overridesData.forEach((override) => {
      if (!overridesByMember[override.user_id]) {
        overridesByMember[override.user_id] = []
      }
      overridesByMember[override.user_id].push({
        product_id: override.product_id,
        amount: override.amount,
      })
    })
    form.setMemberOverrides(overridesByMember)
  } else {
    form.setMemberOverrides({})
  }
}

// Handle image file selection
export function handleImageChange(file: File | null, form: MealFormState, toast: Toast) {
  if (!file) {
    form.setImageFile(null)
    form.setImagePreview(null)
    return
  }

  // Validate file type
  const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif']
  if (!validTypes.includes(file.type)) {
    toast('Nieprawidłowy format pliku. Dozwolone: JPG, PNG, WebP, GIF', { type: 'error' })
    return
  }

  // Validate file size (5MB)
  if (file.size > 5 * 1024 * 1024) {
    toast('Plik jest za duży. Maksymalny rozmiar: 5MB', { type: 'error' })
    return
  }

  // Set file and create preview
  form.setImageFile(file)
  const reader = new FileReader()
  reader.onloadend = () => {
    form.setImagePreview(reader.result as string)
  }
  reader.readAsDataURL(file)
}

// Add product to selection
export function addProductToSelection(
  products: Product[],
  list: ProductSelection[],
  setList: (list: ProductSelection[]) => void
) {
  if (products.length === 0) return
  setList([...list, { product_id: products[0].id, amount: 1 }])
}

// Remove product from selection
export function removeProductFromSelection(index: number, list: ProductSelection[], setList: (list: ProductSelection[]) => void) {
  setList(list.filter((_, i) => i !== index))
}

// Update product selection
export function updateProductSelection(
  index: number,
  field: 'product_id' | 'amount',
  value: string | number,
  list: ProductSelection[],
  setList: (list: ProductSelection[]) => void
) {
  const updated = [...list]
  if (field === 'amount') {
    updated[index].amount = parseFloat(value as string) || 0
  } else {
    updated[index].product_id = value as string
  }
  setList(updated)
}

// Add product to member override
export function addProductToMemberOverride(
  products: Product[],
  userId: string,
  overrides: MemberOverrides,
  setOverrides: (overrides: MemberOverrides) => void
) {
  if (products.length === 0) return
  const current = overrides[userId] || []
  setOverrides({
    ...overrides,
    [userId]: [...current, { product_id: products[0].id, amount: 1 }],
  })
}

// Remove product from member override
export function removeProductFromMemberOverride(
  userId: string,
  index: number,
  overrides: MemberOverrides,
  setOverrides: (overrides: MemberOverrides) => void
) {
  const current = overrides[userId] || []
  setOverrides({
    ...overrides,
    [userId]: current.filter((_, i) => i !== index),
  })
}

// Update product in member override
export function updateMemberOverrideProduct(
  userId: string,
  index: number,
  field: 'product_id' | 'amount',
  value: string | number,
  overrides: MemberOverrides,
  setOverrides: (overrides: MemberOverrides) => void
) {
  const current = overrides[userId] || []
  const updated = [...current]
  if (field === 'amount') {
    updated[index].amount = parseFloat(value as string) || 0
  } else {
    updated[index].product_id = value as string
  }
  setOverrides({
    ...overrides,
    [userId]: updated,
  })
}

// Toggle member override (enable/disable)
export function toggleMemberOverride(
  userId: string,
  baseProducts: ProductSelection[],
  overrides: MemberOverrides,
  setOverrides: (overrides: MemberOverrides) => void
) {
  if (overrides[userId]) {
    // Disable override - remove it
    const updated = { ...overrides }
    delete updated[userId]
    setOverrides(updated)
  } else {
    // Enable override - copy from base
    setOverrides({
      ...overrides,
      [userId]: baseProducts.map(p => ({ ...p })),
    })
  }
}

// Nutrition totals of a product selection (form preview)
export function selectionTotals(selections: ProductSelection[], products: Product[]) {
  return selections.reduce((acc, sp) => {
    const product = products.find(p => p.id === sp.product_id)
    if (product) {
      acc.kcal += calculateNutrition(sp.amount, product.unit_weight_grams, product.kcal_per_unit)
      acc.protein += calculateNutrition(sp.amount, product.unit_weight_grams, product.protein || 0)
      acc.fat += calculateNutrition(sp.amount, product.unit_weight_grams, product.fat || 0)
      acc.carbs += calculateNutrition(sp.amount, product.unit_weight_grams, product.carbs || 0)
    }
    return acc
  }, { kcal: 0, protein: 0, fat: 0, carbs: 0 })
}
