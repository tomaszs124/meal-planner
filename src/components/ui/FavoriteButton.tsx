'use client'

import { supabase } from '@/lib/supabase/client'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { useFeedback } from '@/components/ui/Feedback'
import { toggleFavorite, useFavoriteIds } from '@/lib/favorites'

/** Filled when the meal is a favourite. Used as a plain indicator (`readOnly`) on rows that are buttons themselves. */
export function HeartIcon({ filled, className = 'h-5 w-5' }: { filled: boolean; className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth={filled ? 0 : 1.8}
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 21s-6.716-4.35-9.192-8.25C.5 9.1 2.3 4.5 6.6 4.5c2.2 0 3.6 1.2 5.4 3 1.8-1.8 3.2-3 5.4-3 4.3 0 6.1 4.6 3.8 8.25C18.716 16.65 12 21 12 21z"
      />
    </svg>
  )
}

/**
 * The heart. Toggles the signed-in user's favourite for a meal (optimistic, see
 * src/lib/favorites.ts). `size="sm"` for list rows, `md` for modal headers.
 */
export default function FavoriteButton({
  mealId,
  mealName,
  size = 'sm',
  className = '',
}: {
  mealId: string
  mealName: string
  size?: 'sm' | 'md'
  className?: string
}) {
  const { user } = useCurrentUser()
  const { toast } = useFeedback()
  const favorites = useFavoriteIds()
  const active = favorites.has(mealId)

  async function onToggle(e: React.MouseEvent) {
    e.stopPropagation()
    if (!user?.id) return
    const result = await toggleFavorite(supabase, user.id, mealId)
    if (result === null) toast('Nie udało się zapisać ulubionego', { type: 'error' })
  }

  const box = size === 'md' ? 'h-9 w-9' : 'h-8 w-8'
  const icon = size === 'md' ? 'h-5 w-5' : 'h-4 w-4'

  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={active}
      aria-label={active ? `Usuń ${mealName} z ulubionych` : `Dodaj ${mealName} do ulubionych`}
      title={active ? 'Ulubione' : 'Dodaj do ulubionych'}
      className={`flex ${box} shrink-0 items-center justify-center rounded-full transition-[color,transform,background-color] active:scale-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${
        active
          ? 'text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/50'
          : 'text-gray-300 hover:bg-gray-100 hover:text-rose-400 dark:text-gray-600 dark:hover:bg-gray-700 dark:hover:text-rose-400'
      } ${className}`}
    >
      <HeartIcon filled={active} className={icon} />
    </button>
  )
}
