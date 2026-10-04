'use client'

import { Suspense, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import type { OAuthAuthorizationDetails } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase/client'
import { useCurrentUser } from '@/hooks/useCurrentUser'

/**
 * OAuth 2.1 consent screen for Supabase Auth's authorization server.
 * Supabase redirects here with ?authorization_id=... when an MCP client (ChatGPT,
 * Claude) asks for access. The signed-in user approves or denies; Supabase then
 * sends the browser back to the client with the authorization code.
 */
export default function OAuthConsentPage() {
  return (
    <Suspense fallback={<Shell>Ładowanie...</Shell>}>
      <ConsentContent />
    </Suspense>
  )
}

function ConsentContent() {
  const params = useSearchParams()
  const authorizationId = params.get('authorization_id')
  const { user, isLoading: userLoading } = useCurrentUser()
  const [details, setDetails] = useState<OAuthAuthorizationDetails | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!authorizationId || userLoading) return
    if (!user) {
      const back = `/oauth/consent?authorization_id=${encodeURIComponent(authorizationId)}`
      window.location.href = `/login?redirectTo=${encodeURIComponent(back)}`
      return
    }
    let cancelled = false
    supabase.auth.oauth.getAuthorizationDetails(authorizationId).then(({ data, error }) => {
      if (cancelled) return
      if (error || !data) {
        setError(error?.message || 'Nie udało się pobrać szczegółów autoryzacji.')
        return
      }
      if (data.redirect_url) {
        // Already approved earlier: go straight back to the client
        window.location.href = data.redirect_url
        return
      }
      setDetails(data)
    })
    return () => {
      cancelled = true
    }
  }, [authorizationId, user, userLoading])

  async function decide(approve: boolean) {
    if (!authorizationId) return
    setBusy(true)
    const { data, error } = approve
      ? await supabase.auth.oauth.approveAuthorization(authorizationId)
      : await supabase.auth.oauth.denyAuthorization(authorizationId)
    if (error || !data?.redirect_url) {
      setError(error?.message || 'Nie udało się zapisać decyzji.')
      setBusy(false)
      return
    }
    window.location.href = data.redirect_url
  }

  if (!authorizationId) {
    return <Shell>Brak identyfikatora autoryzacji. Uruchom połączenie ponownie z aplikacji, która prosi o dostęp.</Shell>
  }
  if (error) {
    return (
      <Shell>
        <p className="text-red-700">{error}</p>
        <p className="mt-2 text-sm text-gray-500">Wróć do aplikacji, która prosiła o dostęp, i spróbuj ponownie.</p>
      </Shell>
    )
  }
  if (!details) {
    return <Shell>Sprawdzanie prośby o dostęp...</Shell>
  }

  const clientName = details.client?.name || 'Aplikacja zewnętrzna'
  const scopes = (details.scope || '').split(' ').filter(Boolean)

  return (
    <Shell>
      <h1 className="text-lg font-semibold text-gray-900">Zezwolić na dostęp do Meal Plannera?</h1>
      <p className="mt-2 text-sm text-gray-700">
        <span className="font-medium">{clientName}</span> prosi o dostęp do Twojego konta{' '}
        <span className="font-medium">{details.user?.email}</span>. Będzie mogła przeglądać i zmieniać produkty, posiłki,
        plan i listę zakupów w Twoim imieniu, w granicach Twojego gospodarstwa.
      </p>
      {scopes.length > 0 && (
        <p className="mt-2 text-xs text-gray-500">Zakres: {scopes.join(', ')}</p>
      )}
      <div className="mt-6 flex gap-2 justify-end">
        <button
          type="button"
          disabled={busy}
          onClick={() => void decide(false)}
          className="rounded-lg px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-50"
        >
          Odmów
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => void decide(true)}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {busy ? 'Zapisywanie...' : 'Zezwól'}
        </button>
      </div>
    </Shell>
  )
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-sm border border-gray-200 text-sm text-gray-700">
        {children}
      </div>
    </div>
  )
}
