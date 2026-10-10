'use client'

import { useEffect } from 'react'

/**
 * Route-level error boundary: an unexpected exception in a page no longer
 * blanks the app. Shows a friendly message and lets the user retry.
 */
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // Hook for an error reporter (Sentry etc.) later; keep the console trace for now.
    console.error('Unhandled page error:', error)
  }, [error])

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 p-6">
      <div className="w-full max-w-sm rounded-xl bg-white dark:bg-gray-800 p-6 shadow-sm border border-gray-200 dark:border-gray-700 text-center">
        <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Coś poszło nie tak</h1>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
          Nie udało się wyświetlić tej strony. Spróbuj ponownie, a jeśli problem wraca, odśwież aplikację.
        </p>
        {error.digest && <p className="mt-2 text-xs text-gray-400 dark:text-gray-500">Kod błędu: {error.digest}</p>}
        <div className="mt-5 flex justify-center gap-2">
          <button
            type="button"
            onClick={reset}
            className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
          >
            Spróbuj ponownie
          </button>
          <a
            href="/dashboard"
            className="rounded-lg px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            Wróć do planu
          </a>
        </div>
      </div>
    </div>
  )
}
