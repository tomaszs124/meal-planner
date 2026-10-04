import type { Product } from '@/lib/supabase/client'

/** Same formula as the UI (MealDetailsModal / Meals): nutrition is per 100 g. */
export function calculateNutrition(amount: number, unitWeightGrams: number | null, valuePer100g: number): number {
  const weightGrams = amount * (unitWeightGrams || 1)
  return (weightGrams / 100) * valuePer100g
}

export const UNIT_LABELS_PL: Record<string, string> = {
  '100g': 'g',
  piece: 'szt.',
  tablespoon: 'łyżka',
  teaspoon: 'łyżeczka',
  leaf: 'liść',
  cube: 'kostka',
  slice: 'plaster',
}

export type NutritionTotals = {
  kcal: number
  protein: number
  fat: number
  carbs: number
  weight_grams: number
}

export type DescribedItem = {
  product_id: string
  product_name: string
  amount: number
  unit: string
  unit_label: string
  grams: number
  kcal: number
  protein: number
  fat: number
  carbs: number
  package_size: number | null
  /** amount / package_size, e.g. 0.5 = half a package. null when package size unknown. */
  packages_used: number | null
}

function round(n: number, digits = 1): number {
  const f = Math.pow(10, digits)
  return Math.round(n * f) / f
}

export function describeItem(amount: number, product: Product): DescribedItem {
  const packageSize = product.package_size ?? null
  return {
    product_id: product.id,
    product_name: product.name,
    amount,
    unit: product.unit_type,
    unit_label: UNIT_LABELS_PL[product.unit_type] || product.unit_type,
    grams: Math.round(amount * (product.unit_weight_grams || 1)),
    kcal: Math.round(calculateNutrition(amount, product.unit_weight_grams, product.kcal_per_unit)),
    protein: round(calculateNutrition(amount, product.unit_weight_grams, product.protein || 0)),
    fat: round(calculateNutrition(amount, product.unit_weight_grams, product.fat || 0)),
    carbs: round(calculateNutrition(amount, product.unit_weight_grams, product.carbs || 0)),
    package_size: packageSize,
    packages_used: packageSize ? round(amount / packageSize, 3) : null,
  }
}

export function sumItems(items: DescribedItem[]): NutritionTotals {
  const totals = items.reduce(
    (acc, i) => {
      acc.kcal += i.kcal
      acc.protein += i.protein
      acc.fat += i.fat
      acc.carbs += i.carbs
      acc.weight_grams += i.grams
      return acc
    },
    { kcal: 0, protein: 0, fat: 0, carbs: 0, weight_grams: 0 }
  )
  return {
    kcal: Math.round(totals.kcal),
    protein: round(totals.protein),
    fat: round(totals.fat),
    carbs: round(totals.carbs),
    weight_grams: Math.round(totals.weight_grams),
  }
}

/**
 * Checks whether the combined amount of a product (summed over all household
 * variants) lands on a "clean" fraction of a package: 1, 0.5, 0.25 or a whole
 * multiple. This is the core of the recipe rules; the result is returned to the
 * model so it can self-correct before saving.
 */
export type PackageCheck = {
  product_id: string
  product_name: string
  total_amount: number
  unit_label: string
  package_size: number | null
  packages_used: number | null
  status: 'ok' | 'off' | 'unknown_package'
  nearest_clean_amount: number | null
}

const CLEAN_FRACTIONS = [0.25, 0.5, 0.75, 1]

export function checkPackageUsage(totalAmount: number, product: Product, tolerance = 0.02): PackageCheck {
  const base = {
    product_id: product.id,
    product_name: product.name,
    total_amount: round(totalAmount, 2),
    unit_label: UNIT_LABELS_PL[product.unit_type] || product.unit_type,
    package_size: product.package_size ?? null,
  }
  if (!product.package_size) {
    return { ...base, packages_used: null, status: 'unknown_package', nearest_clean_amount: null }
  }
  const used = totalAmount / product.package_size
  const whole = Math.floor(used)
  const frac = used - whole
  const candidates = [whole, ...CLEAN_FRACTIONS.map((f) => whole + f)].filter((c) => c > 0)
  const nearest = candidates.reduce((best, c) => (Math.abs(c - used) < Math.abs(best - used) ? c : best), candidates[0])
  const isClean = Math.abs(nearest - used) <= tolerance || Math.abs(frac) < 1e-9
  return {
    ...base,
    packages_used: round(used, 3),
    status: isClean ? 'ok' : 'off',
    nearest_clean_amount: round(nearest * product.package_size, 2),
  }
}
