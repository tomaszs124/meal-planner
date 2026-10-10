import MealDetailsModal from '../MealPlanner/MealDetailsModal'
import Button from '@/components/ui/Button'
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
          <Button onClick={() => onEdit(meal)}>
            Edytuj
          </Button>
          <Button variant="danger" onClick={() => onDelete(meal)}>
            Usuń
          </Button>
        </>
      )}
    />
  )
}
