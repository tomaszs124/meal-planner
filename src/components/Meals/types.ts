import type { MealCategory } from '@/lib/supabase/client'
import type { MealItemWithProduct, MealWithDetails } from '@/lib/meals-data'

export type MealItem = MealItemWithProduct

// Same shape as returned by the batched loader (fetchMealsWithDetails)
export type MealWithItems = MealWithDetails

export type ProductSelection = {
  product_id: string
  amount: number
}

export type HouseholdMember = {
  user_id: string
  display_name: string | null
}

export type MemberOverrides = {
  [userId: string]: ProductSelection[]
}

export type MealItemOverrideRecord = {
  meal_id: string
  user_id: string
  product_id: string
  amount: number
  unit_type: string
}

/** Values of the add/edit form that the mutations in useMeals need */
export type MealFormInput = {
  name: string
  description: string
  imageFile: File | null
  selectedProducts: ProductSelection[]
  memberOverrides: MemberOverrides
  tags: string[]
  primaryCategory: MealCategory | ''
  alternativeCategories: MealCategory[]
}

export type MealFormMode = 'add' | 'edit'
