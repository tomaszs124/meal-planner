import Image from 'next/image'
import { translateCategory } from './mealHelpers'
import type { MealWithItems } from './types'

// One meal tile in the accordion grid: image, categories, tags and nutrition totals
export default function MealCard({
  meal,
  onClick,
}: {
  meal: MealWithItems
  onClick: (meal: MealWithItems) => void
}) {
  return (
    <div
      onClick={() => onClick(meal)}
      className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden cursor-pointer hover:shadow-lg hover:border-gray-300 transition-all duration-200 flex flex-col h-full"
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
        <div className="w-full h-32 bg-gray-100 flex items-center justify-center">
          <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        </div>
      )}
      {/* Content */}
      <div className="p-3 flex flex-col flex-grow">
        <h3 className="font-semibold text-gray-900 mb-2 line-clamp-2">{meal.name}</h3>
        {/* Categories */}
        {(meal.primary_category || (meal.alternative_categories && meal.alternative_categories.length > 0)) && (
          <div className="flex flex-wrap gap-1 mb-2">
            {meal.primary_category && (
              <span className="bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded text-xs font-semibold">
                {translateCategory(meal.primary_category)}
              </span>
            )}
            {meal.alternative_categories && meal.alternative_categories.slice(0, 1).map((cat) => (
              <span key={cat} className="bg-gray-100 text-gray-700 px-2 py-0.5 rounded text-xs">
                {translateCategory(cat)}
              </span>
            ))}
          </div>
        )}
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
        {/* Nutrition */}
        <div className="flex flex-wrap gap-1 mt-auto">
          <span className="bg-blue-100 text-blue-800 px-2 py-0.5 rounded text-xs font-semibold">
            {Math.round(meal.totalKcal)} kcal
          </span>
          {meal.totalProtein > 0 && (
            <span className="bg-green-100 text-green-800 px-2 py-0.5 rounded text-xs">
              B:{meal.totalProtein.toFixed(0)}g
            </span>
          )}
          {meal.totalFat > 0 && (
            <span className="bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded text-xs">
              T:{meal.totalFat.toFixed(0)}g
            </span>
          )}
          {meal.totalCarbs > 0 && (
            <span className="bg-orange-100 text-orange-800 px-2 py-0.5 rounded text-xs">
              W:{meal.totalCarbs.toFixed(0)}g
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
