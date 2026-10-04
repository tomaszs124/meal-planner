'use client'

import { useCurrentUser } from '@/hooks/useCurrentUser'
import { useUserSettings } from '@/hooks/useUserSettings'
import MealPlanner from '@/components/MealPlanner/MealPlanner'
import { PlannerSkeleton, Skeleton } from '@/components/ui/Skeleton'

export default function DashboardPage() {
  const { user, household, isLoading } = useCurrentUser()
  // Shared settings cache (also used by the planner), for the name in the greeting
  const { settings: userSettings } = useUserSettings(user?.id)

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mb-8 space-y-3" aria-hidden="true">
            <Skeleton className="h-9 w-56" />
            <Skeleton className="h-4 w-40" />
          </div>
          <div className="mb-8">
            <PlannerSkeleton />
          </div>
        </div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-gray-500">Nie zalogowano</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">
            Witaj{userSettings?.name ? `, ${userSettings.name}` : ''}!
          </h1>
          {household && (
            <p className="text-sm text-gray-600 mt-2">
              Gospodarstwo: <span className="font-medium">{household.name}</span>
            </p>
          )}
        </div>

        {/* Meal Planner */}
        <div className="mb-8">
          <MealPlanner />
        </div>
      </div>
    </div>
  )
}
