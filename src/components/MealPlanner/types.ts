import type { MealCategory } from '@/lib/supabase/client'
import type { MealWithDetails } from '@/lib/meals-data'

export type PlannedMeal = {
  id: string
  meal_type: MealCategory
  meal_id: string
  is_consumed: boolean
  is_skipped: boolean
  meal?: MealWithDetails
}

export type HouseholdMember = {
  user_id: string
  display_name: string | null
}

export const CATEGORY_LABELS: Record<MealCategory, string> = {
  breakfast: 'Śniadanie',
  second_breakfast: 'Drugie śniadanie',
  lunch: 'Obiad',
  dinner: 'Kolacja',
  snack: 'Przekąska',
}
