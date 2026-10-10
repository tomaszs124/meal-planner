'use client'

import { useState } from 'react'
import { format } from 'date-fns'
import type { Tag } from '@/lib/supabase/client'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import MealDetailsModal from '@/components/MealPlanner/MealDetailsModal'
import CustomLists from '@/components/ShoppingList/CustomLists'
import type { GroupBy, ModalMeal, ShoppingListMeal } from './types'
import { getPurchaseProgress, getRelatedMeals, groupItems } from './shoppingListUtils'
import { useHouseholdMembers } from './useHouseholdMembers'
import { useShoppingList } from './useShoppingList'
import GenerateListPanel from './GenerateListPanel'
import GroupedItemRow from './GroupedItemRow'
import CategoryView from './CategoryView'
import DishView from './DishView'
import RelatedMeals from './RelatedMeals'
import { ShoppingListSkeleton } from '@/components/ui/Skeleton'
import { PageHeader } from '@/components/Layout/PageShell'
import Button from '@/components/ui/Button'

export default function ShoppingListEnhanced() {
  const { user, household, isLoading: userLoading } = useCurrentUser()
  const { householdMembers, selectedMembers, toggleMember, getMemberDisplayNameByUserId } = useHouseholdMembers(household, user)
  const {
    items,
    isGenerating,
    showGenerateSuccess,
    mealServingsById,
    generatedRange,
    updatingServingsKey,
    generateFromMealPlans,
    toggleGroupedItem,
    toggleSingleItem,
    deleteGroupedItem,
    clearCheckedItems,
    deleteMealGroup,
    updateMealServings,
  } = useShoppingList(household, user)
  const [startDate, setStartDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [groupBy, setGroupBy] = useState<GroupBy>('category')
  const [modalMeal, setModalMeal] = useState<ModalMeal | null>(null)
  const [modalVariantUserId, setModalVariantUserId] = useState<string | null>(null)
  const [activeProductTooltip, setActiveProductTooltip] = useState<string | null>(null)
  // One expanded row (details + delete) at a time, across all three views
  const [expandedRowKey, setExpandedRowKey] = useState<string | null>(null)
  const [editingServings, setEditingServings] = useState<Record<string, string>>({})
  // The generate panel is the first thing on an empty list; once a list exists it hides behind a header button
  const [showGenerate, setShowGenerate] = useState<boolean | null>(null)
  const generateOpen = showGenerate ?? items.length === 0

  function openMealModal(meal: ShoppingListMeal, sourceUserId: string | null) {
    setModalMeal({
      ...meal,
      tags: meal.tags?.map((t) => t.tags).filter(Boolean) as Tag[] | undefined,
    })
    setModalVariantUserId(sourceUserId)
  }

  if (userLoading) {
    return (
      <ShoppingListSkeleton />
    )
  }

  if (!household) {
    return (
      <div className="bg-yellow-50 dark:bg-yellow-950 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 text-sm text-yellow-800 dark:text-yellow-200">
        Musisz najpierw dołączyć do gospodarstwa.
      </div>
    )
  }

  const progress = getPurchaseProgress(items)

  return (
    <div className="space-y-6">
      <PageHeader
        title="Lista zakupów"
        subtitle="Generuj listę z planów posiłków lub dodawaj własne produkty"
        actions={
          <Button
            variant={generateOpen ? 'secondary' : 'primary'}
            onClick={() => setShowGenerate(!generateOpen)}
            aria-expanded={generateOpen}
          >
            {generateOpen ? 'Ukryj generowanie' : 'Generuj z planu'}
          </Button>
        }
      />

      {generateOpen && <GenerateListPanel
        startDate={startDate}
        endDate={endDate}
        onStartChange={setStartDate}
        onEndChange={setEndDate}
        generatedRange={generatedRange}
        householdMembers={householdMembers}
        selectedMembers={selectedMembers}
        toggleMember={toggleMember}
        currentUserId={user?.id}
        isGenerating={isGenerating}
        showGenerateSuccess={showGenerateSuccess}
        onGenerate={() => generateFromMealPlans(selectedMembers, startDate, endDate)}
      />}

      {/* View options */}
      <div role="group" aria-label="Widok listy" className="grid grid-cols-3 gap-1 rounded-lg bg-gray-100 dark:bg-gray-700 p-1">
        {([
          ['category', 'Kategorie'],
          ['dish', 'Dania'],
          ['product', 'Produkty'],
        ] as [GroupBy, string][]).map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => setGroupBy(value)}
            aria-pressed={groupBy === value}
            className={`rounded-md px-3 py-2 text-sm font-medium transition-colors ${
              groupBy === value ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 shadow-sm' : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Shopping list items */}
      <div className="space-y-4">
        {items.length === 0 ? (
          <div className="bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 p-8 text-center">
            <p className="text-gray-500 dark:text-gray-400 text-sm">Brak produktów na liście zakupów</p>
            <p className="text-gray-400 dark:text-gray-500 text-xs mt-1">Wygeneruj listę z planów posiłków lub dodaj produkty ręcznie</p>
          </div>
        ) : (
          <>
            {groupBy === 'category' ? (
              <CategoryView
                items={items}
                expandedRowKey={expandedRowKey}
                setExpandedRowKey={setExpandedRowKey}
                activeProductTooltip={activeProductTooltip}
                setActiveProductTooltip={setActiveProductTooltip}
                toggleGroupedItem={toggleGroupedItem}
                deleteGroupedItem={deleteGroupedItem}
                onOpenMeal={openMealModal}
                getMemberDisplayNameByUserId={getMemberDisplayNameByUserId}
              />
            ) : groupBy === 'product' ? (
              // Show all items grouped
              <div className="space-y-2">
                {groupItems(items).map((groupedItem) => {
                  const isExpanded = expandedRowKey === groupedItem.key
                  return (
                    <GroupedItemRow
                      key={groupedItem.key}
                      groupedItem={groupedItem}
                      isExpanded={isExpanded}
                      onToggleExpanded={() => setExpandedRowKey(isExpanded ? null : groupedItem.key)}
                      activeProductTooltip={activeProductTooltip}
                      setActiveProductTooltip={setActiveProductTooltip}
                      onToggle={toggleGroupedItem}
                      onDelete={deleteGroupedItem}
                      details={
                        isExpanded && (
                          <RelatedMeals
                            meals={getRelatedMeals(items, groupedItem)}
                            onOpenMeal={openMealModal}
                            getMemberDisplayNameByUserId={getMemberDisplayNameByUserId}
                          />
                        )
                      }
                    />
                  )
                })}
              </div>
            ) : (
              // Group by dish (meal)
              <DishView
                items={items}
                mealServingsById={mealServingsById}
                editingServings={editingServings}
                setEditingServings={setEditingServings}
                updatingServingsKey={updatingServingsKey}
                updateMealServings={updateMealServings}
                deleteMealGroup={deleteMealGroup}
                toggleSingleItem={toggleSingleItem}
                toggleGroupedItem={toggleGroupedItem}
                deleteGroupedItem={deleteGroupedItem}
                expandedRowKey={expandedRowKey}
                setExpandedRowKey={setExpandedRowKey}
                activeProductTooltip={activeProductTooltip}
                setActiveProductTooltip={setActiveProductTooltip}
                onOpenMeal={openMealModal}
                getMemberDisplayNameByUserId={getMemberDisplayNameByUserId}
              />
            )}

            {/* Progress + "Usuń kupione": sticks above the bottom navigation while the list scrolls */}
            <div className="sticky bottom-24 z-30 flex items-center justify-between gap-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-white/95 dark:bg-gray-800/95 px-4 py-2.5 shadow-md backdrop-blur-sm">
              <span className="text-sm text-gray-600 dark:text-gray-400">
                Kupione{' '}
                <span className="font-semibold text-gray-900 dark:text-gray-100 tabular-nums">
                  {progress.bought} / {progress.total}
                </span>
              </span>
              <Button variant="danger" size="sm" onClick={clearCheckedItems} disabled={!progress.anyChecked}>
                Usuń kupione
              </Button>
            </div>
          </>
        )}
      </div>

      {/* Custom Lists */}
      <div className="bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
        <CustomLists />
      </div>

      {/* Meal details modal */}
      <MealDetailsModal
        isOpen={modalMeal !== null}
        onClose={() => { setModalMeal(null); setModalVariantUserId(null) }}
        meal={modalMeal}
        userId={user?.id}
        householdId={household?.id}
        showVariantSelector={false}
        initialVariantUserId={modalVariantUserId}
      />
    </div>
  )
}
