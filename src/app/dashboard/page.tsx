'use client'

import { useCurrentUser } from '@/hooks/useCurrentUser'
import MealPlanner from '@/components/MealPlanner/MealPlanner'
import { PlannerSkeleton, Skeleton } from '@/components/ui/Skeleton'
import { PageShell } from '@/components/Layout/PageShell'

export default function DashboardPage() {
  const { user, isLoading } = useCurrentUser()

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

  // MealPlanner renders the page header itself: the title is the selected day
  return (
    <PageShell wide>
      <MealPlanner />
    </PageShell>
  )
}
