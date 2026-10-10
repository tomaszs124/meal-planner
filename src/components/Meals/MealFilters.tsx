import type { Tag } from '@/lib/supabase/client'
import { MEAL_CATEGORIES } from './mealHelpers'
import Button from '@/components/ui/Button'
import type { MealFiltersState } from './useMealFilters'

// Search box + meal type + tag filter card
export default function MealFilters({ filters, tags }: { filters: MealFiltersState; tags: Tag[] }) {
  const {
    searchQuery,
    setSearchQuery,
    selectedCategories,
    setSelectedCategories,
    selectedTags,
    setSelectedTags,
    toggleCategoryFilter,
    toggleTagFilter,
  } = filters

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4 space-y-3">
      <input
        type="search"
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        placeholder="Wyszukaj posiłek..."
        aria-label="Wyszukaj posiłek"
        className="w-full rounded-lg border border-gray-300 dark:border-gray-600 px-4 py-2 text-sm text-black dark:text-gray-100 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500"
      />

      <div>
        <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Typ posiłku:</p>
        <div className="flex flex-wrap gap-2 mb-3">
          {MEAL_CATEGORIES.map(cat => (
            <button
              key={cat.value}
              type="button"
              onClick={() => toggleCategoryFilter(cat.value)}
              aria-pressed={selectedCategories.includes(cat.value)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
                selectedCategories.includes(cat.value)
                  ? 'bg-brand-600 text-white ring-2 ring-offset-2 dark:ring-offset-gray-900 ring-brand-500'
                  : 'bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-500'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {tags.length > 0 && (
        <div>
          <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Filtruj po tagach:</p>
          <div className="flex flex-wrap gap-2">
            {tags.map(tag => (
              <button
                key={tag.id}
                type="button"
                onClick={() => toggleTagFilter(tag.id)}
                aria-pressed={selectedTags.includes(tag.id)}
                className={`px-3 py-1 rounded-full text-sm font-medium transition-all ${
                  selectedTags.includes(tag.id)
                    ? 'ring-2 ring-offset-2 dark:ring-offset-gray-900 ring-brand-500'
                    : 'opacity-60 hover:opacity-100'
                }`}
                style={{
                  backgroundColor: tag.color,
                  color: tag.text_color
                }}
              >
                {tag.name}
              </button>
            ))}
          </div>
          {selectedTags.length > 0 && (
            <Button variant="ghost" size="sm" className="mt-2" onClick={() => setSelectedTags([])}>
              Wyczyść filtry tagów
            </Button>
          )}
        </div>
      )}

      {(selectedTags.length > 0 || selectedCategories.length > 0) && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setSelectedTags([])
            setSelectedCategories([])
          }}
        >
          Wyczyść wszystkie filtry
        </Button>
      )}
    </div>
  )
}
