'use client'

import { useState } from 'react'
import { Skeleton, SkeletonText } from '@/components/ui/Skeleton'
import { useRouter } from 'next/navigation'
import { supabase, UserSettings } from '@/lib/supabase/client'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { useUserSettings } from '@/hooks/useUserSettings'
import { useFeedback } from '@/components/ui/Feedback'

export default function UserSettingsForm() {
  const { user, isLoading: userLoading } = useCurrentUser()
  const { settings, isLoading, error, save, refresh } = useUserSettings(user?.id)

  if (userLoading || isLoading) {
    return (
      <div role="status" aria-live="polite" className="p-4 space-y-4">
        <span className="sr-only">Ładowanie...</span>
        <Skeleton className="h-10 w-full" />
        <SkeletonText lines={4} />
        <Skeleton className="h-10 w-32" />
      </div>
    )
  }

  if (!user) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-sm text-yellow-800">
        Musisz być zalogowany.
      </div>
    )
  }

  if (error && !settings) {
    return (
      <div className="p-4 rounded-lg border border-red-200 bg-red-50 text-sm text-red-700 space-y-3">
        <p>Nie udało się wczytać ustawień. Sprawdź połączenie i spróbuj ponownie.</p>
        <button
          type="button"
          onClick={() => void refresh()}
          className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
        >
          Spróbuj ponownie
        </button>
      </div>
    )
  }

  // Keyed by user and row version so the fields re-initialise when fresher settings
  // arrive (e.g. changed on another device while this tab was elsewhere).
  return <UserSettingsFields key={`${user.id}:${settings?.updated_at ?? 'new'}`} settings={settings} save={save} />
}

type UserSettingsFieldsProps = {
  settings: UserSettings | null
  save: (patch: Partial<UserSettings>) => Promise<boolean>
}

function UserSettingsFields({ settings, save }: UserSettingsFieldsProps) {
  const router = useRouter()
  const { toast } = useFeedback()
  const [isSaving, setIsSaving] = useState(false)

  const [name, setName] = useState(settings?.name || '')
  const [secondBreakfastEnabled, setSecondBreakfastEnabled] = useState(settings?.second_breakfast_enabled !== false)
  const [lunchEnabled, setLunchEnabled] = useState(settings?.lunch_enabled !== false)
  const [dinnerEnabled, setDinnerEnabled] = useState(settings?.dinner_enabled !== false)
  const [snackEnabled, setSnackEnabled] = useState(settings?.snack_enabled || false)

  // Wylogowanie
  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  // Zapisz ustawienia
  async function saveSettings(e: React.FormEvent) {
    e.preventDefault()

    setIsSaving(true)

    const saved = await save({
      name: name.trim() || null,
      second_breakfast_enabled: secondBreakfastEnabled,
      lunch_enabled: lunchEnabled,
      dinner_enabled: dinnerEnabled,
      snack_enabled: snackEnabled,
    })

    if (saved) {
      toast('Ustawienia zapisane', { type: 'success' })
    } else {
      toast('Nie udało się zapisać ustawień', { type: 'error' })
    }

    setIsSaving(false)
  }

  return (
    <div className="max-w-2xl mx-auto p-4 space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Ustawienia konta</h2>
        <p className="text-sm text-gray-500 mt-1">Dostosuj plan żywieniowy do swoich potrzeb</p>
      </div>

      {/* Form */}
      <form onSubmit={saveSettings} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 space-y-6">
        {/* Name input */}
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-gray-900 mb-2">
            Imię / Nazwa
          </label>
          <input
            type="text"
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Twoje imię"
            maxLength={100}
            className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <p className="text-xs text-gray-500 mt-1">
            To imię będzie wyświetlane w wiadomościach powitalnych i na listach domowników
          </p>
        </div>

        {/* Kategorie posiłków */}
        <div className="space-y-3 p-4 bg-gray-50 border border-gray-200 rounded-lg">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">Kategorie posiłków w planie</h3>
          
          {/* Breakfast - always on */}
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="breakfast"
              checked={true}
              disabled
              className="w-5 h-5 text-green-600 rounded focus:ring-2 focus:ring-green-500 cursor-not-allowed"
            />
            <label htmlFor="breakfast" className="flex-1 text-sm font-medium text-gray-900">
              Śniadanie
              <span className="text-xs text-gray-500 ml-2">(zawsze włączone)</span>
            </label>
          </div>

          {/* Second breakfast */}
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="second-breakfast"
              checked={secondBreakfastEnabled}
              onChange={(e) => setSecondBreakfastEnabled(e.target.checked)}
              className="w-5 h-5 text-blue-600 rounded focus:ring-2 focus:ring-blue-500 cursor-pointer"
            />
            <label htmlFor="second-breakfast" className="flex-1 text-sm font-medium text-gray-900 cursor-pointer">
              Drugie śniadanie
            </label>
          </div>

          {/* Lunch */}
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="lunch"
              checked={lunchEnabled}
              onChange={(e) => setLunchEnabled(e.target.checked)}
              className="w-5 h-5 text-blue-600 rounded focus:ring-2 focus:ring-blue-500 cursor-pointer"
            />
            <label htmlFor="lunch" className="flex-1 text-sm font-medium text-gray-900 cursor-pointer">
              Obiad
            </label>
          </div>

          {/* Dinner */}
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="dinner"
              checked={dinnerEnabled}
              onChange={(e) => setDinnerEnabled(e.target.checked)}
              className="w-5 h-5 text-blue-600 rounded focus:ring-2 focus:ring-blue-500 cursor-pointer"
            />
            <label htmlFor="dinner" className="flex-1 text-sm font-medium text-gray-900 cursor-pointer">
              Kolacja
            </label>
          </div>

          {/* Snack */}
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="snack"
              checked={snackEnabled}
              onChange={(e) => setSnackEnabled(e.target.checked)}
              className="w-5 h-5 text-blue-600 rounded focus:ring-2 focus:ring-blue-500 cursor-pointer"
            />
            <label htmlFor="snack" className="flex-1 text-sm font-medium text-gray-900 cursor-pointer">
              Przekąska
            </label>
          </div>
        </div>

        {/* Old snack checkbox - keep for backwards compatibility but hide */}
        <div style={{ display: 'none' }}>
          <input
            type="checkbox"
            id="snack-enabled"
            checked={snackEnabled}
            onChange={(e) => setSnackEnabled(e.target.checked)}
            className="w-5 h-5 text-blue-600 rounded focus:ring-2 focus:ring-blue-500 cursor-pointer"
          />
          <label htmlFor="snack-enabled" className="flex-1 text-sm font-medium text-gray-900 cursor-pointer">
            Aktywuj przekąskę w planie żywieniowym
          </label>
        </div>

        {/* Submit button */}
        <button
          type="submit"
          disabled={isSaving}
          className="w-full rounded-lg bg-blue-600 px-6 py-3 text-sm font-semibold text-white hover:bg-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
        >
          {isSaving ? 'Zapisywanie...' : 'Zapisz ustawienia'}
        </button>
      </form>

      {/* Logout button */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-3">Sesja</h3>
        <button
          onClick={handleLogout}
          className="w-full rounded-lg bg-red-600 px-6 py-3 text-sm font-semibold text-white hover:bg-red-500 focus:outline-none focus:ring-2 focus:ring-red-500 transition-colors"
        >
          Wyloguj się
        </button>
      </div>
    </div>
  )
}
