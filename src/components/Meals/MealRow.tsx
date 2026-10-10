import Image from 'next/image'
import type { MealWithItems } from './types'

/**
 * Compact list row used on phones instead of the card grid: 56 px thumbnail, the full
 * meal name (two lines), tags and one quiet nutrition line. Same look as the day list
 * on the dashboard so the app reads as one system.
 */
export default function MealRow({
  meal,
  onClick,
}: {
  meal: MealWithItems
  onClick: (meal: MealWithItems) => void
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onClick(meal)}
      onKeyDown={(e) => {
        if (e.target !== e.currentTarget || e.repeat) return
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onClick(meal)
        }
      }}
      className="flex cursor-pointer items-center gap-3 px-3 py-2.5 transition-colors hover:bg-gray-50 dark:hover:bg-gray-700/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-500"
    >
      {meal.images && meal.images.length > 0 ? (
        <Image
          src={meal.images[0].image_url}
          alt=""
          width={112}
          height={112}
          className="h-14 w-14 shrink-0 rounded-lg object-cover"
        />
      ) : (
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-gray-100 dark:bg-gray-700">
          <svg className="h-6 w-6 text-gray-400 dark:text-gray-500" aria-hidden="true" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        </div>
      )}
      <div className="min-w-0 flex-1">
        <h3 className="line-clamp-2 text-sm font-semibold leading-snug text-gray-900 dark:text-gray-100">{meal.name}</h3>
        <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
          <span className="font-medium text-gray-700 dark:text-gray-300">{Math.round(meal.totalKcal)} kcal</span>
          {` · B ${Math.round(meal.totalProtein)} · T ${Math.round(meal.totalFat)} · W ${Math.round(meal.totalCarbs)} g`}
        </p>
        {meal.tags && meal.tags.length > 0 && (
          <div className="mt-1 flex flex-wrap gap-1">
            {meal.tags.slice(0, 3).map((tag) => (
              <span
                key={tag.id}
                className="rounded-full px-1.5 py-px text-[10px] font-medium"
                style={{ backgroundColor: tag.color, color: tag.text_color }}
              >
                {tag.name}
              </span>
            ))}
          </div>
        )}
      </div>
      <svg className="h-4 w-4 shrink-0 text-gray-300 dark:text-gray-600" aria-hidden="true" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
      </svg>
    </div>
  )
}
