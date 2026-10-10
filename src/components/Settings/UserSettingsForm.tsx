'use client'

import { useState } from 'react'
import { Skeleton, SkeletonText } from '@/components/ui/Skeleton'
import { useRouter } from 'next/navigation'
import { supabase, UserSettings } from '@/lib/supabase/client'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { useUserSettings } from '@/hooks/useUserSettings'
import { useFeedback } from '@/components/ui/Feedback'
import { PageHeader } from '@/components/Layout/PageShell'
import Button from '@/components/ui/Button'
import { useTheme, type Theme } from '@/lib/theme'

export default function UserSettingsForm() {
  const { user, isLoading: userLoading } = useCurrentUser()
  const { settings, isLoading, error, save, refresh } = useUserSettings(user?.id)

  if (userLoading || isLoading) {
    return (
      <div role="status" aria-live="polite" className="space-y-4">
        <span className="sr-only">Ładowanie...</span>
        <Skeleton className="h-10 w-full" />
        <SkeletonText lines={4} />
        <Skeleton className="h-10 w-32" />
      </div>
    )
  }

  if (!user) {
    return (
      <div className="bg-yellow-50 dark:bg-yellow-950 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 text-sm text-yellow-800 dark:text-yellow-200">
        Musisz być zalogowany.
      </div>
    )
  }

  if (error && !settings) {
    return (
      <div className="p-4 rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950 text-sm text-red-700 dark:text-red-300 space-y-3">
        <p>Nie udało się wczytać ustawień. Sprawdź połączenie i spróbuj ponownie.</p>
        <Button onClick={() => void refresh()}>
          Spróbuj ponownie
        </Button>
      </div>
    )
  }

  // Keyed by user only; fresher settings (another device) are synced inside the fields
  // component without remounting, so typing and focus survive the user's own save.
  return <UserSettingsFields key={user.id} settings={settings} save={save} />
}

type FieldValues = { name: string; second: boolean; lunch: boolean; dinner: boolean; snack: boolean; rules: string }

function fieldValuesOf(settings: UserSettings | null): FieldValues {
  return {
    name: settings?.name || '',
    second: settings?.second_breakfast_enabled !== false,
    lunch: settings?.lunch_enabled !== false,
    dinner: settings?.dinner_enabled !== false,
    snack: settings?.snack_enabled || false,
    rules: settings?.dietary_rules || '',
  }
}

function sameFieldValues(a: FieldValues, b: FieldValues): boolean {
  return (
    a.name === b.name &&
    a.second === b.second &&
    a.lunch === b.lunch &&
    a.dinner === b.dinner &&
    a.snack === b.snack &&
    a.rules === b.rules
  )
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
  const [dietaryRules, setDietaryRules] = useState(settings?.dietary_rules || '')

  // Sync from fresher settings (another device, or the echo of our own save) without
  // remounting: only when the form is not dirty, so in-progress typing is never lost.
  // "Adjusting state during render" pattern; React re-renders immediately with the new values.
  const [syncedBase, setSyncedBase] = useState<FieldValues>(() => fieldValuesOf(settings))
  const [syncedVersion, setSyncedVersion] = useState<string | null>(settings?.updated_at ?? null)
  const incomingVersion = settings?.updated_at ?? null
  if (incomingVersion !== syncedVersion) {
    const current: FieldValues = {
      name,
      second: secondBreakfastEnabled,
      lunch: lunchEnabled,
      dinner: dinnerEnabled,
      snack: snackEnabled,
      rules: dietaryRules,
    }
    const incoming = fieldValuesOf(settings)
    // Dirty = the user changed something since the last sync AND it differs from what the
    // server now has (after our own save the fields already equal the server row).
    const isDirty = !sameFieldValues(current, syncedBase) && !sameFieldValues(current, incoming)
    if (!isDirty && !isSaving) {
      setSyncedVersion(incomingVersion)
      setName(incoming.name)
      setSecondBreakfastEnabled(incoming.second)
      setLunchEnabled(incoming.lunch)
      setDinnerEnabled(incoming.dinner)
      setSnackEnabled(incoming.snack)
      setDietaryRules(incoming.rules)
      setSyncedBase(incoming)
    }
  }

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
      dietary_rules: dietaryRules.trim() || null,
    })

    if (saved) {
      toast('Ustawienia zapisane', { type: 'success' })
    } else {
      toast('Nie udało się zapisać ustawień', { type: 'error' })
    }

    setIsSaving(false)
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Ustawienia konta" subtitle="Dostosuj plan żywieniowy do swoich potrzeb" />

      {/* Form */}
      <form onSubmit={saveSettings} className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4 sm:p-6 space-y-6">
        {/* Name input */}
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">
            Imię / Nazwa
          </label>
          <input
            type="text"
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Twoje imię"
            maxLength={100}
            className="w-full rounded-lg border border-gray-300 dark:border-gray-600 px-4 py-2.5 text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            To imię będzie wyświetlane w wiadomościach powitalnych i na listach domowników
          </p>
        </div>

        {/* Personal dietary rules (read by the MCP assistant) */}
        <div>
          <label htmlFor="dietary-rules" className="block text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">
            Moje zasady żywieniowe
          </label>
          <textarea
            id="dietary-rules"
            value={dietaryRules}
            onChange={(e) => setDietaryRules(e.target.value)}
            rows={5}
            maxLength={2000}
            placeholder={'Np.\n- na śniadanie maks 2 jajka\n- bez laktozy\n- obiad do 600 kcal'}
            className="w-full rounded-lg border border-gray-300 dark:border-gray-600 px-4 py-2.5 text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500 resize-y"
          />
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Asystent AI (konektor MCP) bierze te zasady pod uwagę, gdy proponuje posiłki i plan dla Ciebie.
            Jedna zasada w linii. {dietaryRules.length}/2000
          </p>
        </div>

        {/* Kategorie posiłków */}
        <div className="space-y-3 p-4 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">Kategorie posiłków w planie</h3>
          
          {/* Breakfast - always on */}
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="breakfast"
              checked={true}
              disabled
              className="w-5 h-5 text-brand-600 dark:text-brand-400 rounded focus:ring-2 focus:ring-brand-500 cursor-not-allowed"
            />
            <label htmlFor="breakfast" className="flex-1 text-sm font-medium text-gray-900 dark:text-gray-100">
              Śniadanie
              <span className="text-xs text-gray-500 dark:text-gray-400 ml-2">(zawsze włączone)</span>
            </label>
          </div>

          {/* Second breakfast */}
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="second-breakfast"
              checked={secondBreakfastEnabled}
              onChange={(e) => setSecondBreakfastEnabled(e.target.checked)}
              className="w-5 h-5 text-brand-600 dark:text-brand-400 rounded focus:ring-2 focus:ring-brand-500 cursor-pointer"
            />
            <label htmlFor="second-breakfast" className="flex-1 text-sm font-medium text-gray-900 dark:text-gray-100 cursor-pointer">
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
              className="w-5 h-5 text-brand-600 dark:text-brand-400 rounded focus:ring-2 focus:ring-brand-500 cursor-pointer"
            />
            <label htmlFor="lunch" className="flex-1 text-sm font-medium text-gray-900 dark:text-gray-100 cursor-pointer">
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
              className="w-5 h-5 text-brand-600 dark:text-brand-400 rounded focus:ring-2 focus:ring-brand-500 cursor-pointer"
            />
            <label htmlFor="dinner" className="flex-1 text-sm font-medium text-gray-900 dark:text-gray-100 cursor-pointer">
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
              className="w-5 h-5 text-brand-600 dark:text-brand-400 rounded focus:ring-2 focus:ring-brand-500 cursor-pointer"
            />
            <label htmlFor="snack" className="flex-1 text-sm font-medium text-gray-900 dark:text-gray-100 cursor-pointer">
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
            className="w-5 h-5 text-brand-600 dark:text-brand-400 rounded focus:ring-2 focus:ring-brand-500 cursor-pointer"
          />
          <label htmlFor="snack-enabled" className="flex-1 text-sm font-medium text-gray-900 dark:text-gray-100 cursor-pointer">
            Aktywuj przekąskę w planie żywieniowym
          </label>
        </div>

        {/* Submit button */}
        <Button type="submit" variant="primary" disabled={isSaving} className="w-full sm:w-auto">
          {isSaving ? 'Zapisywanie...' : 'Zapisz ustawienia'}
        </Button>
      </form>

      {/* Appearance (stored per device in localStorage, see src/lib/theme.ts) */}
      <ThemeCard />

      {/* Logout button */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4 sm:p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">Sesja</h3>
        <Button variant="danger" onClick={handleLogout} className="w-full sm:w-auto">
          Wyloguj się
        </Button>
      </div>
    </div>
  )
}

function ThemeCard() {
  const [theme, setTheme] = useTheme()
  const options: { value: Theme; label: string; hint: string }[] = [
    { value: 'light', label: 'Jasny', hint: 'Domyślny' },
    { value: 'dark', label: 'Ciemny', hint: 'Mniej światła wieczorem' },
  ]
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 sm:p-6 dark:bg-gray-800 dark:border-gray-700">
      <h3 className="text-lg font-semibold text-gray-900 mb-1 dark:text-gray-100">Wygląd</h3>
      <p className="text-xs text-gray-500 mb-3 dark:text-gray-400">Zapamiętywany na tym urządzeniu.</p>
      <div role="radiogroup" aria-label="Motyw" className="grid grid-cols-2 gap-1 rounded-lg bg-gray-100 p-1 dark:bg-gray-700">
        {options.map((option) => {
          const active = theme === option.value
          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => setTheme(option.value)}
              className={`rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                active
                  ? 'bg-white text-gray-900 shadow-sm dark:bg-gray-900 dark:text-gray-100'
                  : 'text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-gray-100'
              }`}
            >
              {option.label}
              <span className="block text-[11px] font-normal text-gray-500 dark:text-gray-400">{option.hint}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
