import Image from 'next/image'
import type { MealWithItems } from './types'

// One meal tile in the accordion grid: image, name, tags and one line of nutrition totals
export default function MealCard({
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
      className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden cursor-pointer hover:shadow-lg hover:border-gray-300 transition-all duration-200 flex flex-col h-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
    >
      {/* Image */}
      {meal.images && meal.images.length > 0 ? (
        <Image
          src={meal.images[0].image_url}
          alt={meal.name}
          width={512}
          height={128}
          className="w-full h-32 object-cover"
        />
      ) : (
        <div className="w-full h-32 bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
          <svg className="w-8 h-8 text-gray-400 dark:text-gray-500" aria-hidden="true" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        </div>
      )}
      {/* Content */}
      <div className="p-3 flex flex-col flex-grow">
        <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-2 line-clamp-2">{meal.name}</h3>
        {/* Tags */}
        {meal.tags && meal.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-2">
            {meal.tags.slice(0, 2).map((tag) => (
              <span
                key={tag.id}
                className="px-2 py-0.5 rounded-full text-xs font-medium"
                style={{ backgroundColor: tag.color, color: tag.text_color }}
              >
                {tag.name}
              </span>
            ))}
          </div>
        )}
        {/* Nutrition: one quiet line */}
        <p className="mt-auto text-xs text-gray-500 dark:text-gray-400">
          <span className="font-medium text-gray-700 dark:text-gray-300">{Math.round(meal.totalKcal)} kcal</span>
          {` · B ${Math.round(meal.totalProtein)} g · T ${Math.round(meal.totalFat)} g · W ${Math.round(meal.totalCarbs)} g`}
        </p>
      </div>
    </div>
  )
}
