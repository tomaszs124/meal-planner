import type { ShoppingListItem, Product, Profile, UserSettings, Meal, MealImage, Tag } from '@/lib/supabase/client'

export type HouseholdMember = {
  user_id: string
  profile?: Profile
  settings?: UserSettings
}

export type ShoppingListMeal = Meal & {
  images?: MealImage[]
  tags?: { tag_id: string; tags: Tag }[]
}

export type ShoppingListItemWithProduct = ShoppingListItem & {
  product?: Product
  meal?: ShoppingListMeal
}

export type GroupedItem = {
  key: string
  name: string
  product_id: string | null
  product?: Product
  totalAmount: number
  unit_type: string | null
  custom_amount_text: string | null
  itemIds: string[]
  allChecked: boolean
  anyChecked: boolean
}

/** Items generated from a single meal for a single household member (dish view). */
export type MealGroupData = {
  group_key: string
  meal_id: string
  source_user_id: string | null
  meal: ShoppingListMeal | undefined
  items: ShoppingListItemWithProduct[]
  allChecked: boolean
}

/** Meal shape expected by MealDetailsModal (tags flattened). */
export type ModalMeal = Meal & { images?: MealImage[]; tags?: Tag[] }

export type GroupBy = 'category' | 'product' | 'dish'
