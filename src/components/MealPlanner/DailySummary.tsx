import type { PlannedMeal } from './types'
import { formatNumber } from './format'

type DailySummaryProps = {
  plannedMeals: PlannedMeal[]
}

type Totals = { kcal: number; protein: number; fat: number; carbs: number }

function sumTotals(plans: PlannedMeal[]): Totals {
  return plans.reduce<Totals>(
    (acc, p) => ({
      kcal: acc.kcal + (p.meal?.totalKcal || 0),
      protein: acc.protein + (p.meal?.totalProtein || 0),
      fat: acc.fat + (p.meal?.totalFat || 0),
      carbs: acc.carbs + (p.meal?.totalCarbs || 0),
    }),
    { kcal: 0, protein: 0, fat: 0, carbs: 0 }
  )
}

/**
 * Compact progress block for the selected day: consumed vs planned kcal with a thin
 * progress bar, and one line of consumed/planned macros.
 *
 * The denominator is the day's planned total (all planned meals, skipped ones included,
 * as before): user settings have no kcal goal (calorie goals were removed, see
 * docs/remove-calorie-goals.sql), so there is nothing else to compare against.
 */
export default function DailySummary({ plannedMeals }: DailySummaryProps) {
  const planned = sumTotals(plannedMeals)
  const consumed = sumTotals(plannedMeals.filter((p) => p.is_consumed))
  const percent = planned.kcal > 0 ? Math.round((consumed.kcal / planned.kcal) * 100) : 0
  const done = percent >= 100

  const macros: [string, number, number][] = [
    ['B', consumed.protein, planned.protein],
    ['T', consumed.fat, planned.fat],
    ['W', consumed.carbs, planned.carbs],
  ]

  return (
    <section aria-label="Podsumowanie dnia" className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex items-baseline justify-between gap-3">
        <div className="text-sm text-gray-600">
          Zjedzone{' '}
          <span className="font-semibold text-gray-900">{formatNumber(consumed.kcal)}</span>
          {' / '}
          {formatNumber(planned.kcal)} kcal
        </div>
        <div className={`text-xs font-semibold ${done ? 'text-green-700' : 'text-gray-500'}`}>{percent}%</div>
      </div>
      <div
        role="progressbar"
        aria-label="Zjedzone kalorie"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.min(100, percent)}
        className="mt-2 h-1.5 overflow-hidden rounded-full bg-gray-100"
      >
        <div
          className={`h-full rounded-full transition-[width] duration-300 ${done ? 'bg-green-500' : 'bg-blue-600'}`}
          style={{ width: `${Math.min(100, percent)}%` }}
        />
      </div>
      <div className="mt-2 text-xs text-gray-500">
        {macros.map(([label, eaten, total], i) => (
          <span key={label}>
            {i > 0 && ' · '}
            {label} <span className="font-medium text-gray-700">{formatNumber(eaten)}</span>/{formatNumber(total)} g
          </span>
        ))}
      </div>
    </section>
  )
}
