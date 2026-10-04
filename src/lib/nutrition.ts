/**
 * Shared nutrition helpers. Single source of truth for every place that turns
 * "amount of a product" into grams / kcal / macros (meal list, planner, picker,
 * shopping list, MCP connector).
 *
 * Convention: product nutrition values are always per 100 g. `unit_weight_grams`
 * says how many grams one preferred unit weighs (1 for products measured in grams).
 */

type NutritionSource = {
  unit_weight_grams: number | null
  kcal_per_unit: number
  protein: number | null
  fat: number | null
  carbs: number | null
}

/** Grams represented by `amount` units of a product. Missing unit weight means "amount is already grams". */
export function amountToGrams(amount: number, unitWeightGrams: number | null): number {
  return amount * (unitWeightGrams || 1)
}

/** Nutrition value (kcal or a macro) for `amount` units, given the value per 100 g. */
export function calculateNutrition(amount: number, unitWeightGrams: number | null, valuePer100g: number): number {
  return (amountToGrams(amount, unitWeightGrams) / 100) * valuePer100g
}

export type NutritionTotals = {
  kcal: number
  protein: number
  fat: number
  carbs: number
}

export const EMPTY_TOTALS: NutritionTotals = { kcal: 0, protein: 0, fat: 0, carbs: 0 }

/** Full nutrition of one ingredient line. */
export function nutritionFor(amount: number, product: NutritionSource): NutritionTotals {
  return {
    kcal: calculateNutrition(amount, product.unit_weight_grams, product.kcal_per_unit),
    protein: calculateNutrition(amount, product.unit_weight_grams, product.protein || 0),
    fat: calculateNutrition(amount, product.unit_weight_grams, product.fat || 0),
    carbs: calculateNutrition(amount, product.unit_weight_grams, product.carbs || 0),
  }
}

/** Sums nutrition over ingredient lines; lines without a product are skipped. */
export function sumNutrition(
  items: ReadonlyArray<{ amount: number; product?: NutritionSource | null }>
): NutritionTotals {
  return items.reduce<NutritionTotals>((acc, item) => {
    if (!item.product) return acc
    const n = nutritionFor(item.amount, item.product)
    return {
      kcal: acc.kcal + n.kcal,
      protein: acc.protein + n.protein,
      fat: acc.fat + n.fat,
      carbs: acc.carbs + n.carbs,
    }
  }, EMPTY_TOTALS)
}

/** "1.50" -> "1.5", "2.00" -> "2": compact display of amounts. */
export function formatAmount(amount: number): string {
  return Number(amount.toFixed(2)).toString()
}
