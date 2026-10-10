'use client'

import { useRef, useState } from 'react'
import type { MealCategory, Product } from '@/lib/supabase/client'
import type { ToastOptions } from '@/components/ui/Feedback'
import { calculateNutrition } from '@/lib/nutrition'
import { IMAGE_ACCEPTED_TYPES, IMAGE_MAX_INPUT_BYTES, compressImage } from '@/lib/image'
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
  // Edit mode: true while the base recipe and member variants are being fetched for the opened meal
  const [isLoadingItems, setIsLoadingItems] = useState(false)
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
    setIsLoadingItems(false)
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
    isLoadingItems, setIsLoadingItems,
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
  form.setSelectedProducts([])
  form.setMemberOverrides({})
  form.setIsLoadingItems(true)

  // Always fetch base meal_items from DB so the form always reflects the base recipe,
  // regardless of whether the current user has an override (meal.items may contain overrides).
  let baseMealItems: Awaited<ReturnType<typeof fetchBaseMealItems>>
  try {
    baseMealItems = await fetchBaseMealItems(meal.id)
  } catch (error) {
    if (!isStale()) form.setIsLoadingItems(false)
    throw error
  }
  if (isStale()) return

  form.setSelectedProducts(
    (baseMealItems || meal.items).map((item) => ({
      product_id: item.product_id,
      amount: item.amount,
    }))
  )

  // Load existing member overrides
  let overridesData: Awaited<ReturnType<typeof fetchMealItemOverrides>>
  try {
    overridesData = await fetchMealItemOverrides(meal.id)
  } catch (error) {
    if (!isStale()) form.setIsLoadingItems(false)
    throw error
  }
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
  form.setIsLoadingItems(false)
}

// Handle image file selection
export function handleImageChange(file: File | null, form: MealFormState, toast: Toast) {
  if (!file) {
    form.setImageFile(null)
    form.setImagePreview(null)
    return
  }

  // Validate file type
  if (!IMAGE_ACCEPTED_TYPES.includes(file.type)) {
    toast('Nieprawidłowy format pliku. Dozwolone: JPG, PNG, WebP, GIF', { type: 'error' })
    return
  }

  // Validate file size (5MB, checked on the selected file, before compression)
  if (file.size > IMAGE_MAX_INPUT_BYTES) {
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

  // Compress in the background (downscale + re-encode). Until it finishes the original
  // file is used, so submitting early still works. Swap only if the form still holds
  // this exact file (not removed, replaced or reset in the meantime).
  void compressImage(file).then((compressed) => {
    if (compressed === file) return
    form.setImageFile(current => (current === file ? compressed : current))
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
