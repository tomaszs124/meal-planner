'use client'

import { useEffect, useState } from 'react'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import MealPlanner from '@/components/MealPlanner/MealPlanner'
import { supabase, UserSettings } from '@/lib/supabase/client'

export default function DashboardPage() {
  const { user, household, isLoading } = useCurrentUser()
  const [userSettings, setUserSettings] = useState<UserSettings | null>(null)

  // Fetch user settings to get name
  useEffect(() => {
    const userId = user?.id
    if (!userId) return

    async function fetchSettings() {
      const { data } = await supabase
        .from('user_settings')
        .select('*')
        .eq('user_id', userId)
        .single()

      if (data) {
        setUserSettings(data)
      }
    }

    fetchSettings()
  }, [user?.id])

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-gray-500">Ładowanie...</div>
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
