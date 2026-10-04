import MealDetailsModal from '../MealPlanner/MealDetailsModal'
import type { MealWithItems } from './types'

// Shared MealDetailsModal plus the floating Edit / Delete footer shown on the Meals page
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
    <>
      {/* Detail Modal */}
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
        // The Edit/Delete footer below lives outside the dialog, so it must stay reachable for screen readers
        ariaModal={false}
      />

      {/* Modal Footer with Edit/Delete */}
      {isOpen && meal && (
        <div className="fixed inset-0 z-[61] pointer-events-none flex items-end justify-center pb-8">
          <div
            className="pointer-events-auto bg-white rounded-lg shadow-lg border border-gray-200 p-4 flex gap-2"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => onEdit(meal)}
              className="text-blue-600 hover:text-blue-700 text-sm font-medium px-4 py-2 bg-blue-50 rounded hover:bg-blue-100 transition-colors"
            >
              Edytuj
            </button>
            <button
              onClick={() => onDelete(meal)}
              className="text-red-600 hover:text-red-700 text-sm font-medium px-4 py-2 bg-red-50 rounded hover:bg-red-100 transition-colors"
            >
              Usuń
            </button>
          </div>
        </div>
      )}
    </>
  )
}
