import type { MealCategory } from '@/lib/supabase/client'
import { sumNutrition } from '@/lib/nutrition'
import type { MealItem } from './types'

// Funkcja tłumacząca jednostki na polski
export function translateUnit(unitType: string): string {
  const units: { [key: string]: string } = {
    '100g': 'g',
    'piece': 'szt',
    'tablespoon': 'łyżka',
    'teaspoon': 'łyżeczka',
    'leaf': 'liść',
    'cube': 'kostka',
    'slice': 'plaster',
  }
  return units[unitType] || unitType
}

// Kategorie posiłków
export const MEAL_CATEGORIES: { value: MealCategory; label: string }[] = [
  { value: 'breakfast', label: 'Śniadanie' },
  { value: 'second_breakfast', label: 'Drugie śniadanie' },
  { value: 'lunch', label: 'Obiad' },
  { value: 'dinner', label: 'Kolacja' },
  { value: 'snack', label: 'Przekąska' },
]

export function translateCategory(category: MealCategory | null): string {
  if (!category) return ''
  return MEAL_CATEGORIES.find(c => c.value === category)?.label || category
}

// Totals fields of MealWithItems, computed with the shared nutrition helper
export function mealTotals(items: MealItem[]) {
  const totals = sumNutrition(items)
  return {
    totalKcal: totals.kcal,
    totalProtein: totals.protein,
    totalFat: totals.fat,
    totalCarbs: totals.carbs,
  }
}
