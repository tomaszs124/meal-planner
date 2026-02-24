import { useEffect, useRef, useState } from 'react'
import { supabase, Household } from '@/lib/supabase/client'
import { User } from '@supabase/supabase-js'

type UseCurrentUserReturn = {
  user: User | null
  household: Household | null
  isLoading: boolean
  error: string | null
}

export function useCurrentUser(): UseCurrentUserReturn {
  const [user, setUser] = useState<User | null>(null)
  const [household, setHousehold] = useState<Household | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  // Track whether we've received the first definitive auth event
  const initializedRef = useRef(false)

  useEffect(() => {
    let mounted = true

    async function fetchHousehold(currentUser: User) {
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

        if (mounted) {
          const householdsValue = householdData?.households
          const nextHousehold = Array.isArray(householdsValue)
            ? householdsValue[0] || null
            : householdsValue || null
          setHousehold(nextHousehold as Household | null)
          setIsLoading(false)
        }

      } catch (err) {
        if (mounted) {
          setError(err instanceof Error ? err.message : 'Failed to fetch user data')
          setIsLoading(false)
        }
      }
    }

    // Use onAuthStateChange as the sole initializer.
    // It fires INITIAL_SESSION immediately on subscribe, so no separate fetch needed.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return

      if (event === 'SIGNED_OUT') {
        // Only clear state on an explicit sign-out, never on a transient null session
        initializedRef.current = true
        setUser(null)
        setHousehold(null)
        setIsLoading(false)
        return
      }

      if (session?.user) {
        initializedRef.current = true
        setUser(session.user)
        void fetchHousehold(session.user)
      } else if (event === 'INITIAL_SESSION') {
        // INITIAL_SESSION with no session means the access token may be expired and
        // Supabase is about to attempt a silent refresh (TOKEN_REFRESHED will follow),
        // or the user is truly not logged in (SIGNED_OUT will follow).
        // Keep isLoading=true and wait — do NOT prematurely clear the user state.
        // Safety fallback: if no event follows within 5 s, stop the loading spinner.
        setTimeout(() => {
          if (mounted && !initializedRef.current) {
            initializedRef.current = true
            setIsLoading(false)
          }
        }, 5000)
      }
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])

  return { user, household, isLoading, error }
}
