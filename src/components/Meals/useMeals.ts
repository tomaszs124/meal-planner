'use client'

import { useEffect, useState } from 'react'
import { supabase, Product, Tag } from '@/lib/supabase/client'
import { useFeedback } from '@/components/ui/Feedback'
import { fetchMealsWithDetails } from '@/lib/meals-data'
import { extensionForType } from '@/lib/image'
import { mealTotals } from './mealHelpers'
import type {
  HouseholdMember,
  MealFormInput,
  MealItem,
  MealItemOverrideRecord,
  MealWithItems,
} from './types'

// Base recipe rows of a meal (used when opening the edit form)
export async function fetchBaseMealItems(mealId: string) {
  const { data } = await supabase
    .from('meal_items')
    .select('*')
    .eq('meal_id', mealId)
  return data
}

// All member overrides of a meal (used when opening the edit form)
export async function fetchMealItemOverrides(mealId: string) {
  const { data } = await supabase
    .from('meal_item_overrides')
    .select('*')
    .eq('meal_id', mealId)
  return data
}

/**
 * Meals page data: meals (batched loader), household tags (with realtime) and members,
 * plus add / update / delete mutations with optimistic updates of the local list.
 */
export function useMeals(householdId: string | undefined, userId: string | undefined, products: Product[]) {
  const { toast, confirm } = useFeedback()
  const [meals, setMeals] = useState<MealWithItems[]>([])
  const [tags, setTags] = useState<Tag[]>([])
  const [householdMembers, setHouseholdMembers] = useState<HouseholdMember[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isAdding, setIsAdding] = useState(false)
  const [isUploadingImage, setIsUploadingImage] = useState(false)

  // Fetch tags
  useEffect(() => {
    if (!householdId) return

    async function fetchTags() {
      const { data } = await supabase
        .from('tags')
        .select('*')
        .eq('household_id', householdId)
        .order('name')

      if (data) {
        setTags(data)
      }
    }

    fetchTags()

    // Realtime subscription for tags
    const channel = supabase
      .channel(`meals-tags-${householdId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tags',
          filter: `household_id=eq.${householdId}`,
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setTags((current) => [...current, payload.new as Tag].sort((a, b) => a.name.localeCompare(b.name)))
          } else if (payload.eventType === 'UPDATE') {
            const updated = payload.new as Tag
            setTags((current) =>
              current.map((t) => (t.id === updated.id ? updated : t))
            )
            // Keep tags attached to meals in sync (meals are not refetched on tag changes)
            setMeals((current) =>
              current.map((m) =>
                m.tags.some((t) => t.id === updated.id)
                  ? { ...m, tags: m.tags.map((t) => (t.id === updated.id ? updated : t)) }
                  : m
              )
            )
          } else if (payload.eventType === 'DELETE') {
            const deletedId = payload.old.id
            setTags((current) => current.filter((t) => t.id !== deletedId))
            setMeals((current) =>
              current.map((m) =>
                m.tags.some((t) => t.id === deletedId)
                  ? { ...m, tags: m.tags.filter((t) => t.id !== deletedId) }
                  : m
              )
            )
          }
        }
      )
      .subscribe()

    return () => {
      channel.unsubscribe()
    }
  }, [householdId])

  // Fetch household members
  useEffect(() => {
    if (!householdId) return

    async function fetchHouseholdMembers() {
      const { data: householdUsersData } = await supabase
        .from('household_users')
        .select('user_id')
        .eq('household_id', householdId)

      if (householdUsersData) {
        const userIds = householdUsersData.map((householdUser) => householdUser.user_id)

        const { data: profilesData } = await supabase
          .from('profiles')
          .select('id, display_name')
          .in('id', userIds)

        const { data: settingsData } = await supabase
          .from('user_settings')
          .select('user_id, name')
          .in('user_id', userIds)

        const profileById = new Map((profilesData || []).map((profile) => [profile.id, profile]))
        const settingsByUserId = new Map((settingsData || []).map((settings) => [settings.user_id, settings]))

        const members = householdUsersData.map((householdUser) => {
          const settingsName = settingsByUserId.get(householdUser.user_id)?.name?.trim()
          const profileName = profileById.get(householdUser.user_id)?.display_name?.trim()
          return {
            user_id: householdUser.user_id,
            display_name: settingsName || profileName || 'Użytkownik',
          }
        })

        setHouseholdMembers(members)
      }
    }

    fetchHouseholdMembers()
  }, [householdId])

  // Fetch meals (batched: a fixed number of queries per household, not per meal)
  useEffect(() => {
    if (!householdId || !userId) return

    let cancelled = false

    async function fetchMeals(householdId: string, userId: string) {
      setIsLoading(true)
      try {
        const mealsWithItems = await fetchMealsWithDetails(supabase, { householdId, userId })
        if (!cancelled) setMeals(mealsWithItems)
      } catch (error) {
        console.error('Failed to load meals:', error)
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }

    fetchMeals(householdId, userId)

    return () => {
      cancelled = true
    }
  }, [householdId, userId])

  // Upload image to Supabase Storage
  async function uploadImage(file: File, mealId: string): Promise<string | null> {
    if (!householdId || !userId) return null

    setIsUploadingImage(true)

    try {
      // Generate unique filename; the extension follows the actual content type
      // (the file may have been re-encoded, e.g. PNG -> JPEG, before upload)
      const fileExt = extensionForType(file.type) ?? file.name.split('.').pop()
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`
      const filePath = `${householdId}/${mealId}/${fileName}`

      // Upload to storage
      const { error: uploadError } = await supabase.storage
        .from('meal-images')
        .upload(filePath, file, {
          cacheControl: '3600',
          contentType: file.type || undefined,
          upsert: false
        })

      if (uploadError) {
        console.error('Upload error:', uploadError)
        toast('Błąd podczas przesyłania zdjęcia: ' + uploadError.message, { type: 'error' })
        return null
      }

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('meal-images')
        .getPublicUrl(filePath)

      return publicUrl
    } catch (error) {
      console.error('Upload error:', error)
      toast('Błąd podczas przesyłania zdjęcia', { type: 'error' })
      return null
    } finally {
      setIsUploadingImage(false)
    }
  }

  // Build MealItem rows (with joined product) for optimistic updates
  function toOptimisticItems(
    rows: { meal_id: string; product_id: string; amount: number; unit_type: string; user_id?: string }[]
  ): MealItem[] {
    return rows.map((row) => ({
      ...row,
      id: crypto.randomUUID(),
      product: products.find((p) => p.id === row.product_id),
    }))
  }

  // Base recipe rows (meal_items) from the form
  function buildMealItems(mealId: string, input: MealFormInput) {
    return input.selectedProducts.map((sp) => {
      const product = products.find((p) => p.id === sp.product_id)
      return {
        meal_id: mealId,
        product_id: sp.product_id,
        amount: sp.amount,
        unit_type: product?.unit_type || '100g',
      }
    })
  }

  // meal_item_overrides rows for every member variant in the form
  function buildOverrideRecords(mealId: string, input: MealFormInput): MealItemOverrideRecord[] {
    const overrideRecords: MealItemOverrideRecord[] = []
    Object.entries(input.memberOverrides).forEach(([memberId, userProducts]) => {
      userProducts.forEach((productSel) => {
        const product = products.find((p) => p.id === productSel.product_id)
        overrideRecords.push({
          meal_id: mealId,
          user_id: memberId,
          product_id: productSel.product_id,
          amount: productSel.amount,
          unit_type: product?.unit_type || '100g',
        })
      })
    })
    return overrideRecords
  }

  // Insert member overrides; resolves to true only when there were rows and they were saved
  async function insertOverrides(overrideRecords: MealItemOverrideRecord[]): Promise<boolean> {
    let overridesSaved = false
    if (overrideRecords.length > 0) {
      const { error: overrideInsertError } = await supabase
        .from('meal_item_overrides')
        .insert(overrideRecords)

      if (overrideInsertError) {
        toast('Nie udało się zapisać wariantów dla domowników: ' + overrideInsertError.message, { type: 'error' })
      } else {
        overridesSaved = true
      }
    }
    return overridesSaved
  }

  // Add new meal. `onCreated` runs right after the list update, only on success.
  async function addMeal(input: MealFormInput, onCreated: () => void) {
    if (!householdId || !userId || !input.name.trim() || input.selectedProducts.length === 0) return

    setIsAdding(true)

    // Create meal
    const { data: mealData, error: mealError } = await supabase
      .from('meals')
      .insert({
        name: input.name.trim(),
        description: input.description.trim() || null,
        user_id: userId,
        household_id: householdId,
        primary_category: input.primaryCategory || null,
        alternative_categories: input.alternativeCategories,
      })
      .select()
      .single()

    if (mealError || !mealData) {
      toast('Nie udało się utworzyć posiłku', { type: 'error' })
      setIsAdding(false)
      return
    }

    // Add image if file selected and store the result
    let uploadedImageUrl: string | null = null
    if (input.imageFile) {
      uploadedImageUrl = await uploadImage(input.imageFile, mealData.id)
      if (uploadedImageUrl) {
        await supabase.from('meal_images').insert({
          meal_id: mealData.id,
          image_url: uploadedImageUrl,
          uploaded_by: userId,
        })
      }
    }

    // Add meal tags
    if (input.tags.length > 0) {
      await supabase.from('meal_tags').insert(
        input.tags.map(tagId => ({
          meal_id: mealData.id,
          tag_id: tagId,
        }))
      )
    }

    // Add meal items
    const mealItems = buildMealItems(mealData.id, input)

    const { error: itemsError } = await supabase.from('meal_items').insert(mealItems)

    if (!itemsError) {
      // Save member overrides
      const overrideRecords = buildOverrideRecords(mealData.id, input)
      const overridesSaved = await insertOverrides(overrideRecords)

      // Refresh meals list (same shape as fetchMealsWithDetails: own variant wins over base recipe)
      const baseItems = toOptimisticItems(mealItems)
      const ownItems = overridesSaved ? toOptimisticItems(overrideRecords.filter((r) => r.user_id === userId)) : []
      const isUserVariant = ownItems.length > 0
      const items = isUserVariant ? ownItems : baseItems

      setMeals([
        {
          ...mealData,
          items,
          baseItems,
          isUserVariant,
          tags: input.tags.map(tagId => tags.find(t => t.id === tagId)).filter((t): t is Tag => t !== undefined),
          images: uploadedImageUrl ? [{
            id: crypto.randomUUID(),
            meal_id: mealData.id,
            image_url: uploadedImageUrl,
            uploaded_by: userId,
            uploaded_at: new Date().toISOString(),
          }] : [],
          ...mealTotals(items),
        },
        ...meals,
      ])

      onCreated()
    }

    setIsAdding(false)
  }

  // Save edit. `onSaved` runs after the optimistic update (closes the edit form).
  async function updateMeal(mealId: string, input: MealFormInput, onSaved: () => void) {
    if (!input.name.trim() || input.selectedProducts.length === 0 || !userId) return

    // Update meal name, description, and categories
    await supabase.from('meals').update({
      name: input.name.trim(),
      description: input.description.trim() || null,
      primary_category: input.primaryCategory || null,
      alternative_categories: input.alternativeCategories,
    }).eq('id', mealId)

    // Update meal tags
    await supabase.from('meal_tags').delete().eq('meal_id', mealId)
    if (input.tags.length > 0) {
      await supabase.from('meal_tags').insert(
        input.tags.map(tagId => ({
          meal_id: mealId,
          tag_id: tagId,
        }))
      )
    }

    // Add new image if file selected and store the result
    let uploadedImageUrl: string | null = null
    if (input.imageFile) {
      uploadedImageUrl = await uploadImage(input.imageFile, mealId)
      if (uploadedImageUrl) {
        await supabase.from('meal_images').insert({
          meal_id: mealId,
          image_url: uploadedImageUrl,
          uploaded_by: userId,
        })
      }
    }

    // Delete old meal items and insert new base items
    await supabase.from('meal_items').delete().eq('meal_id', mealId)

    const mealItems = buildMealItems(mealId, input)

    await supabase.from('meal_items').insert(mealItems)

    // Update member overrides - delete all existing and insert new ones
    await supabase.from('meal_item_overrides').delete().eq('meal_id', mealId)

    const overrideRecords = buildOverrideRecords(mealId, input)
    const overridesSaved = await insertOverrides(overrideRecords)

    // Optimistic update (same shape as fetchMealsWithDetails: own variant wins over base recipe)
    const baseItems = toOptimisticItems(mealItems)
    const ownItems = overridesSaved ? toOptimisticItems(overrideRecords.filter((r) => r.user_id === userId)) : []
    const isUserVariant = ownItems.length > 0
    const items = isUserVariant ? ownItems : baseItems

    setMeals((current) =>
      current.map((m) =>
        m.id === mealId
          ? {
              ...m,
              name: input.name.trim(),
              description: input.description.trim() || null,
              primary_category: input.primaryCategory || null,
              alternative_categories: input.alternativeCategories,
              items,
              baseItems,
              isUserVariant,
              tags: input.tags.map(tagId => tags.find(t => t.id === tagId)).filter((t): t is Tag => t !== undefined),
              // Newest first, same order as the loader (uploaded_at desc), so the card shows the new photo
              images: uploadedImageUrl
                ? [{
                    id: crypto.randomUUID(),
                    meal_id: mealId,
                    image_url: uploadedImageUrl,
                    uploaded_by: userId,
                    uploaded_at: new Date().toISOString(),
                  }, ...(m.images || [])]
                : m.images,
              ...mealTotals(items),
            }
          : m
      )
    )

    onSaved()
  }

  // Delete meal
  async function deleteMeal(mealId: string) {
    if (!userId) return

    if (!(await confirm({ message: 'Czy na pewno chcesz usunąć ten posiłek?', danger: true, confirmLabel: 'Usuń' }))) return

    // Optimistic update
    const previousMeals = [...meals]
    setMeals((current) => current.filter((m) => m.id !== mealId))

    const { data, error } = await supabase
      .from('meals')
      .delete()
      .eq('id', mealId)
      .select('id')

    if (error || !data || data.length === 0) {
      toast('Nie udało się usunąć posiłku', { type: 'error' })
      setMeals(previousMeals)
    }
  }

  return {
    meals,
    tags,
    householdMembers,
    isLoading,
    isAdding,
    isUploadingImage,
    addMeal,
    updateMeal,
    deleteMeal,
  }
}
