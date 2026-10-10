'use client'

import { useCurrentUser } from '@/hooks/useCurrentUser'
import { useUserSettings } from '@/hooks/useUserSettings'
import MealPlanner from '@/components/MealPlanner/MealPlanner'
import { PlannerSkeleton, Skeleton } from '@/components/ui/Skeleton'
import { PageHeader, PageShell } from '@/components/Layout/PageShell'

export default function DashboardPage() {
  const { user, household, isLoading } = useCurrentUser()
  // Shared settings cache (also used by the planner), for the name in the greeting
  const { settings: userSettings } = useUserSettings(user?.id)

  if (isLoading) {
    return (
      <PageShell wide>
        <div className="space-y-3" aria-hidden="true">
          <Skeleton className="h-9 w-56" />
          <Skeleton className="h-4 w-40" />
        </div>
        <PlannerSkeleton />
      </PageShell>
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
    <PageShell wide>
      <PageHeader
        title={`Witaj${userSettings?.name ? `, ${userSettings.name}` : ''}!`}
        subtitle={household && (
          <>
            Gospodarstwo: <span className="font-medium text-gray-700">{household.name}</span>
          </>
        )}
      />
      <MealPlanner />
    </PageShell>
  )
}
