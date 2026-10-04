'use client'

import { createContext, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { usePathname } from 'next/navigation'
import type { User } from '@supabase/supabase-js'
import { supabase, type Household } from '@/lib/supabase/client'

// Routes that render without a session (must match src/proxy.ts)
const PUBLIC_ROUTES = ['/login', '/signup', '/reset-password']

export type CurrentUserContextValue = {
  user: User | null
  household: Household | null
  isLoading: boolean
  error: string | null
  /** Re-runs the household lookup for the current user (e.g. after joining a household). */
  refreshHousehold: () => Promise<void>
}

export const CurrentUserContext = createContext<CurrentUserContextValue | null>(null)

/**
 * Single app-wide source of the signed-in user and their household.
 *
 * Owns the only `supabase.auth.onAuthStateChange` subscription and the
 * `household_users` -> `households` lookup, so pages with many
 * `useCurrentUser()` consumers no longer create one subscription and one
 * query per component. Mounted once in the root layout.
 */
export function CurrentUserProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [household, setHousehold] = useState<Household | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Whether we've received the first definitive auth event
  const initializedRef = useRef(false)
  const mountedRef = useRef(false)
  const userRef = useRef<User | null>(null)
  // Mirrors `household` for effects that must not re-run on every state change
  const householdRef = useRef<Household | null>(null)
  // Incremented on every household lookup / sign-out so a slow response for a
  // previous user can never overwrite newer state.
  const requestIdRef = useRef(0)

  const fetchHousehold = useCallback(async (currentUser: User) => {
    const requestId = ++requestIdRef.current
    const isCurrent = () => mountedRef.current && requestId === requestIdRef.current

    try {
      setError(null)

      // Get user's household
      const { data: householdData, error: householdError } = await supabase
        .from('household_users')
        .select(`
          households:household_id (
            id,
            name,
            created_by,
            created_at,
            updated_at
          )
        `)
        .eq('user_id', currentUser.id)
        .single()

      if (householdError && householdError.code !== 'PGRST116') {
        // PGRST116 = no rows returned (user has no household yet)
        throw householdError
      }

      if (isCurrent()) {
        const householdsValue = householdData?.households
        const nextHousehold = Array.isArray(householdsValue)
          ? householdsValue[0] || null
          : householdsValue || null
        householdRef.current = nextHousehold as Household | null
        setHousehold(householdRef.current)
        setIsLoading(false)
      }
    } catch (err) {
      if (isCurrent()) {
        setError(err instanceof Error ? err.message : 'Failed to fetch user data')
        setIsLoading(false)
      }
    }
  }, [])

  const applySignedIn = useCallback((nextUser: User) => {
    initializedRef.current = true
    if (userRef.current?.id !== nextUser.id) {
      // New or different user: hide pages until the household is known, otherwise the
      // dashboard briefly renders "Nie zalogowano" / "dołącz do gospodarstwa" right after login.
      setIsLoading(true)
      householdRef.current = null
      setHousehold(null)
    }
    userRef.current = nextUser
    setUser(nextUser)
    void fetchHousehold(nextUser)
  }, [fetchHousehold])

  useEffect(() => {
    mountedRef.current = true
    let fallbackTimer: ReturnType<typeof setTimeout> | undefined

    // Use onAuthStateChange as the sole initializer.
    // It fires INITIAL_SESSION immediately on subscribe, so no separate fetch needed.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mountedRef.current) return

      if (event === 'SIGNED_OUT') {
        // Only clear state on an explicit sign-out, never on a transient null session
        initializedRef.current = true
        userRef.current = null
        householdRef.current = null
        requestIdRef.current++ // drop any in-flight household lookup
        setUser(null)
        setHousehold(null)
        setIsLoading(false)
        return
      }

      if (session?.user) {
        applySignedIn(session.user)
      } else if (event === 'INITIAL_SESSION') {
        // INITIAL_SESSION with no session means the access token may be expired and
        // Supabase is about to attempt a silent refresh (TOKEN_REFRESHED will follow),
        // or the user is truly not logged in (SIGNED_OUT will follow).
        // Keep isLoading=true and wait - do NOT prematurely clear the user state.
        // Safety fallback: if no event follows within 5 s, stop the loading spinner.
        fallbackTimer = setTimeout(() => {
          if (mountedRef.current && !initializedRef.current) {
            initializedRef.current = true
            setIsLoading(false)
          }
        }, 5000)
      }
    })

    return () => {
      mountedRef.current = false
      if (fallbackTimer) clearTimeout(fallbackTimer)
      subscription.unsubscribe()
    }
  }, [applySignedIn])

  // The provider lives in the root layout, so it survives client-side
  // navigations. Logging in happens in a server action that only sets cookies
  // and redirects, which does not emit SIGNED_IN in the browser client. Before
  // this provider existed every page re-subscribed and picked the new session
  // up via INITIAL_SESSION; to keep that behaviour, re-read the session from
  // storage (cookies) after each navigation while no user is known.
  const pathname = usePathname()
  const lastPathnameRef = useRef(pathname)
  // Pathname whose session re-check has completed; until it matches the current
  // pathname (and no user is known) protected pages are treated as loading, so
  // nothing renders "Nie zalogowano" in the frame before getSession() resolves.
  const [sessionCheckedFor, setSessionCheckedFor] = useState(pathname)
  const isPublicPath = PUBLIC_ROUTES.some((route) => pathname.startsWith(route))
  const checkingSession = !user && !isPublicPath && sessionCheckedFor !== pathname
  // Layout effect: runs before paint, so the dashboard does not flash "Nie zalogowano"
  // for one frame right after the server-action login redirect.
  useLayoutEffect(() => {
    if (pathname === lastPathnameRef.current) return
    lastPathnameRef.current = pathname

    if (userRef.current) {
      // Known user but no household (transient error at startup, or the user was just
      // added to a household): retry on navigation so the app can recover without a reload.
      if (!householdRef.current) void fetchHousehold(userRef.current)
      return
    }

    let cancelled = false
    void supabase.auth.getSession().then(({ data: { session } }) => {
      if (cancelled || !mountedRef.current) return
      if (session?.user && !userRef.current) {
        applySignedIn(session.user)
      }
      setSessionCheckedFor(pathname)
    })
    return () => {
      cancelled = true
    }
  }, [pathname, applySignedIn, fetchHousehold])

  const refreshHousehold = useCallback(async () => {
    const currentUser = userRef.current
    if (!currentUser) return
    await fetchHousehold(currentUser)
  }, [fetchHousehold])

  const value = useMemo<CurrentUserContextValue>(
    () => ({ user, household, isLoading: isLoading || checkingSession, error, refreshHousehold }),
    [user, household, isLoading, checkingSession, error, refreshHousehold],
  )

  return <CurrentUserContext.Provider value={value}>{children}</CurrentUserContext.Provider>
}
