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
    <section
      aria-label="Podsumowanie dnia"
      className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 shadow-sm"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 text-xs text-gray-500 dark:text-gray-400">
        <div>
          Zjedzone{' '}
          <span className="num-display text-gray-900 dark:text-gray-100">{formatNumber(consumed.kcal)}</span>
          {' / '}
          <span className="tabular-nums">{formatNumber(planned.kcal)}</span> kcal
          <span className={`ml-1.5 font-semibold ${done ? 'text-green-700 dark:text-green-400' : 'text-gray-400 dark:text-gray-500'}`}>{percent}%</span>
        </div>
        <div className="tabular-nums">
          {macros.map(([label, eaten, total], i) => (
            <span key={label}>
              {i > 0 && ' · '}
              {label} <span className="font-medium text-gray-700 dark:text-gray-300">{formatNumber(eaten)}</span>/{formatNumber(total)}
            </span>
          ))}
          <span className="ml-0.5">g</span>
        </div>
      </div>
      <div
        role="progressbar"
        aria-label="Zjedzone kalorie"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.min(100, percent)}
        className="mt-1.5 h-1 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-700"
      >
        <div
          className={`h-full rounded-full transition-[width] duration-300 ${done ? 'bg-gradient-to-r from-green-500 to-emerald-400' : 'bg-gradient-to-r from-brand-500 to-brand-300'}`}
          style={{ width: `${Math.min(100, percent)}%` }}
        />
      </div>
    </section>
  )
}
