import { createBrowserClient } from '@supabase/ssr'

// Supabase configuration from environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!

// Create Supabase client for browser (uses cookies instead of localStorage)
export const supabase = createBrowserClient(supabaseUrl, supabaseKey)

// Export TypeScript types for database tables
export type Profile = {
  id: string
  display_name: string | null
  avatar_url: string | null
  created_at: string
  updated_at: string
}

export type Household = {
  id: string
  name: string
  created_by: string | null
  created_at: string
  updated_at: string
}

export type HouseholdUser = {
  id: string
  household_id: string
  user_id: string
  role: 'owner' | 'member'
  joined_at: string
}

export type ProductCategory = string

export type ProductCategoryRecord = {
  id: string
  household_id: string
  name: string
  created_by: string | null
  created_at: string
  updated_at: string
}

export type Product = {
  id: string
  household_id: string
  name: string
  kcal_per_unit: number  // Calories per 100g
  unit_type: '100g' | 'piece' | 'tablespoon' | 'teaspoon'  // Preferred unit
  unit_weight_grams: number | null  // Weight of one preferred unit in grams (e.g., 1 piece = 300g)
  category: ProductCategory
  image_url: string | null
  protein: number | null  // Protein per 100g
  fat: number | null  // Fat per 100g
  carbs: number | null  // Carbs per 100g
  created_by: string | null
  created_at: string
  updated_at: string
}

export type MealCategory = 'breakfast' | 'second_breakfast' | 'lunch' | 'dinner' | 'snack'

export type Meal = {
  id: string
  name: string
  user_id: string | null
  household_id: string
  is_shared: boolean
  description: string | null
  primary_category: MealCategory | null
  alternative_categories: MealCategory[]
  created_at: string
  updated_at: string
}

export type MealItem = {
  id: string
  meal_id: string
  product_id: string
  amount: number
  unit_type: string
  created_at: string
}

export type MealItemOverride = {
  id: string
  meal_id: string
  user_id: string
  product_id: string
  amount: number
  unit_type: string
  created_at: string
  updated_at: string
}

export type MealImage = {
  id: string
  meal_id: string
  image_url: string
  uploaded_by: string | null
  uploaded_at: string
}

export type MealPlan = {
  id: string
  created_at: string
  updated_at: string
  date: string
  meal_type: MealCategory
  is_consumed: boolean
  user_id: string
  household_id: string
  meal_id: string
}

export type ConsumedMeal = {
  id: string
  meal_plan_id: string | null
  user_id: string
  consumed_at: string
  note: string | null
  actual_calories: number | null
  created_at: string
}

export type ShoppingListItem = {
  id: string
  household_id: string
  product_id: string | null
  meal_id: string | null // Reference to meal this item comes from
  source_user_id: string | null // Household member this generated meal item belongs to
  name: string | null
  amount: number
  unit_type: string | null
  custom_amount_text: string | null // Free-form text for custom amounts like "garść", "opakowanie"
  is_checked: boolean
  added_by: string | null
  checked_by: string | null
  checked_at: string | null
  created_at: string
  updated_at: string
}

export type BodyMeasurement = {
  id: string
  user_id: string
  date: string
  weight: number | null
  waist: number | null
  hips: number | null
  thigh: number | null
  biceps: number | null
  note: string | null
  created_at: string
  updated_at: string
}

export type DailyNote = {
  id: string
  user_id: string
  date: string
  note: string | null
  mood: 'great' | 'good' | 'neutral' | 'bad' | 'terrible' | null
  created_at: string
  updated_at: string
}

export type BowelMovement = {
  id: string
  user_id: string
  date: string
  timestamp: string
  bristol_scale: number
  note: string | null
  created_at: string
}

export type UserSettings = {
  id: string
  user_id: string
  name: string | null
  snack_enabled: boolean
  second_breakfast_enabled?: boolean
  lunch_enabled?: boolean
  dinner_enabled?: boolean
  created_at: string
  updated_at: string
}

export type Tag = {
  id: string
  household_id: string
  name: string
  color: string
  text_color: string
  created_at: string
  updated_at: string
}

export type MealTag = {
  id: string
  meal_id: string
  tag_id: string
  created_at: string
}
