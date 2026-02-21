import { useEffect, useState } from 'react'
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

  useEffect(() => {
    let mounted = true

    async function fetchUserAndHousehold() {
      try {
        setIsLoading(true)
        setError(null)

        // Get current user from Supabase Auth
        const { data: { user: currentUser }, error: userError } = await supabase.auth.getUser()

        if (userError) {
          throw userError
        }

        if (!currentUser) {
          if (mounted) {
            setUser(null)
            setHousehold(null)
            setIsLoading(false)
          }
          return
        }

        if (mounted) {
          setUser(currentUser)
        }

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
          setHousehold(householdData?.households as Household || null)
          setIsLoading(false)
        }

      } catch (err) {
        if (mounted) {
          setError(err instanceof Error ? err.message : 'Failed to fetch user data')
          setIsLoading(false)
        }
      }
    }

    fetchUserAndHousehold()

    // Listen to auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        fetchUserAndHousehold()
      } else {
        setUser(null)
        setHousehold(null)
        setIsLoading(false)
      }
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])

  return { user, household, isLoading, error }
}
