'use client'

import { useState } from 'react'
import { format } from 'date-fns'
import type { Tag } from '@/lib/supabase/client'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import MealDetailsModal from '@/components/MealPlanner/MealDetailsModal'
import CustomLists from '@/components/ShoppingList/CustomLists'
import type { GroupBy, ModalMeal, ShoppingListMeal } from './types'
import { groupItems } from './shoppingListUtils'
import { useHouseholdMembers } from './useHouseholdMembers'
import { useShoppingList } from './useShoppingList'
import GenerateListPanel from './GenerateListPanel'
import GroupedItemRow from './GroupedItemRow'
import CategoryView from './CategoryView'
import DishView from './DishView'
import { ShoppingListSkeleton } from '@/components/ui/Skeleton'

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
  const [expandedCategoryGroupKey, setExpandedCategoryGroupKey] = useState<string | null>(null)
  const [editingServings, setEditingServings] = useState<Record<string, string>>({})

  function openMealModal(meal: ShoppingListMeal, sourceUserId: string | null) {
    setModalMeal({
      ...meal,
      tags: meal.tags?.map((t) => t.tags).filter(Boolean) as Tag[] | undefined,
    })
    setModalVariantUserId(sourceUserId)
  }

  if (userLoading) {
    return (
      <div className="max-w-4xl mx-auto p-4">
        <ShoppingListSkeleton />
      </div>
    )
  }

  if (!household) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-sm text-yellow-800">
        Musisz najpierw dołączyć do gospodarstwa.
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto p-4 space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Lista zakupów</h2>
        <p className="text-sm text-gray-500 mt-1">
          Generuj listę z planów posiłków lub dodawaj własne produkty
        </p>
      </div>

      <GenerateListPanel
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
      />

      {/* View options */}
      <div className="flex items-center justify-between bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <div className="flex gap-2">
          <button
            onClick={() => setGroupBy('category')}
            aria-pressed={groupBy === 'category'}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              groupBy === 'category'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Wg kategorii
          </button>
          <button
            onClick={() => setGroupBy('dish')}
            aria-pressed={groupBy === 'dish'}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              groupBy === 'dish'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Wg dania
          </button>
          <button
            onClick={() => setGroupBy('product')}
            aria-pressed={groupBy === 'product'}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              groupBy === 'product'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Wszystkie produkty
          </button>
        </div>
      </div>

      {/* Shopping list items */}
      <div className="space-y-4">
        {items.length === 0 ? (
          <div className="bg-gray-50 rounded-lg border border-gray-200 p-8 text-center">
            <p className="text-gray-500 text-sm">Brak produktów na liście zakupów</p>
            <p className="text-gray-400 text-xs mt-1">Wygeneruj listę z planów posiłków lub dodaj produkty ręcznie</p>
          </div>
        ) : (
          <>
            {groupBy === 'category' ? (
              <CategoryView
                items={items}
                expandedCategoryGroupKey={expandedCategoryGroupKey}
                setExpandedCategoryGroupKey={setExpandedCategoryGroupKey}
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
                {groupItems(items).map((groupedItem) => (
                  <GroupedItemRow
                    key={groupedItem.key}
                    groupedItem={groupedItem}
                    className={`bg-white rounded-lg shadow-sm border border-gray-200 p-4 flex items-center gap-3 transition-opacity ${
                      groupedItem.allChecked ? 'opacity-60' : 'opacity-100'
                    }`}
                    activeProductTooltip={activeProductTooltip}
                    setActiveProductTooltip={setActiveProductTooltip}
                    onToggle={toggleGroupedItem}
                    onDelete={deleteGroupedItem}
                  />
                ))}
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
                onOpenMeal={openMealModal}
                getMemberDisplayNameByUserId={getMemberDisplayNameByUserId}
              />
            )}
          </>
        )}
      </div>

      <div className="flex justify-end">
        <button
          onClick={clearCheckedItems}
          disabled={items.filter(i => i.is_checked).length === 0}
          className="px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:text-gray-400 disabled:hover:bg-transparent"
        >
          Usuń zaznaczone
        </button>
      </div>

      {/* Stats */}
      {items.length > 0 && (
        <div className="bg-gray-50 rounded-lg border border-gray-200 p-4 flex justify-between text-sm">
          <span className="text-gray-600">
            Produktów: <span className="font-semibold text-gray-900">{groupItems(items).length}</span>
          </span>
          <span className="text-gray-600">
            Kupionych: <span className="font-semibold text-gray-900">{groupItems(items).filter((i) => i.allChecked).length}</span>
          </span>
          <span className="text-gray-600">
            Pozostało: <span className="font-semibold text-gray-900">{groupItems(items).filter((i) => !i.allChecked).length}</span>
          </span>
        </div>
      )}

      {/* Custom Lists */}
      <div className="bg-gray-50 rounded-lg border border-gray-200 p-4">
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
