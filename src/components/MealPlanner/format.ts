/** Rounds and groups thousands with a non-breaking space, e.g. 1800 -> "1 800" (Intl's pl-PL skips 4-digit numbers). */
export function formatNumber(value: number): string {
  return String(Math.round(value)).replace(/\B(?=(\d{3})+(?!\d))/g, '\u00a0')
}

/** "826 kcal · B 37 g · T 43 g · W 70 g" */
export function formatMealMacros(meal: { totalKcal?: number; totalProtein?: number; totalFat?: number; totalCarbs?: number }): string {
  return `${formatNumber(meal.totalKcal || 0)} kcal · B ${formatNumber(meal.totalProtein || 0)} g · T ${formatNumber(meal.totalFat || 0)} g · W ${formatNumber(meal.totalCarbs || 0)} g`
}
