import MealDetailsModal from '../MealPlanner/MealDetailsModal'
import type { MealWithItems } from './types'

// Shared MealDetailsModal with Edytuj / Usuń placed in its footer (Meals page only)
export default function MealDetailsWithActions({
  isOpen,
  meal,
  userId,
  householdId,
  onClose,
  onEdit,
  onDelete,
}: {
  isOpen: boolean
  meal: MealWithItems | null
  userId: string | undefined
  householdId: string | undefined
  onClose: () => void
  onEdit: (meal: MealWithItems) => void
  onDelete: (meal: MealWithItems) => void
}) {
  return (
    <MealDetailsModal
      isOpen={isOpen}
      onClose={onClose}
      meal={meal ? {
        ...meal,
        items: meal.items.map(item => ({
          ...item,
          unit_type: item.unit_type
        }))
      } : null}
      userId={userId}
      householdId={householdId}
      // Same "Mój przepis / <domownik>" switch as in the day plan, so variants can be compared from the meals list too
      showVariantSelector={true}
      initialVariantUserId={userId}
      actions={meal && (
        <>
          <button
            type="button"
            onClick={() => onEdit(meal)}
            className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Edytuj
          </button>
          <button
            type="button"
            onClick={() => onDelete(meal)}
            className="rounded-lg bg-red-50 px-4 py-2 text-sm font-semibold text-red-600 hover:bg-red-100 transition-colors"
          >
            Usuń
          </button>
        </>
      )}
    />
  )
}
