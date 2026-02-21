'use client'

import { useEffect, useState, useMemo } from 'react'
import Image from 'next/image'
import { supabase, Product, Meal, MealCategory, Tag, MealImage } from '@/lib/supabase/client'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import TagManagement from './TagManagement'
import MealDetailsModal from '../MealPlanner/MealDetailsModal'

// Funkcja tłumacząca jednostki na polski
function translateUnit(unitType: string): string {
  const units: { [key: string]: string } = {
    '100g': 'g',
    'piece': 'szt',
    'tablespoon': 'łyżka',
    'teaspoon': 'łyżeczka',
  }
  return units[unitType] || unitType
}

// Kategorie posiłków
const MEAL_CATEGORIES: { value: MealCategory; label: string }[] = [
  { value: 'breakfast', label: 'Śniadanie' },
  { value: 'second_breakfast', label: 'Drugie śniadanie' },
  { value: 'lunch', label: 'Obiad' },
  { value: 'dinner', label: 'Kolacja' },
  { value: 'snack', label: 'Przekąska' },
]

function translateCategory(category: MealCategory | null): string {
  if (!category) return ''
  return MEAL_CATEGORIES.find(c => c.value === category)?.label || category
}

// Helper function to calculate nutrition values based on weight
function calculateNutrition(amount: number, unitWeightGrams: number | null, valuePer100g: number): number {
  const weightGrams = amount * (unitWeightGrams || 1)
  return (weightGrams / 100) * valuePer100g
}

// Helper function to format amount without trailing zeros
function formatAmount(amount: number): string {
  return Number(amount.toFixed(2)).toString()
}

type MealItem = {
  id: string
  meal_id: string
  product_id: string
  amount: number
  unit_type: string
  product?: Product
}

type MealWithItems = Meal & {
  items: MealItem[]
  tags?: Tag[]
  images?: MealImage[]
  totalKcal: number
  totalProtein: number
  totalFat: number
  totalCarbs: number
}

type ProductSelection = {
  product_id: string
  amount: number
}

type HouseholdMember = {
  user_id: string
  display_name: string | null
}

type MemberOverrides = {
  [userId: string]: ProductSelection[]
}

type MealItemOverrideRecord = {
  meal_id: string
  user_id: string
  product_id: string
  amount: number
  unit_type: string
}

export default function Meals() {
  const { user, household, isLoading: userLoading } = useCurrentUser()
  const [meals, setMeals] = useState<MealWithItems[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [tags, setTags] = useState<Tag[]>([])
  const [householdMembers, setHouseholdMembers] = useState<HouseholdMember[]>([])
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [selectedCategories, setSelectedCategories] = useState<MealCategory[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [showTagManagement, setShowTagManagement] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [selectedMeal, setSelectedMeal] = useState<MealWithItems | null>(null)
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false)

  // Add form state
  const [newName, setNewName] = useState('')
  const [newDescription, setNewDescription] = useState('')
  const [newImageFile, setNewImageFile] = useState<File | null>(null)
  const [newImagePreview, setNewImagePreview] = useState<string | null>(null)
  const [selectedProducts, setSelectedProducts] = useState<ProductSelection[]>([])
  const [newMemberOverrides, setNewMemberOverrides] = useState<MemberOverrides>({})
  const [newTags, setNewTags] = useState<string[]>([])
  const [newPrimaryCategory, setNewPrimaryCategory] = useState<MealCategory | ''>('')
  const [newAlternativeCategories, setNewAlternativeCategories] = useState<MealCategory[]>([])
  const [isAdding, setIsAdding] = useState(false)
  const [isUploadingImage, setIsUploadingImage] = useState(false)
  const [showAddForm, setShowAddForm] = useState(false)

  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [editImageFile, setEditImageFile] = useState<File | null>(null)
  const [editImagePreview, setEditImagePreview] = useState<string | null>(null)
  const [editImageOriginalUrl, setEditImageOriginalUrl] = useState<string | null>(null)
  const [editProducts, setEditProducts] = useState<ProductSelection[]>([])
  const [editMemberOverrides, setEditMemberOverrides] = useState<MemberOverrides>({})
  const [editTags, setEditTags] = useState<string[]>([])
  const [editPrimaryCategory, setEditPrimaryCategory] = useState<MealCategory | ''>('')
  const [editAlternativeCategories, setEditAlternativeCategories] = useState<MealCategory[]>([])

  // Fetch tags
  useEffect(() => {
    const householdId = household?.id
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
          console.log('Tags realtime event in Meals:', payload.eventType, payload)
          if (payload.eventType === 'INSERT') {
            setTags((current) => [...current, payload.new as Tag].sort((a, b) => a.name.localeCompare(b.name)))
          } else if (payload.eventType === 'UPDATE') {
            setTags((current) =>
              current.map((t) => (t.id === payload.new.id ? (payload.new as Tag) : t))
            )
          } else if (payload.eventType === 'DELETE') {
            setTags((current) => current.filter((t) => t.id !== payload.old.id))
          }
        }
      )
      .subscribe()

    return () => {
      channel.unsubscribe()
    }
  }, [household?.id])

  // Fetch products
  useEffect(() => {
    const householdId = household?.id
    if (!householdId) return

    async function fetchProducts() {
      const { data } = await supabase
        .from('products')
        .select('*')
        .eq('household_id', householdId)
        .order('name')

      if (data) {
        setProducts(data)
      }
    }

    fetchProducts()
  }, [household?.id])

  // Fetch household members
  useEffect(() => {
    const householdId = household?.id
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
  }, [household?.id])

  // Fetch meals
  useEffect(() => {
    const householdId = household?.id
    const userId = user?.id
    if (!householdId || !userId) return

    async function fetchMeals() {
      setIsLoading(true)

      const { data: mealsData } = await supabase
        .from('meals')
        .select('*')
        .eq('household_id', householdId)
        .order('created_at', { ascending: false })

      if (mealsData) {
        // Fetch meal items for each meal
        const mealsWithItems = await Promise.all(
          mealsData.map(async (meal) => {
            // Check if user has overrides for this meal
            const { data: overridesData } = await supabase
              .from('meal_item_overrides')
              .select('*')
              .eq('meal_id', meal.id)
              .eq('user_id', userId)

            let itemsData
            if (overridesData && overridesData.length > 0) {
              // User has overrides - use them
              itemsData = overridesData
            } else {
              // No overrides - use default meal_items
              const { data } = await supabase
                .from('meal_items')
                .select('*')
                .eq('meal_id', meal.id)
              itemsData = data
            }

            const items = itemsData || []

            // Fetch meal tags
            const { data: mealTagsData } = await supabase
              .from('meal_tags')
              .select('tag_id')
              .eq('meal_id', meal.id)

            const mealTags = (mealTagsData || [])
              .map(mt => tags.find(t => t.id === mt.tag_id))
              .filter((t): t is Tag => t !== undefined)

            // Fetch meal images
            const { data: imagesData } = await supabase
              .from('meal_images')
              .select('*')
              .eq('meal_id', meal.id)
              .order('uploaded_at', { ascending: false })

            const mealImages = imagesData || []

            // Attach product data to each item
            const itemsWithProducts = items.map((item) => ({
              ...item,
              product: products.find((p) => p.id === item.product_id),
            }))

            // Calculate totals
            const totals = itemsWithProducts.reduce(
              (acc, item) => {
                if (item.product) {
                  acc.totalKcal += calculateNutrition(item.amount, item.product.unit_weight_grams, item.product.kcal_per_unit)
                  acc.totalProtein += calculateNutrition(item.amount, item.product.unit_weight_grams, item.product.protein || 0)
                  acc.totalFat += calculateNutrition(item.amount, item.product.unit_weight_grams, item.product.fat || 0)
                  acc.totalCarbs += calculateNutrition(item.amount, item.product.unit_weight_grams, item.product.carbs || 0)
                }
                return acc
              },
              { totalKcal: 0, totalProtein: 0, totalFat: 0, totalCarbs: 0 }
            )

            return {
              ...meal,
              items: itemsWithProducts,
              tags: mealTags,
              images: mealImages,
              ...totals,
            }
          })
        )

        setMeals(mealsWithItems)
      }

      setIsLoading(false)
    }

    if (products.length > 0 && tags.length >= 0) {
      fetchMeals()
    }
  }, [household?.id, user?.id, products, tags])

  // Filter meals by tags and search query
  const filteredMeals = useMemo(() => {
    let filtered = meals

    // Filter by search query
    if (searchQuery.trim()) {
      filtered = filtered.filter(meal =>
        meal.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        meal.description?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    }

    // Filter by selected tags
    if (selectedTags.length > 0) {
      filtered = filtered.filter(meal =>
        selectedTags.every(tagId =>
          meal.tags?.some(tag => tag.id === tagId)
        )
      )
    }

    // Filter by selected categories
    if (selectedCategories.length > 0) {
      filtered = filtered.filter(meal =>
        selectedCategories.some(cat =>
          meal.primary_category === cat || (meal.alternative_categories?.includes(cat) ?? false)
        )
      )
    }

    return filtered
  }, [meals, selectedTags, selectedCategories, searchQuery])

  // Toggle tag filter
  function toggleTagFilter(tagId: string) {
    setSelectedTags(current =>
      current.includes(tagId)
        ? current.filter(id => id !== tagId)
        : [...current, tagId]
    )
  }

  // Toggle category filter
  function toggleCategoryFilter(category: MealCategory) {
    setSelectedCategories(current =>
      current.includes(category)
        ? current.filter(cat => cat !== category)
        : [...current, category]
    )
  }

  // Add product to selection
  function addProductToSelection(list: ProductSelection[], setList: (list: ProductSelection[]) => void) {
    if (products.length === 0) return
    setList([...list, { product_id: products[0].id, amount: 1 }])
  }

  // Remove product from selection
  function removeProductFromSelection(index: number, list: ProductSelection[], setList: (list: ProductSelection[]) => void) {
    setList(list.filter((_, i) => i !== index))
  }

  // Update product selection
  function updateProductSelection(
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
  function addProductToMemberOverride(
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
  function removeProductFromMemberOverride(
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
  function updateMemberOverrideProduct(
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
  function toggleMemberOverride(
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

  // Handle image file selection
  function handleImageChange(file: File | null, isEdit: boolean = false) {
    if (!file) {
      if (isEdit) {
        setEditImageFile(null)
        setEditImagePreview(null)
      } else {
        setNewImageFile(null)
        setNewImagePreview(null)
      }
      return
    }

    // Validate file type
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif']
    if (!validTypes.includes(file.type)) {
      alert('Nieprawidłowy format pliku. Dozwolone: JPG, PNG, WebP, GIF')
      return
    }

    // Validate file size (5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert('Plik jest za duży. Maksymalny rozmiar: 5MB')
      return
    }

    // Set file and create preview
    if (isEdit) {
      setEditImageFile(file)
      const reader = new FileReader()
      reader.onloadend = () => {
        setEditImagePreview(reader.result as string)
      }
      reader.readAsDataURL(file)
    } else {
      setNewImageFile(file)
      const reader = new FileReader()
      reader.onloadend = () => {
        setNewImagePreview(reader.result as string)
      }
      reader.readAsDataURL(file)
    }
  }

  // Upload image to Supabase Storage
  async function uploadImage(file: File, mealId: string): Promise<string | null> {
    if (!household?.id || !user?.id) return null

    setIsUploadingImage(true)

    try {
      // Generate unique filename
      const fileExt = file.name.split('.').pop()
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`
      const filePath = `${household.id}/${mealId}/${fileName}`

      // Upload to storage
      const { error: uploadError } = await supabase.storage
        .from('meal-images')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false
        })

      if (uploadError) {
        console.error('Upload error:', uploadError)
        alert('Błąd podczas przesyłania zdjęcia: ' + uploadError.message)
        return null
      }

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('meal-images')
        .getPublicUrl(filePath)

      return publicUrl
    } catch (error) {
      console.error('Upload error:', error)
      alert('Błąd podczas przesyłania zdjęcia')
      return null
    } finally {
      setIsUploadingImage(false)
    }
  }

  // Add new meal
  async function addMeal(e: React.FormEvent) {
    e.preventDefault()
    if (!household?.id || !user?.id || !newName.trim() || selectedProducts.length === 0) return

    setIsAdding(true)

    // Create meal
    const { data: mealData, error: mealError } = await supabase
      .from('meals')
      .insert({
        name: newName.trim(),
        description: newDescription.trim() || null,
        user_id: user.id,
        household_id: household.id,
        primary_category: newPrimaryCategory || null,
        alternative_categories: newAlternativeCategories,
      })
      .select()
      .single()

    if (mealError || !mealData) {
      alert('Nie udało się utworzyć posiłku')
      setIsAdding(false)
      return
    }

    // Add image if file selected and store the result
    let uploadedImageUrl: string | null = null
    if (newImageFile) {
      uploadedImageUrl = await uploadImage(newImageFile, mealData.id)
      if (uploadedImageUrl) {
        await supabase.from('meal_images').insert({
          meal_id: mealData.id,
          image_url: uploadedImageUrl,
          uploaded_by: user.id,
        })
      }
    }

    // Add meal tags
    if (newTags.length > 0) {
      await supabase.from('meal_tags').insert(
        newTags.map(tagId => ({
          meal_id: mealData.id,
          tag_id: tagId,
        }))
      )
    }

    // Add meal items
    const mealItems = selectedProducts.map((sp) => {
      const product = products.find((p) => p.id === sp.product_id)
      return {
        meal_id: mealData.id,
        product_id: sp.product_id,
        amount: sp.amount,
        unit_type: product?.unit_type || '100g',
      }
    })

    const { error: itemsError } = await supabase.from('meal_items').insert(mealItems)

    if (!itemsError) {
      // Save member overrides
      const overrideRecords: MealItemOverrideRecord[] = []
      Object.entries(newMemberOverrides).forEach(([userId, userProducts]) => {
        userProducts.forEach((productSel) => {
          const product = products.find((p) => p.id === productSel.product_id)
          overrideRecords.push({
            meal_id: mealData.id,
            user_id: userId,
            product_id: productSel.product_id,
            amount: productSel.amount,
            unit_type: product?.unit_type || '100g',
          })
        })
      })

      if (overrideRecords.length > 0) {
        const { error: overrideInsertError } = await supabase
          .from('meal_item_overrides')
          .insert(overrideRecords)

        if (overrideInsertError) {
          alert('Nie udało się zapisać wariantów dla domowników: ' + overrideInsertError.message)
        }
      }

      // Refresh meals list
      const itemsWithProducts = mealItems.map((item) => ({
        ...item,
        id: crypto.randomUUID(),
        product: products.find((p) => p.id === item.product_id),
      }))

      const totals = itemsWithProducts.reduce(
        (acc, item) => {
          if (item.product) {
            acc.totalKcal += calculateNutrition(item.amount, item.product.unit_weight_grams, item.product.kcal_per_unit)
            acc.totalProtein += calculateNutrition(item.amount, item.product.unit_weight_grams, item.product.protein || 0)
            acc.totalFat += calculateNutrition(item.amount, item.product.unit_weight_grams, item.product.fat || 0)
            acc.totalCarbs += calculateNutrition(item.amount, item.product.unit_weight_grams, item.product.carbs || 0)
          }
          return acc
        },
        { totalKcal: 0, totalProtein: 0, totalFat: 0, totalCarbs: 0 }
      )

      setMeals([
        {
          ...mealData,
          items: itemsWithProducts as MealItem[],
          tags: newTags.map(tagId => tags.find(t => t.id === tagId)).filter((t): t is Tag => t !== undefined),
          images: uploadedImageUrl ? [{
            id: crypto.randomUUID(),
            meal_id: mealData.id,
            image_url: uploadedImageUrl,
            uploaded_by: user.id,
            uploaded_at: new Date().toISOString(),
          }] : [],
          ...totals,
        },
        ...meals,
      ])

      setNewName('')
      setNewDescription('')
      setNewImageFile(null)
      setNewImagePreview(null)
      setSelectedProducts([])
      setNewMemberOverrides({})
      setNewTags([])
      setNewPrimaryCategory('')
      setNewAlternativeCategories([])
      setShowAddForm(false)
    }

    setIsAdding(false)
  }

  // Start editing a meal
  async function startEdit(meal: MealWithItems) {
    setEditingId(meal.id)
    setEditName(meal.name)
    setEditDescription(meal.description || '')
    setEditImageFile(null)
    const originalImage = meal.images && meal.images.length > 0 ? meal.images[0].image_url : null
    setEditImageOriginalUrl(originalImage)
    setEditImagePreview(originalImage)
    setEditTags(meal.tags?.map(t => t.id) || [])
    setEditPrimaryCategory(meal.primary_category || '')
    setEditAlternativeCategories(meal.alternative_categories || [])
    setEditProducts(
      meal.items.map((item) => ({
        product_id: item.product_id,
        amount: item.amount,
      }))
    )

    // Load existing member overrides
    const { data: overridesData } = await supabase
      .from('meal_item_overrides')
      .select('*')
      .eq('meal_id', meal.id)

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
      setEditMemberOverrides(overridesByMember)
    } else {
      setEditMemberOverrides({})
    }
  }

  // Cancel editing
  function cancelEdit() {
    setEditingId(null)
    setEditName('')
    setEditDescription('')
    setEditImageFile(null)
    setEditImagePreview(null)
    setEditImageOriginalUrl(null)
    setEditProducts([])
    setEditMemberOverrides({})
    setEditTags([])
    setEditPrimaryCategory('')
    setEditAlternativeCategories([])
  }

  // Save edit
  async function saveEdit(mealId: string) {
    if (!editName.trim() || editProducts.length === 0 || !user?.id) return

    // Update meal name, description, and categories
    await supabase.from('meals').update({ 
      name: editName.trim(),
      description: editDescription.trim() || null,
      primary_category: editPrimaryCategory || null,
      alternative_categories: editAlternativeCategories,
    }).eq('id', mealId)

    // Update meal tags
    await supabase.from('meal_tags').delete().eq('meal_id', mealId)
    if (editTags.length > 0) {
      await supabase.from('meal_tags').insert(
        editTags.map(tagId => ({
          meal_id: mealId,
          tag_id: tagId,
        }))
      )
    }

    // Add new image if file selected and store the result
    let uploadedImageUrl: string | null = null
    if (editImageFile) {
      uploadedImageUrl = await uploadImage(editImageFile, mealId)
      if (uploadedImageUrl) {
        await supabase.from('meal_images').insert({
          meal_id: mealId,
          image_url: uploadedImageUrl,
          uploaded_by: user.id,
        })
      }
    }

    // Delete old meal items
    await supabase.from('meal_items').delete().eq('meal_id', mealId)

    // Add new meal items
    const mealItems = editProducts.map((sp) => {
      const product = products.find((p) => p.id === sp.product_id)
      return {
        meal_id: mealId,
        product_id: sp.product_id,
        amount: sp.amount,
        unit_type: product?.unit_type || '100g',
      }
    })

    await supabase.from('meal_items').insert(mealItems)

    // Update member overrides - delete all existing and insert new ones
    await supabase.from('meal_item_overrides').delete().eq('meal_id', mealId)

    const overrideRecords: MealItemOverrideRecord[] = []
    Object.entries(editMemberOverrides).forEach(([userId, userProducts]) => {
      userProducts.forEach((productSel) => {
        const product = products.find((p) => p.id === productSel.product_id)
        overrideRecords.push({
          meal_id: mealId,
          user_id: userId,
          product_id: productSel.product_id,
          amount: productSel.amount,
          unit_type: product?.unit_type || '100g',
        })
      })
    })

    if (overrideRecords.length > 0) {
      const { error: overrideInsertError } = await supabase
        .from('meal_item_overrides')
        .insert(overrideRecords)

      if (overrideInsertError) {
        alert('Nie udało się zapisać wariantów dla domowników: ' + overrideInsertError.message)
      }
    }

    // Optimistic update
    const itemsWithProducts = mealItems.map((item) => ({
      ...item,
      id: crypto.randomUUID(),
      product: products.find((p) => p.id === item.product_id),
    }))

    const totals = itemsWithProducts.reduce(
      (acc, item) => {
        if (item.product) {
          acc.totalKcal += calculateNutrition(item.amount, item.product.unit_weight_grams, item.product.kcal_per_unit)
          acc.totalProtein += calculateNutrition(item.amount, item.product.unit_weight_grams, item.product.protein || 0)
          acc.totalFat += calculateNutrition(item.amount, item.product.unit_weight_grams, item.product.fat || 0)
          acc.totalCarbs += calculateNutrition(item.amount, item.product.unit_weight_grams, item.product.carbs || 0)
        }
        return acc
      },
      { totalKcal: 0, totalProtein: 0, totalFat: 0, totalCarbs: 0 }
    )

    setMeals((current) =>
      current.map((m) =>
        m.id === mealId
          ? {
              ...m,
              name: editName.trim(),
              description: editDescription.trim() || null,
              primary_category: editPrimaryCategory || null,
              alternative_categories: editAlternativeCategories,
              items: itemsWithProducts as MealItem[],
              tags: editTags.map(tagId => tags.find(t => t.id === tagId)).filter((t): t is Tag => t !== undefined),
              images: uploadedImageUrl 
                ? [...(m.images || []), {
                    id: crypto.randomUUID(),
                    meal_id: mealId,
                    image_url: uploadedImageUrl,
                    uploaded_by: user.id,
                    uploaded_at: new Date().toISOString(),
                  }]
                : m.images,
              ...totals,
            }
          : m
      )
    )

    cancelEdit()
  }

  // Delete meal
  async function deleteMeal(mealId: string) {
    if (!user?.id) return

    if (!confirm('Czy na pewno chcesz usunąć ten posiłek?')) return

    // Optimistic update
    const previousMeals = [...meals]
    setMeals((current) => current.filter((m) => m.id !== mealId))

    const { data, error } = await supabase
      .from('meals')
      .delete()
      .eq('id', mealId)
      .select('id')

    if (error || !data || data.length === 0) {
      alert('Nie udało się usunąć posiłku')
      setMeals(previousMeals)
    }
  }

  if (userLoading || isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-gray-500">Ładowanie...</div>
      </div>
    )
  }

  if (!household) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-sm text-yellow-800">
        Musisz najpierw dołączyć do gospodarstwa.
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto p-4 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Posiłki</h2>
          <p className="text-sm text-gray-500 mt-1">Twórz przepisy z produktów</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowTagManagement(!showTagManagement)}
            className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-semibold text-white hover:bg-purple-500 transition-colors"
          >
            {showTagManagement ? 'Ukryj' : 'Zarządzaj tagami'}
          </button>
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 transition-colors"
          >
            {showAddForm ? 'Anuluj' : 'Dodaj posiłek'}
          </button>
        </div>
      </div>

      {/* Tag Management */}
      {showTagManagement && (
        <TagManagement />
      )}

      {/* Search and filter */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 space-y-3">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Wyszukaj posiłek..."
          className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm text-black focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        
        <div>
          <p className="text-sm font-medium text-gray-700 mb-2">Typ posiłku:</p>
          <div className="flex flex-wrap gap-2 mb-3">
            {MEAL_CATEGORIES.map(cat => (
              <button
                key={cat.value}
                onClick={() => toggleCategoryFilter(cat.value)}
                className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
                  selectedCategories.includes(cat.value)
                    ? 'bg-blue-600 text-white ring-2 ring-offset-2 ring-blue-500'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>

        {tags.length > 0 && (
          <div>
            <p className="text-sm font-medium text-gray-700 mb-2">Filtruj po tagach:</p>
            <div className="flex flex-wrap gap-2">
              {tags.map(tag => (
                <button
                  key={tag.id}
                  onClick={() => toggleTagFilter(tag.id)}
                  className={`px-3 py-1 rounded-full text-sm font-medium transition-all ${
                    selectedTags.includes(tag.id)
                      ? 'ring-2 ring-offset-2 ring-blue-500'
                      : 'opacity-60 hover:opacity-100'
                  }`}
                  style={{ 
                    backgroundColor: tag.color, 
                    color: tag.text_color 
                  }}
                >
                  {tag.name}
                </button>
              ))}
            </div>
            {selectedTags.length > 0 && (
              <button
                onClick={() => setSelectedTags([])}
                className="mt-2 text-sm text-blue-600 hover:text-blue-700 font-medium"
              >
                Wyczyść filtry tagów
              </button>
            )}
          </div>
        )}

        {(selectedTags.length > 0 || selectedCategories.length > 0) && (
          <button
            onClick={() => {
              setSelectedTags([])
              setSelectedCategories([])
            }}
            className="text-sm text-blue-600 hover:text-blue-700 font-medium"
          >
            Wyczyść wszystkie filtry
          </button>
        )}
      </div>

      {/* Add meal form */}
      {showAddForm && (
        <form onSubmit={addMeal} className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 space-y-4">
          <div>
            <label htmlFor="meal-name" className="block text-sm font-medium text-gray-700 mb-1">
              Nazwa posiłku
            </label>
            <input
              id="meal-name"
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Nazwa posiłku"
              disabled={isAdding}
              className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm text-black focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
              required
            />
          </div>

          <div>
            <label htmlFor="meal-description" className="block text-sm font-medium text-gray-700 mb-1">
              Opis / Przepis
            </label>
            <textarea
              id="meal-description"
              value={newDescription}
              onChange={(e) => setNewDescription(e.target.value)}
              placeholder="Przepis krok po kroku..."
              rows={4}
              disabled={isAdding}
              className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm text-black focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 resize-vertical"
            />
          </div>

          <div>
            <label htmlFor="meal-image" className="block text-sm font-medium text-gray-700 mb-1">
              Zdjęcie posiłku
            </label>
            <input
              id="meal-image"
              type="file"
              accept="image/jpeg,image/jpg,image/png,image/webp,image/gif"
              onChange={(e) => handleImageChange(e.target.files?.[0] || null, false)}
              disabled={isAdding || isUploadingImage}
              className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm text-black focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
            />
            <p className="text-xs text-gray-500 mt-1">Maksymalny rozmiar: 5MB. Formaty: JPG, PNG, WebP, GIF</p>
            {newImagePreview && (
              <div className="mt-2 relative">
                <Image
                  src={newImagePreview}
                  alt="Podgląd"
                  width={800}
                  height={320}
                  className="w-full h-48 object-cover rounded-lg border border-gray-200"
                />
                <button
                  type="button"
                  onClick={() => {
                    setNewImageFile(null)
                    setNewImagePreview(null)
                  }}
                  disabled={isAdding}
                  className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600 transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Tagi</label>
            {tags.length === 0 ? (
              <p className="text-sm text-gray-500">Brak dostępnych tagów. Dodaj nowe w sekcji zarządzania tagami poniżej.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {tags.map((tag) => (
                  <label
                    key={tag.id}
                    className={`px-3 py-1.5 rounded-full text-sm font-medium cursor-pointer transition-all ${
                      newTags.includes(tag.id)
                        ? 'ring-2 ring-offset-2 ring-blue-500'
                        : 'opacity-60 hover:opacity-100'
                    }`}
                    style={{ 
                      backgroundColor: tag.color, 
                      color: tag.text_color 
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={newTags.includes(tag.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setNewTags([...newTags, tag.id])
                        } else {
                          setNewTags(newTags.filter((id) => id !== tag.id))
                        }
                      }}
                      disabled={isAdding}
                      className="sr-only"
                    />
                    {tag.name}
                  </label>
                ))}
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Produkty — Bazowy przepis (wspólny dla wszystkich)</label>

            {selectedProducts.length === 0 ? (
              <p className="text-sm text-gray-500 mb-2">Kliknij przycisk poniżej aby dodać produkty</p>
            ) : (
              <div className="space-y-3 mb-2">
                {selectedProducts.map((sp, index) => {
                  const product = products.find((p) => p.id === sp.product_id)
                  const kcal = product ? Math.round(calculateNutrition(sp.amount, product.unit_weight_grams, product.kcal_per_unit)) : 0
                  const protein = product && product.protein ? calculateNutrition(sp.amount, product.unit_weight_grams, product.protein).toFixed(1) : null
                  const fat = product && product.fat ? calculateNutrition(sp.amount, product.unit_weight_grams, product.fat).toFixed(1) : null
                  const carbs = product && product.carbs ? calculateNutrition(sp.amount, product.unit_weight_grams, product.carbs).toFixed(1) : null
                  const totalWeight = product ? Math.round(sp.amount * (product.unit_weight_grams || 1)) : 0
                  
                  return (
                    <div key={index} className="border border-gray-200 rounded-lg p-3 bg-gray-50">
                      <div className="flex gap-2 items-end">
                        <div className="flex-1">
                          <label className="block text-xs font-medium text-gray-600 mb-1">Produkt</label>
                          <select
                            value={sp.product_id}
                            onChange={(e) =>
                              updateProductSelection(index, 'product_id', e.target.value, selectedProducts, setSelectedProducts)
                            }
                            className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm text-black focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                          >
                            {products.map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.name}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">Ilość</label>
                          <input
                            type="number"
                            step="0.5"
                            value={sp.amount}
                            onChange={(e) =>
                              updateProductSelection(index, 'amount', e.target.value, selectedProducts, setSelectedProducts)
                            }
                            className="w-24 rounded-lg border border-gray-300 px-4 py-2 text-sm text-black focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                          />
                        </div>
                        <span className="flex items-center text-sm text-gray-600 w-32 pb-2">
                          {product?.unit_type === '100g' 
                            ? `${totalWeight}g`
                            : `${formatAmount(sp.amount)} ${translateUnit(product?.unit_type || '')} (${totalWeight}g)`
                          }
                        </span>
                        <button
                          type="button"
                          onClick={() => removeProductFromSelection(index, selectedProducts, setSelectedProducts)}
                          className="text-red-600 hover:text-red-700 px-2 pb-2"
                        >
                          ✕
                        </button>
                      </div>
                      {product && (
                        <div className="flex gap-2 mt-2 text-xs">
                          <span className="bg-blue-100 text-blue-800 px-2 py-0.5 rounded">
                            {kcal} kcal
                          </span>
                          {protein && (
                            <span className="bg-green-100 text-green-800 px-2 py-0.5 rounded">
                              B: {protein}g
                            </span>
                          )}
                          {fat && (
                            <span className="bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded">
                              T: {fat}g
                            </span>
                          )}
                          {carbs && (
                            <span className="bg-purple-100 text-purple-800 px-2 py-0.5 rounded">
                              W: {carbs}g
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}

            {selectedProducts.length > 0 && (() => {
              const totals = selectedProducts.reduce((acc, sp) => {
                const product = products.find(p => p.id === sp.product_id)
                if (product) {
                  acc.kcal += calculateNutrition(sp.amount, product.unit_weight_grams, product.kcal_per_unit)
                  acc.protein += calculateNutrition(sp.amount, product.unit_weight_grams, product.protein || 0)
                  acc.fat += calculateNutrition(sp.amount, product.unit_weight_grams, product.fat || 0)
                  acc.carbs += calculateNutrition(sp.amount, product.unit_weight_grams, product.carbs || 0)
                }
                return acc
              }, { kcal: 0, protein: 0, fat: 0, carbs: 0 })

              return (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-2">
                  <div className="text-xs font-semibold text-gray-700 mb-2">Suma dla całego dania:</div>
                  <div className="flex flex-wrap gap-2 text-sm">
                    <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded font-semibold">
                      {Math.round(totals.kcal)} kcal
                    </span>
                    {totals.protein > 0 && (
                      <span className="bg-green-100 text-green-800 px-2 py-1 rounded">
                        B: {totals.protein.toFixed(1)}g
                      </span>
                    )}
                    {totals.fat > 0 && (
                      <span className="bg-yellow-100 text-yellow-800 px-2 py-1 rounded">
                        T: {totals.fat.toFixed(1)}g
                      </span>
                    )}
                    {totals.carbs > 0 && (
                      <span className="bg-purple-100 text-purple-800 px-2 py-1 rounded">
                        W: {totals.carbs.toFixed(1)}g
                      </span>
                    )}
                  </div>
                </div>
              )
            })()}

            <button
              type="button"
              onClick={() => addProductToSelection(selectedProducts, setSelectedProducts)}
              className="text-sm text-blue-600 hover:text-blue-700 font-medium"
            >
              + Dodaj produkt
            </button>
          </div>

          {/* Categories */}
          <div className="space-y-4 border-t border-gray-200 pt-4">
            <h3 className="text-sm font-semibold text-gray-900">Kategorie posiłku</h3>
            
            {/* Primary category */}
            <div>
              <label htmlFor="primary-category" className="block text-sm font-medium text-gray-700 mb-2">
                Kategoria główna
              </label>
              <select
                id="primary-category"
                value={newPrimaryCategory}
                onChange={(e) => setNewPrimaryCategory(e.target.value as MealCategory | '')}
                className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm text-black focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Brak kategorii</option>
                {MEAL_CATEGORIES.map((cat) => (
                  <option key={cat.value} value={cat.value}>
                    {cat.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Alternative categories */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Kategorie alternatywne
              </label>
              <div className="space-y-2">
                {MEAL_CATEGORIES.map((cat) => (
                  <label key={cat.value} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={newAlternativeCategories.includes(cat.value)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setNewAlternativeCategories([...newAlternativeCategories, cat.value])
                        } else {
                          setNewAlternativeCategories(newAlternativeCategories.filter(c => c !== cat.value))
                        }
                      }}
                      className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-700">{cat.label}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          {/* Member-specific overrides */}
          <div className="space-y-4 border-t border-gray-200 pt-4">
            <h3 className="text-sm font-semibold text-gray-900">Wersje dla domowników — zmienne tylko dla tej osoby</h3>
            <p className="text-xs text-gray-600">Możesz dostosować składniki dla każdego członka gospodarstwa indywidualnie. Zmiany tutaj nie wpłyną na bazowy przepis ani na wersje innych osób.</p>
            
            {householdMembers.filter((member) => member.user_id !== user?.id).length === 0 ? (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-sm text-yellow-800">
                <p className="font-medium">Brak innych członków gospodarstwa</p>
                <p className="text-xs mt-1">Aby użyć tej funkcji, dodaj innych użytkowników do gospodarstwa.</p>
              </div>
            ) : selectedProducts.length === 0 ? (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800">
                <p className="font-medium">Dodaj najpierw produkty</p>
                <p className="text-xs mt-1">Nadpisania składników będą dostępne po dodaniu produktów do posiłku.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {householdMembers.map((member) => {
                  const hasOverride = !!newMemberOverrides[member.user_id]
                  const memberProducts = newMemberOverrides[member.user_id] || []
                  
                  return (
                    <div key={member.user_id} className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                      <div className="flex items-center justify-between mb-3">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={hasOverride}
                            onChange={() => toggleMemberOverride(
                              member.user_id,
                              selectedProducts,
                              newMemberOverrides,
                              setNewMemberOverrides
                            )}
                            disabled={isAdding}
                            className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                          />
                          <span className="text-sm font-medium text-gray-900">
                            {member.display_name} {member.user_id === user?.id ? '(Ty)' : ''}
                          </span>
                        </label>
                      </div>

                      {hasOverride && (
                        <div className="space-y-2 pl-0 bg-indigo-50 border-l-4 border-indigo-500 rounded p-3 ml-0">
                          <div className="text-xs font-semibold text-indigo-700 mb-2">Wariant — tylko dla {member.display_name}</div>
                          {memberProducts.map((sp, index) => {
                            const product = products.find((p) => p.id === sp.product_id)
                            const kcal = product ? Math.round(calculateNutrition(sp.amount, product.unit_weight_grams, product.kcal_per_unit)) : 0
                            const totalWeight = product ? Math.round(sp.amount * (product.unit_weight_grams || 1)) : 0
                            
                            return (
                              <div key={index} className="border border-indigo-300 rounded-lg p-2 bg-white">
                                <div className="flex gap-2 items-end">
                                  <div className="flex-1">
                                    <label className="block text-xs font-medium text-gray-600 mb-1">Produkt</label>
                                    <select
                                      value={sp.product_id}
                                      onChange={(e) =>
                                        updateMemberOverrideProduct(
                                          member.user_id,
                                          index,
                                          'product_id',
                                          e.target.value,
                                          newMemberOverrides,
                                          setNewMemberOverrides
                                        )
                                      }
                                      disabled={isAdding}
                                      className="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-black focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                                    >
                                      {products.map((p) => (
                                        <option key={p.id} value={p.id}>
                                          {p.name}
                                        </option>
                                      ))}
                                    </select>
                                  </div>
                                  <div>
                                    <label className="block text-xs font-medium text-gray-600 mb-1">Ilość</label>
                                    <input
                                      type="number"
                                      step="0.5"
                                      value={sp.amount}
                                      onChange={(e) =>
                                        updateMemberOverrideProduct(
                                          member.user_id,
                                          index,
                                          'amount',
                                          e.target.value,
                                          newMemberOverrides,
                                          setNewMemberOverrides
                                        )
                                      }
                                      disabled={isAdding}
                                      className="w-20 rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-black focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                                    />
                                  </div>
                                  <span className="flex items-center text-sm text-gray-600 w-28 pb-1.5">
                                    {product?.unit_type === '100g'
                                      ? `${totalWeight}g`
                                      : `${formatAmount(sp.amount)} ${translateUnit(product?.unit_type || '')} (${totalWeight}g)`
                                    }
                                  </span>
                                  <span className="flex items-center text-sm text-gray-600 min-w-[60px] pb-1.5">
                                    {kcal} kcal
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      removeProductFromMemberOverride(
                                        member.user_id,
                                        index,
                                        newMemberOverrides,
                                        setNewMemberOverrides
                                      )
                                    }
                                    disabled={isAdding}
                                    className="text-red-600 hover:text-red-700 px-2 pb-1.5"
                                  >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                    </svg>
                                  </button>
                                </div>
                              </div>
                            )
                          })}

                          {memberProducts.length > 0 && (() => {
                            const totals = memberProducts.reduce((acc, sp) => {
                              const product = products.find(p => p.id === sp.product_id)
                              if (product) {
                                acc.kcal += calculateNutrition(sp.amount, product.unit_weight_grams, product.kcal_per_unit)
                                acc.protein += calculateNutrition(sp.amount, product.unit_weight_grams, product.protein || 0)
                                acc.fat += calculateNutrition(sp.amount, product.unit_weight_grams, product.fat || 0)
                                acc.carbs += calculateNutrition(sp.amount, product.unit_weight_grams, product.carbs || 0)
                              }
                              return acc
                            }, { kcal: 0, protein: 0, fat: 0, carbs: 0 })

                            return (
                              <div className="bg-blue-50 border border-blue-200 rounded-lg p-2 mt-2">
                                <div className="flex flex-wrap gap-2 text-xs">
                                  <span className="bg-blue-100 text-blue-800 px-2 py-0.5 rounded font-semibold">
                                    {Math.round(totals.kcal)} kcal
                                  </span>
                                  {totals.protein > 0 && (
                                    <span className="bg-green-100 text-green-800 px-2 py-0.5 rounded">
                                      B: {totals.protein.toFixed(1)}g
                                    </span>
                                  )}
                                  {totals.fat > 0 && (
                                    <span className="bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded">
                                      T: {totals.fat.toFixed(1)}g
                                    </span>
                                  )}
                                  {totals.carbs > 0 && (
                                    <span className="bg-purple-100 text-purple-800 px-2 py-0.5 rounded">
                                      W: {totals.carbs.toFixed(1)}g
                                    </span>
                                  )}
                                </div>
                              </div>
                            )
                          })()}

                          <button
                            type="button"
                            onClick={() =>
                              addProductToMemberOverride(
                                member.user_id,
                                newMemberOverrides,
                                setNewMemberOverrides
                              )
                            }
                            disabled={isAdding}
                            className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                          >
                            + Dodaj produkt
                          </button>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          <button
            type="submit"
            disabled={isAdding || !newName.trim() || selectedProducts.length === 0}
            className="w-full rounded-lg bg-blue-600 px-6 py-2 text-sm font-semibold text-white hover:bg-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
          >
            {isAdding ? 'Zapisywanie...' : 'Zapisz posiłek'}
          </button>
        </form>
      )}

      {/* Meals list - Grid view */}
      <div>
        {isLoading ? (
          <div className="bg-gray-50 rounded-lg border border-gray-200 p-8 text-center">
            <p className="text-gray-500 text-sm">Ładowanie...</p>
          </div>
        ) : meals.length === 0 ? (
          <div className="bg-gray-50 rounded-lg border border-gray-200 p-8 text-center">
            <p className="text-gray-500 text-sm">Brak posiłków</p>
            <p className="text-gray-400 text-xs mt-1">Dodaj pierwszy posiłek powyżej</p>
          </div>
        ) : filteredMeals.length === 0 ? (
          <div className="bg-gray-50 rounded-lg border border-gray-200 p-8 text-center">
            <p className="text-gray-500 text-sm">Brak posiłków pasujących do filtrów</p>
            <button
              onClick={() => {
                setSelectedTags([])
                setSearchQuery('')
              }}
              className="mt-2 text-sm text-blue-600 hover:text-blue-700 font-medium"
            >
              Wyczyść filtry
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredMeals.map((meal) => (
              <div 
                key={meal.id}
                onClick={() => {
                  setSelectedMeal(meal)
                  setIsDetailModalOpen(true)
                }}
                className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden cursor-pointer hover:shadow-lg hover:border-gray-300 transition-all duration-200 flex flex-col h-full"
              >
                {/* Image */}
                {meal.images && meal.images.length > 0 ? (
                  <Image
                    src={meal.images[0].image_url}
                    alt={meal.name}
                    width={512}
                    height={128}
                    className="w-full h-32 object-cover"
                  />
                ) : (
                  <div className="w-full h-32 bg-gray-100 flex items-center justify-center">
                    <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                )}
                
                {/* Content */}
                <div className="p-3 flex flex-col flex-grow">
                  {/* Name */}
                  <h3 className="font-semibold text-gray-900 mb-2 line-clamp-2">{meal.name}</h3>
                  
                  {/* Categories */}
                  {(meal.primary_category || (meal.alternative_categories && meal.alternative_categories.length > 0)) && (
                    <div className="flex flex-wrap gap-1 mb-2">
                      {meal.primary_category && (
                        <span className="bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded text-xs font-semibold">
                          {translateCategory(meal.primary_category)}
                        </span>
                      )}
                      {meal.alternative_categories && meal.alternative_categories.slice(0, 1).map((cat) => (
                        <span key={cat} className="bg-gray-100 text-gray-700 px-2 py-0.5 rounded text-xs">
                          {translateCategory(cat)}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Tags */}
                  {meal.tags && meal.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-2">
                      {meal.tags.slice(0, 2).map((tag) => (
                        <span
                          key={tag.id}
                          className="px-2 py-0.5 rounded-full text-xs font-medium"
                          style={{ 
                            backgroundColor: tag.color, 
                            color: tag.text_color 
                          }}
                        >
                          {tag.name}
                        </span>
                      ))}
                    </div>
                  )}
                  
                  {/* Nutrition */}
                  <div className="flex flex-wrap gap-1 mt-auto">
                    <span className="bg-blue-100 text-blue-800 px-2 py-0.5 rounded text-xs font-semibold">
                      {Math.round(meal.totalKcal)} kcal
                    </span>
                    {meal.totalProtein > 0 && (
                      <span className="bg-green-100 text-green-800 px-2 py-0.5 rounded text-xs">
                        B:{meal.totalProtein.toFixed(0)}g
                      </span>
                    )}
                    {meal.totalFat > 0 && (
                      <span className="bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded text-xs">
                        T:{meal.totalFat.toFixed(0)}g
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Detail Modal */}
      <MealDetailsModal
        isOpen={isDetailModalOpen}
        onClose={() => {
          setIsDetailModalOpen(false)
          setSelectedMeal(null)
        }}
        meal={selectedMeal ? {
          ...selectedMeal,
          items: selectedMeal.items.map(item => ({
            ...item,
            unit_type: item.unit_type
          }))
        } : null}
        userId={user?.id}
        householdId={household?.id}
      />

      {/* Modal Footer with Edit/Delete */}
      {isDetailModalOpen && selectedMeal && (
        <div className="fixed inset-0 z-[61] pointer-events-none flex items-end justify-center pb-8">
          <div 
            className="pointer-events-auto bg-white rounded-lg shadow-lg border border-gray-200 p-4 flex gap-2"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => {
                setIsDetailModalOpen(false)
                startEdit(selectedMeal)
              }}
              className="text-blue-600 hover:text-blue-700 text-sm font-medium px-4 py-2 bg-blue-50 rounded hover:bg-blue-100 transition-colors"
            >
              Edytuj
            </button>
            <button
              onClick={() => {
                setIsDetailModalOpen(false)
                deleteMeal(selectedMeal.id)
              }}
              className="text-red-600 hover:text-red-700 text-sm font-medium px-4 py-2 bg-red-50 rounded hover:bg-red-100 transition-colors"
            >
              Usuń
            </button>
          </div>
        </div>
      )}

      {/* Edit Modal - shown when editing */}
      {editingId && (
        <div className="fixed inset-0 bg-white/30 backdrop-blur-sm flex items-center justify-center z-[100] pt-8 pb-6">
          <div 
            className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between z-10">
              <h2 className="text-2xl font-bold text-gray-900">Edytuj posiłek</h2>
              <button
                onClick={cancelEdit}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Content */}
            <form onSubmit={(e) => { e.preventDefault(); saveEdit(editingId) }} className="p-6 space-y-4">
              <div>
                <label htmlFor="edit-meal-name" className="block text-sm font-medium text-gray-700 mb-1">
                  Nazwa posiłku
                </label>
                <input
                  id="edit-meal-name"
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm text-black focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label htmlFor="edit-meal-description" className="block text-sm font-medium text-gray-700 mb-1">
                  Opis / Przepis
                </label>
                <textarea
                  id="edit-meal-description"
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  placeholder="Przepis krok po kroku..."
                  rows={4}
                  className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm text-black focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-vertical"
                />
              </div>

              <div>
                <label htmlFor="edit-meal-image" className="block text-sm font-medium text-gray-700 mb-1">
                  Zdjęcie posiłku
                </label>
                <input
                  id="edit-meal-image"
                  type="file"
                  accept="image/jpeg,image/jpg,image/png,image/webp,image/gif"
                  onChange={(e) => handleImageChange(e.target.files?.[0] || null, true)}
                  disabled={isUploadingImage}
                  className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm text-black focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                />
                <p className="text-xs text-gray-500 mt-1">Jeśli nie wybierzesz nowego zdjęcia, pozostanie obecne.</p>
                {editImagePreview && (
                  <div className="mt-2 relative">
                    <Image
                      src={editImagePreview}
                      alt="Podgląd"
                      width={800}
                      height={320}
                      className="w-full h-48 object-cover rounded-lg border border-gray-200"
                    />
                    {editImageFile && (
                      <button
                        type="button"
                        onClick={() => {
                          setEditImageFile(null)
                          setEditImagePreview(editImageOriginalUrl)
                        }}
                        className="absolute top-2 right-2 bg-gray-800/80 text-white rounded-full p-1 hover:bg-gray-900 transition-colors"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    )}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Kategoria główna</label>
                <select
                  value={editPrimaryCategory}
                  onChange={(e) => setEditPrimaryCategory((e.target.value as MealCategory) || '')}
                  className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm text-black focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                >
                  <option value="">Wybierz kategorię...</option>
                  {MEAL_CATEGORIES.map((cat) => (
                    <option key={cat.value} value={cat.value}>
                      {cat.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Kategorie alternatywne</label>
                <div className="space-y-2">
                  {MEAL_CATEGORIES.map((cat) => (
                    <label key={cat.value} className="flex items-center">
                      <input
                        type="checkbox"
                        checked={editAlternativeCategories.includes(cat.value)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setEditAlternativeCategories([...editAlternativeCategories, cat.value])
                          } else {
                            setEditAlternativeCategories(editAlternativeCategories.filter((c) => c !== cat.value))
                          }
                        }}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 mr-2"
                      />
                      <span className="text-sm text-gray-700">{cat.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Tagi</label>
                {tags.length === 0 ? (
                  <p className="text-sm text-gray-500">Brak dostępnych tagów.</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {tags.map((tag) => (
                      <label
                        key={tag.id}
                        className={`px-3 py-1.5 rounded-full text-sm font-medium cursor-pointer transition-all ${
                          editTags.includes(tag.id)
                            ? 'ring-2 ring-offset-2 ring-blue-500'
                            : 'opacity-60 hover:opacity-100'
                        }`}
                        style={{ 
                          backgroundColor: tag.color, 
                          color: tag.text_color 
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={editTags.includes(tag.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setEditTags([...editTags, tag.id])
                            } else {
                              setEditTags(editTags.filter((id) => id !== tag.id))
                            }
                          }}
                          className="sr-only"
                        />
                        {tag.name}
                      </label>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Produkty — Bazowy przepis (wspólny dla wszystkich)</label>

                {editProducts.length === 0 ? (
                  <p className="text-sm text-gray-500 mb-2">Kliknij przycisk poniżej aby dodać produkty</p>
                ) : (
                  <div className="space-y-3 mb-2">
                    {editProducts.map((sp, index) => {
                      const product = products.find((p) => p.id === sp.product_id)
                      const kcal = product ? Math.round(calculateNutrition(sp.amount, product.unit_weight_grams, product.kcal_per_unit)) : 0
                      const protein = product && product.protein ? calculateNutrition(sp.amount, product.unit_weight_grams, product.protein).toFixed(1) : null
                      const fat = product && product.fat ? calculateNutrition(sp.amount, product.unit_weight_grams, product.fat).toFixed(1) : null
                      const carbs = product && product.carbs ? calculateNutrition(sp.amount, product.unit_weight_grams, product.carbs).toFixed(1) : null
                      const totalWeight = product ? Math.round(sp.amount * (product.unit_weight_grams || 1)) : 0
                      
                      return (
                        <div key={index} className="border border-gray-200 rounded-lg p-3 bg-gray-50">
                          <div className="flex gap-2 items-end">
                            <div className="flex-1">
                              <label className="block text-xs font-medium text-gray-600 mb-1">Produkt</label>
                              <select
                                value={sp.product_id}
                                onChange={(e) =>
                                  updateProductSelection(index, 'product_id', e.target.value, editProducts, setEditProducts)
                                }
                                className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm text-black focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                              >
                                {products.map((p) => (
                                  <option key={p.id} value={p.id}>
                                    {p.name}
                                  </option>
                                ))}
                              </select>
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-gray-600 mb-1">Ilość</label>
                              <input
                                type="number"
                                step="0.5"
                                value={sp.amount}
                                onChange={(e) =>
                                  updateProductSelection(index, 'amount', e.target.value, editProducts, setEditProducts)
                                }
                                className="w-24 rounded-lg border border-gray-300 px-4 py-2 text-sm text-black focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                              />
                            </div>
                            <span className="flex items-center text-sm text-gray-600 w-32 pb-2">
                              {product?.unit_type === '100g' 
                                ? `${totalWeight}g`
                                : `${formatAmount(sp.amount)} ${translateUnit(product?.unit_type || '')} (${totalWeight}g)`
                              }
                            </span>
                            <button
                              type="button"
                              onClick={() => removeProductFromSelection(index, editProducts, setEditProducts)}
                              className="text-red-600 hover:text-red-700 px-2 pb-2"
                            >
                              ✕
                            </button>
                          </div>
                          {product && (
                            <div className="flex gap-2 mt-2 text-xs">
                              <span className="bg-blue-100 text-blue-800 px-2 py-0.5 rounded">
                                {kcal} kcal
                              </span>
                              {protein && (
                                <span className="bg-green-100 text-green-800 px-2 py-0.5 rounded">
                                  B: {protein}g
                                </span>
                              )}
                              {fat && (
                                <span className="bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded">
                                  T: {fat}g
                                </span>
                              )}
                              {carbs && (
                                <span className="bg-purple-100 text-purple-800 px-2 py-0.5 rounded">
                                  W: {carbs}g
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}

                {editProducts.length > 0 && (() => {
                  const totals = editProducts.reduce((acc, sp) => {
                    const product = products.find(p => p.id === sp.product_id)
                    if (product) {
                      acc.kcal += calculateNutrition(sp.amount, product.unit_weight_grams, product.kcal_per_unit)
                      acc.protein += calculateNutrition(sp.amount, product.unit_weight_grams, product.protein || 0)
                      acc.fat += calculateNutrition(sp.amount, product.unit_weight_grams, product.fat || 0)
                      acc.carbs += calculateNutrition(sp.amount, product.unit_weight_grams, product.carbs || 0)
                    }
                    return acc
                  }, { kcal: 0, protein: 0, fat: 0, carbs: 0 })

                  return (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-2">
                      <div className="text-xs font-semibold text-gray-700 mb-2">Suma dla całego dania:</div>
                      <div className="flex flex-wrap gap-2 text-sm">
                        <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded font-semibold">
                          {Math.round(totals.kcal)} kcal
                        </span>
                        {totals.protein > 0 && (
                          <span className="bg-green-100 text-green-800 px-2 py-1 rounded">
                            B: {totals.protein.toFixed(1)}g
                          </span>
                        )}
                        {totals.fat > 0 && (
                          <span className="bg-yellow-100 text-yellow-800 px-2 py-1 rounded">
                            T: {totals.fat.toFixed(1)}g
                          </span>
                        )}
                        {totals.carbs > 0 && (
                          <span className="bg-purple-100 text-purple-800 px-2 py-1 rounded">
                            W: {totals.carbs.toFixed(1)}g
                          </span>
                        )}
                      </div>
                    </div>
                  )
                })()}

                <button
                  type="button"
                  onClick={() => addProductToSelection(editProducts, setEditProducts)}
                  className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                >
                  + Dodaj produkt
                </button>
              </div>

              <div className="space-y-4 border-t border-gray-200 pt-4">
                <h3 className="text-sm font-semibold text-gray-900">Wersje dla domowników — zmienne tylko dla tej osoby</h3>
                <p className="text-xs text-gray-600">Możesz dostosować składniki dla każdego członka gospodarstwa indywidualnie. Zmiany tutaj nie wpłyną na bazowy przepis ani na wersje innych osób.</p>
                
                {householdMembers.filter((member) => member.user_id !== user?.id).length === 0 ? (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-sm text-yellow-800">
                    <p className="font-medium">Brak innych członków gospodarstwa</p>
                    <p className="text-xs mt-1">Aby użyć tej funkcji, dodaj innych użytkowników do gospodarstwa.</p>
                  </div>
                ) : editProducts.length === 0 ? (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800">
                    <p className="font-medium">Dodaj najpierw produkty</p>
                    <p className="text-xs mt-1">Nadpisania składników będą dostępne po dodaniu produktów do posiłku.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {householdMembers.map((member) => {
                      const hasOverride = !!editMemberOverrides[member.user_id]
                      const memberProducts = editMemberOverrides[member.user_id] || []
                      
                      return (
                        <div key={member.user_id} className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                          <div className="flex items-center justify-between mb-3">
                            <label className="flex items-center gap-2 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={hasOverride}
                                onChange={() => toggleMemberOverride(
                                  member.user_id,
                                  editProducts,
                                  editMemberOverrides,
                                  setEditMemberOverrides
                                )}
                                disabled={isAdding}
                                className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                              />
                              <span className="text-sm font-medium text-gray-900">
                                {member.display_name} {member.user_id === user?.id ? '(Ty)' : ''}
                              </span>
                            </label>
                          </div>

                          {hasOverride && (
                            <div className="space-y-2 pl-0 bg-indigo-50 border-l-4 border-indigo-500 rounded p-3 ml-0">
                              <div className="text-xs font-semibold text-indigo-700 mb-2">Wariant — tylko dla {member.display_name}</div>
                              {memberProducts.map((sp, index) => {
                                const product = products.find((p) => p.id === sp.product_id)
                                const kcal = product ? Math.round(calculateNutrition(sp.amount, product.unit_weight_grams, product.kcal_per_unit)) : 0
                                const totalWeight = product ? Math.round(sp.amount * (product.unit_weight_grams || 1)) : 0
                                
                                return (
                                  <div key={index} className="border border-indigo-300 rounded-lg p-2 bg-white">
                                    <div className="flex gap-2 items-end">
                                      <div className="flex-1">
                                        <label className="block text-xs font-medium text-gray-600 mb-1">Produkt</label>
                                        <select
                                          value={sp.product_id}
                                          onChange={(e) =>
                                            updateMemberOverrideProduct(
                                              member.user_id,
                                              index,
                                              'product_id',
                                              e.target.value,
                                              editMemberOverrides,
                                              setEditMemberOverrides
                                            )
                                          }
                                          disabled={isAdding}
                                          className="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-black focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                                        >
                                          {products.map((p) => (
                                            <option key={p.id} value={p.id}>
                                              {p.name}
                                            </option>
                                          ))}
                                        </select>
                                      </div>
                                      <div>
                                        <label className="block text-xs font-medium text-gray-600 mb-1">Ilość</label>
                                        <input
                                          type="number"
                                          step="0.5"
                                          value={sp.amount}
                                          onChange={(e) =>
                                            updateMemberOverrideProduct(
                                              member.user_id,
                                              index,
                                              'amount',
                                              e.target.value,
                                              editMemberOverrides,
                                              setEditMemberOverrides
                                            )
                                          }
                                          disabled={isAdding}
                                          className="w-20 rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-black focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                                        />
                                      </div>
                                      <span className="flex items-center text-sm text-gray-600 w-28 pb-1.5">
                                        {product?.unit_type === '100g'
                                          ? `${totalWeight}g`
                                          : `${formatAmount(sp.amount)} ${translateUnit(product?.unit_type || '')} (${totalWeight}g)`
                                        }
                                      </span>
                                      <span className="flex items-center text-sm text-gray-600 min-w-[60px] pb-1.5">
                                        {kcal} kcal
                                      </span>
                                      <button
                                        type="button"
                                        onClick={() =>
                                          removeProductFromMemberOverride(
                                            member.user_id,
                                            index,
                                            editMemberOverrides,
                                            setEditMemberOverrides
                                          )
                                        }
                                        disabled={isAdding}
                                        className="text-red-600 hover:text-red-700 px-2 pb-1.5"
                                      >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                        </svg>
                                      </button>
                                    </div>
                                  </div>
                                )
                              })}

                              {memberProducts.length > 0 && (() => {
                                const totals = memberProducts.reduce((acc, sp) => {
                                  const product = products.find(p => p.id === sp.product_id)
                                  if (product) {
                                    acc.kcal += calculateNutrition(sp.amount, product.unit_weight_grams, product.kcal_per_unit)
                                    acc.protein += calculateNutrition(sp.amount, product.unit_weight_grams, product.protein || 0)
                                    acc.fat += calculateNutrition(sp.amount, product.unit_weight_grams, product.fat || 0)
                                    acc.carbs += calculateNutrition(sp.amount, product.unit_weight_grams, product.carbs || 0)
                                  }
                                  return acc
                                }, { kcal: 0, protein: 0, fat: 0, carbs: 0 })

                                return (
                                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-2 mt-2">
                                    <div className="flex flex-wrap gap-2 text-xs">
                                      <span className="bg-blue-100 text-blue-800 px-2 py-0.5 rounded font-semibold">
                                        {Math.round(totals.kcal)} kcal
                                      </span>
                                      {totals.protein > 0 && (
                                        <span className="bg-green-100 text-green-800 px-2 py-0.5 rounded">
                                          B: {totals.protein.toFixed(1)}g
                                        </span>
                                      )}
                                      {totals.fat > 0 && (
                                        <span className="bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded">
                                          T: {totals.fat.toFixed(1)}g
                                        </span>
                                      )}
                                      {totals.carbs > 0 && (
                                        <span className="bg-purple-100 text-purple-800 px-2 py-0.5 rounded">
                                          W: {totals.carbs.toFixed(1)}g
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                )
                              })()}

                              <button
                                type="button"
                                onClick={() =>
                                  addProductToMemberOverride(
                                    member.user_id,
                                    editMemberOverrides,
                                    setEditMemberOverrides
                                  )
                                }
                                className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                              >
                                + Dodaj produkt
                              </button>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

              <div className="flex gap-2 pt-4 border-t border-gray-200">
                <button
                  type="submit"
                  disabled={!editName.trim() || editProducts.length === 0}
                  className="flex-1 rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-500 focus:outline-none focus:ring-2 focus:ring-green-500 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                >
                  Zapisz posiłek
                </button>
                <button
                  type="button"
                  onClick={cancelEdit}
                  className="flex-1 rounded-lg bg-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-300 transition-colors"
                >
                  Anuluj
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Stats */}
      {meals.length > 0 && (
        <div className="bg-gray-50 rounded-lg border border-gray-200 p-4 text-center text-sm text-gray-600">
          Wszystkich posiłków: <span className="font-semibold text-gray-900">{meals.length}</span>
        </div>
      )}
    </div>
  )
}
