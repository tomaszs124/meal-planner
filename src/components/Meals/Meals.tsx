'use client'

import { useState } from 'react'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { useProducts } from '@/hooks/useProducts'
import TagManagement from './TagManagement'
import MealAccordionList from './MealAccordionList'
import MealDetailsWithActions from './MealDetailsWithActions'
import MealFilters from './MealFilters'
import MealForm from './MealForm'
import EditMealModal from './EditMealModal'
import { useMeals } from './useMeals'
import { useMealFilters } from './useMealFilters'
import { loadMealIntoForm, useMealFormState } from './useMealForm'
import type { MealWithItems } from './types'
import { MealsListSkeleton } from '@/components/ui/Skeleton'

export default function Meals() {
  const { user, household, isLoading: userLoading } = useCurrentUser()
  const { products } = useProducts(household?.id)
  const { meals, tags, householdMembers, isLoading, isAdding, isUploadingImage, addMeal, updateMeal, deleteMeal } =
    useMeals(household?.id, user?.id, products)
  const filters = useMealFilters(meals)
  const [showTagManagement, setShowTagManagement] = useState(false)
  const [selectedMeal, setSelectedMeal] = useState<MealWithItems | null>(null)
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false)

  // Add form state
  const addForm = useMealFormState()
  const [showAddForm, setShowAddForm] = useState(false)

  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null)
  const editForm = useMealFormState()

  // Add new meal
  function handleAddSubmit(e: React.FormEvent) {
    e.preventDefault()
    addMeal(addForm, () => {
      addForm.reset()
      setShowAddForm(false)
    })
  }

  // Start editing a meal
  function startEdit(meal: MealWithItems) {
    setEditingId(meal.id)
    loadMealIntoForm(editForm, meal)
  }

  // Cancel editing
  function cancelEdit() {
    setEditingId(null)
    editForm.reset()
  }

  if (userLoading || isLoading) {
    return (
      <div className="max-w-4xl mx-auto p-4">
        <MealsListSkeleton />
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

  const { filteredMeals, selectedCategories, setSelectedTags, setSearchQuery } = filters

  return (
    <div className="max-w-4xl mx-auto p-4 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Posiłki</h2>
          <p className="text-sm text-gray-500 mt-1">Twórz przepisy z produktów</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowTagManagement(!showTagManagement)}
            className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-semibold text-white hover:bg-purple-500 transition-colors"
          >
            {showTagManagement ? 'Ukryj' : 'Zarządzaj tagami'}
          </button>
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 transition-colors"
          >
            {showAddForm ? 'Anuluj' : 'Dodaj posiłek'}
          </button>
        </div>
      </div>

      {/* Tag Management */}
      {showTagManagement && (
        <TagManagement />
      )}

      {/* Search and filter */}
      <MealFilters filters={filters} tags={tags} />

      {/* Add meal form */}
      {showAddForm && (
        <MealForm
          mode="add"
          form={addForm}
          products={products}
          tags={tags}
          householdMembers={householdMembers}
          currentUserId={user?.id}
          isAdding={isAdding}
          isUploadingImage={isUploadingImage}
          onSubmit={handleAddSubmit}
        />
      )}

      {/* Meals list - Grid view */}
      <div>
        {meals.length === 0 ? (
          <div className="bg-gray-50 rounded-lg border border-gray-200 p-8 text-center">
            <p className="text-gray-500 text-sm">Brak posiłków</p>
            <p className="text-gray-400 text-xs mt-1">Dodaj pierwszy posiłek powyżej</p>
          </div>
        ) : filteredMeals.length === 0 ? (
          <div className="bg-gray-50 rounded-lg border border-gray-200 p-8 text-center">
            <p className="text-gray-500 text-sm">Brak posiłków pasujących do filtrów</p>
            <button
              onClick={() => {
                setSelectedTags([])
                setSearchQuery('')
              }}
              className="mt-2 text-sm text-blue-600 hover:text-blue-700 font-medium"
            >
              Wyczyść filtry
            </button>
          </div>
        ) : (
          <MealAccordionList
            filteredMeals={filteredMeals}
            selectedCategories={selectedCategories}
            onMealClick={(meal) => { setSelectedMeal(meal); setIsDetailModalOpen(true) }}
          />
        )}
      </div>

      {/* Detail Modal + Edit/Delete footer */}
      <MealDetailsWithActions
        isOpen={isDetailModalOpen}
        meal={selectedMeal}
        userId={user?.id}
        householdId={household?.id}
        onClose={() => {
          setIsDetailModalOpen(false)
          setSelectedMeal(null)
        }}
        onEdit={(meal) => {
          setIsDetailModalOpen(false)
          startEdit(meal)
        }}
        onDelete={(meal) => {
          setIsDetailModalOpen(false)
          deleteMeal(meal.id)
        }}
      />

      {/* Edit Modal - shown when editing */}
      {editingId && (
        <EditMealModal
          form={editForm}
          products={products}
          tags={tags}
          householdMembers={householdMembers}
          currentUserId={user?.id}
          isAdding={isAdding}
          isUploadingImage={isUploadingImage}
          onSubmit={(e) => { e.preventDefault(); updateMeal(editingId, editForm, cancelEdit) }}
          onCancel={cancelEdit}
        />
      )}

      {/* Stats */}
      {meals.length > 0 && (
        <div className="bg-gray-50 rounded-lg border border-gray-200 p-4 text-center text-sm text-gray-600">
          Wszystkich posiłków: <span className="font-semibold text-gray-900">{meals.length}</span>
        </div>
      )}
    </div>
  )
}
