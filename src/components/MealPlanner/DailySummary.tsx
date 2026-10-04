import type { PlannedMeal } from './types'

type DailySummaryProps = {
  plannedMeals: PlannedMeal[]
}

/** "Zjedzono dzisiaj" block: consumed vs planned kcal and macros for the selected day. */
export default function DailySummary({ plannedMeals }: DailySummaryProps) {
  return (
    <div className="bg-green-50 border border-green-200 rounded-lg p-4">
      <h4 className="text-sm font-semibold text-gray-700 mb-3">Zjedzono dzisiaj:</h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-white rounded-lg p-3">
            <div className="text-xs text-gray-500 mb-1">Kalorie</div>
            <div className="text-xl font-bold text-gray-900">
              {Math.round(
                plannedMeals
                  .filter(p => p.is_consumed)
                  .reduce((sum, p) => sum + (p.meal?.totalKcal || 0), 0)
              )}
            </div>
            <div className="text-xs text-gray-500">
              / {Math.round(plannedMeals.reduce((sum, p) => sum + (p.meal?.totalKcal || 0), 0))} kcal
            </div>
          </div>

          <div className="bg-white rounded-lg p-3">
            <div className="text-xs text-gray-500 mb-1">Białko</div>
            <div className="text-xl font-bold text-gray-900">
              {Math.round(
                plannedMeals
                  .filter(p => p.is_consumed && p.meal)
                  .reduce((sum, p) => sum + (p.meal?.totalProtein || 0), 0)
              )}g
            </div>
            <div className="text-xs text-gray-500">
              / {Math.round(
                plannedMeals
                  .filter(p => p.meal)
                  .reduce((sum, p) => sum + (p.meal?.totalProtein || 0), 0)
              )}g
            </div>
          </div>

          <div className="bg-white rounded-lg p-3">
            <div className="text-xs text-gray-500 mb-1">Tłuszcze</div>
            <div className="text-xl font-bold text-gray-900">
              {Math.round(
                plannedMeals
                  .filter(p => p.is_consumed && p.meal)
                  .reduce((sum, p) => sum + (p.meal?.totalFat || 0), 0)
              )}g
            </div>
            <div className="text-xs text-gray-500">
              / {Math.round(
                plannedMeals
                  .filter(p => p.meal)
                  .reduce((sum, p) => sum + (p.meal?.totalFat || 0), 0)
              )}g
            </div>
          </div>

          <div className="bg-white rounded-lg p-3">
            <div className="text-xs text-gray-500 mb-1">Węglowodany</div>
            <div className="text-xl font-bold text-gray-900">
              {Math.round(
                plannedMeals
                  .filter(p => p.is_consumed && p.meal)
                  .reduce((sum, p) => sum + (p.meal?.totalCarbs || 0), 0)
              )}g
            </div>
            <div className="text-xs text-gray-500">
              / {Math.round(
                plannedMeals
                  .filter(p => p.meal)
                  .reduce((sum, p) => sum + (p.meal?.totalCarbs || 0), 0)
              )}g
            </div>
          </div>
        </div>
      </div>
  )
}
