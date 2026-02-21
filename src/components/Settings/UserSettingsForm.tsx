'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase, UserSettings } from '@/lib/supabase/client'
import { useCurrentUser } from '@/hooks/useCurrentUser'

export default function UserSettingsForm() {
  const router = useRouter()
  const { user, isLoading: userLoading } = useCurrentUser()
  const [settings, setSettings] = useState<UserSettings | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)

  const [name, setName] = useState('')
  const [secondBreakfastEnabled, setSecondBreakfastEnabled] = useState(true)
  const [lunchEnabled, setLunchEnabled] = useState(true)
  const [dinnerEnabled, setDinnerEnabled] = useState(true)
  const [snackEnabled, setSnackEnabled] = useState(false)

  // Wylogowanie
  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  // Wczytaj ustawienia użytkownika
  useEffect(() => {
    const userId = user?.id
    if (!userId) return

    async function fetchSettings() {
      setIsLoading(true)

      const { data, error } = await supabase
        .from('user_settings')
        .select('*')
        .eq('user_id', userId)
        .single()

      if (error && error.code !== 'PGRST116') {
        console.error('Error fetching settings:', error)
      }

      if (data) {
        setSettings(data)
        setName(data.name || '')
        setSecondBreakfastEnabled(data.second_breakfast_enabled !== false)
        setLunchEnabled(data.lunch_enabled !== false)
        setDinnerEnabled(data.dinner_enabled !== false)
        setSnackEnabled(data.snack_enabled || false)
      } else {
        // User has no settings yet - create default ones
        const defaultSettings = {
          user_id: userId,
          name: null,
          second_breakfast_enabled: true,
          lunch_enabled: true,
          dinner_enabled: true,
          snack_enabled: false,
        }
        
        const { data: newSettings, error: insertError } = await supabase
          .from('user_settings')
          .insert([defaultSettings])
          .select()
          .single()

        if (!insertError && newSettings) {
          setSettings(newSettings)
          setSecondBreakfastEnabled(true)
          setLunchEnabled(true)
          setDinnerEnabled(true)
          setSnackEnabled(false)
        }
      }

      setIsLoading(false)
    }

    fetchSettings()
  }, [user?.id])

  // Zapisz ustawienia
  async function saveSettings(e: React.FormEvent) {
    e.preventDefault()
    const userId = user?.id
    if (!userId) return

    setIsSaving(true)

    const settingsData = {
      user_id: userId,
      name: name.trim() || null,
      second_breakfast_enabled: secondBreakfastEnabled,
      lunch_enabled: lunchEnabled,
      dinner_enabled: dinnerEnabled,
      snack_enabled: snackEnabled,
    }

    let result

    if (settings) {
      // Aktualizuj istniejące ustawienia
      result = await supabase
        .from('user_settings')
        .update(settingsData)
        .eq('user_id', userId)
        .select()
        .single()
    } else {
      // Utwórz nowe ustawienia
      result = await supabase
        .from('user_settings')
        .insert(settingsData)
        .select()
        .single()
    }

    if (result.error) {
      alert('Nie udało się zapisać ustawień')
      console.error(result.error)
    } else {
      setSettings(result.data)
      alert('Ustawienia zapisane!')
    }

    setIsSaving(false)
  }

  if (userLoading || isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-gray-500">Ładowanie...</div>
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
