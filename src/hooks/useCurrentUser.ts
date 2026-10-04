import { useContext } from 'react'
import { CurrentUserContext, type CurrentUserContextValue } from '@/components/Auth/CurrentUserProvider'

type UseCurrentUserReturn = CurrentUserContextValue

/**
 * Current Supabase user and their household.
 *
 * Backed by the single `CurrentUserProvider` mounted in `src/app/layout.tsx`,
 * so all callers share one auth subscription and one household query.
 * Throws when rendered outside the provider.
 */
export function useCurrentUser(): UseCurrentUserReturn {
  const context = useContext(CurrentUserContext)
  if (!context) {
    throw new Error(
      'useCurrentUser() must be used inside <CurrentUserProvider> (mounted in src/app/layout.tsx).',
    )
  }
  return context
}
