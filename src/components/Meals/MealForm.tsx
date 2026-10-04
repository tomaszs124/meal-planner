'use client'

import Image from 'next/image'
import type { MealCategory, Product, Tag } from '@/lib/supabase/client'
import { useFeedback } from '@/components/ui/Feedback'
import { MEAL_CATEGORIES } from './mealHelpers'
import { handleImageChange, type MealFormState } from './useMealForm'
import ProductSelectionList from './ProductSelectionList'
import MemberOverridesEditor from './MemberOverridesEditor'
import type { HouseholdMember, MealFormMode } from './types'

/**
 * Meal form shared by "add" (inline card) and "edit" (inside EditMealModal).
 * The two modes keep their historical differences: field ids, disabled states,
 * image hints / remove button, category block (position and markup), tag hint and footer.
 */
export default function MealForm({
  mode,
  form,
  products,
  tags,
  householdMembers,
  currentUserId,
  isAdding,
  isUploadingImage,
  onSubmit,
  onCancel,
}: {
  mode: MealFormMode
  form: MealFormState
  products: Product[]
  tags: Tag[]
  householdMembers: HouseholdMember[]
  currentUserId: string | undefined
  isAdding: boolean
  isUploadingImage: boolean
  onSubmit: (e: React.FormEvent) => void
  onCancel?: () => void
}) {
  const { toast } = useFeedback()
  const isAdd = mode === 'add'

  return (
    <form
      onSubmit={onSubmit}
      className={isAdd ? 'bg-white rounded-lg shadow-sm border border-gray-200 p-4 space-y-4' : 'p-6 space-y-4'}
    >
      <div>
        <label htmlFor={isAdd ? 'meal-name' : 'edit-meal-name'} className="block text-sm font-medium text-gray-700 mb-1">
          Nazwa posiłku
        </label>
        <input
          id={isAdd ? 'meal-name' : 'edit-meal-name'}
          type="text"
          value={form.name}
          onChange={(e) => form.setName(e.target.value)}
          placeholder={isAdd ? 'Nazwa posiłku' : undefined}
          disabled={isAdd ? isAdding : undefined}
          className={isAdd
            ? 'w-full rounded-lg border border-gray-300 px-4 py-2 text-sm text-black focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100'
            : 'w-full rounded-lg border border-gray-300 px-4 py-2 text-sm text-black focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500'}
          required
        />
      </div>

      <div>
        <label htmlFor={isAdd ? 'meal-description' : 'edit-meal-description'} className="block text-sm font-medium text-gray-700 mb-1">
          Opis / Przepis
        </label>
        <textarea
          id={isAdd ? 'meal-description' : 'edit-meal-description'}
          value={form.description}
          onChange={(e) => form.setDescription(e.target.value)}
          placeholder="Przepis krok po kroku..."
          rows={4}
          disabled={isAdd ? isAdding : undefined}
          className={isAdd
            ? 'w-full rounded-lg border border-gray-300 px-4 py-2 text-sm text-black focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 resize-vertical'
            : 'w-full rounded-lg border border-gray-300 px-4 py-2 text-sm text-black focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-vertical'}
        />
      </div>

      <div>
        <label htmlFor={isAdd ? 'meal-image' : 'edit-meal-image'} className="block text-sm font-medium text-gray-700 mb-1">
          Zdjęcie posiłku
        </label>
        <input
          id={isAdd ? 'meal-image' : 'edit-meal-image'}
          type="file"
          accept="image/jpeg,image/jpg,image/png,image/webp,image/gif"
          onChange={(e) => handleImageChange(e.target.files?.[0] || null, form, toast)}
          disabled={isAdd ? isAdding || isUploadingImage : isUploadingImage}
          className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm text-black focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
        />
        <p className="text-xs text-gray-500 mt-1">
          {isAdd ? 'Maksymalny rozmiar: 5MB. Formaty: JPG, PNG, WebP, GIF' : 'Jeśli nie wybierzesz nowego zdjęcia, pozostanie obecne.'}
        </p>
        {form.imagePreview && (
          <div className="mt-2 relative">
            <Image
              src={form.imagePreview}
              alt="Podgląd zdjęcia posiłku"
              width={800}
              height={320}
              className="w-full h-48 object-cover rounded-lg border border-gray-200"
            />
            {isAdd ? (
              <button
                type="button"
                onClick={() => {
                  form.setImageFile(null)
                  form.setImagePreview(null)
                }}
                disabled={isAdding}
                aria-label="Usuń zdjęcie"
                className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            ) : form.imageFile && (
              <button
                type="button"
                onClick={() => {
                  form.setImageFile(null)
                  form.setImagePreview(form.imageOriginalUrl)
                }}
                aria-label="Cofnij wybór nowego zdjęcia"
                className="absolute top-2 right-2 bg-gray-800/80 text-white rounded-full p-1 hover:bg-gray-900 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Edit mode: categories come right after the image */}
      {!isAdd && (
        <>
          <div>
            <label htmlFor="edit-primary-category" className="block text-sm font-medium text-gray-700 mb-2">Kategoria główna</label>
            <select
              id="edit-primary-category"
              value={form.primaryCategory}
              onChange={(e) => form.setPrimaryCategory((e.target.value as MealCategory) || '')}
              className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm text-black focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            >
              <option value="">Wybierz kategorię...</option>
              {MEAL_CATEGORIES.map((cat) => (
                <option key={cat.value} value={cat.value}>
                  {cat.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Kategorie alternatywne</label>
            <div role="group" aria-label="Kategorie alternatywne" className="space-y-2">
              {MEAL_CATEGORIES.map((cat) => (
                <label key={cat.value} className="flex items-center">
                  <input
                    type="checkbox"
                    checked={form.alternativeCategories.includes(cat.value)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        form.setAlternativeCategories([...form.alternativeCategories, cat.value])
                      } else {
                        form.setAlternativeCategories(form.alternativeCategories.filter((c) => c !== cat.value))
                      }
                    }}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 mr-2"
                  />
                  <span className="text-sm text-gray-700">{cat.label}</span>
                </label>
              ))}
            </div>
          </div>
        </>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Tagi</label>
        {tags.length === 0 ? (
          <p className="text-sm text-gray-500">
            {isAdd ? 'Brak dostępnych tagów. Dodaj nowe w sekcji zarządzania tagami poniżej.' : 'Brak dostępnych tagów.'}
          </p>
        ) : (
          <div role="group" aria-label="Tagi" className="flex flex-wrap gap-2">
            {tags.map((tag) => (
              <label
                key={tag.id}
                className={`px-3 py-1.5 rounded-full text-sm font-medium cursor-pointer transition-all ${
                  form.tags.includes(tag.id)
                    ? 'ring-2 ring-offset-2 ring-blue-500'
                    : 'opacity-60 hover:opacity-100'
                }`}
                style={{
                  backgroundColor: tag.color,
                  color: tag.text_color
                }}
              >
                <input
                  type="checkbox"
                  checked={form.tags.includes(tag.id)}
                  onChange={(e) => {
                    if (e.target.checked) {
                      form.setTags([...form.tags, tag.id])
                    } else {
                      form.setTags(form.tags.filter((id) => id !== tag.id))
                    }
                  }}
                  disabled={isAdd ? isAdding : undefined}
                  className="sr-only"
                />
                {tag.name}
              </label>
            ))}
          </div>
        )}
      </div>

      <ProductSelectionList
        products={products}
        selectedProducts={form.selectedProducts}
        setSelectedProducts={form.setSelectedProducts}
      />

      {/* Add mode: categories come after the products, in their own section */}
      {isAdd && (
        <div className="space-y-4 border-t border-gray-200 pt-4">
          <h3 className="text-sm font-semibold text-gray-900">Kategorie posiłku</h3>

          {/* Primary category */}
          <div>
            <label htmlFor="primary-category" className="block text-sm font-medium text-gray-700 mb-2">
              Kategoria główna
            </label>
            <select
              id="primary-category"
              value={form.primaryCategory}
              onChange={(e) => form.setPrimaryCategory(e.target.value as MealCategory | '')}
              className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm text-black focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Brak kategorii</option>
              {MEAL_CATEGORIES.map((cat) => (
                <option key={cat.value} value={cat.value}>
                  {cat.label}
                </option>
              ))}
            </select>
          </div>

          {/* Alternative categories */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Kategorie alternatywne
            </label>
            <div role="group" aria-label="Kategorie alternatywne" className="space-y-2">
              {MEAL_CATEGORIES.map((cat) => (
                <label key={cat.value} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={form.alternativeCategories.includes(cat.value)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        form.setAlternativeCategories([...form.alternativeCategories, cat.value])
                      } else {
                        form.setAlternativeCategories(form.alternativeCategories.filter(c => c !== cat.value))
                      }
                    }}
                    className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">{cat.label}</span>
                </label>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Member-specific overrides */}
      <MemberOverridesEditor
        products={products}
        householdMembers={householdMembers}
        currentUserId={currentUserId}
        baseProducts={form.selectedProducts}
        overrides={form.memberOverrides}
        setOverrides={form.setMemberOverrides}
        isAdding={isAdding}
        addButtonDisabled={isAdd ? isAdding : undefined}
      />

      {isAdd ? (
        <button
          type="submit"
          disabled={isAdding || !form.name.trim() || form.selectedProducts.length === 0}
          className="w-full rounded-lg bg-blue-600 px-6 py-2 text-sm font-semibold text-white hover:bg-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
        >
          {isAdding ? 'Zapisywanie...' : 'Zapisz posiłek'}
        </button>
      ) : (
        <div className="flex gap-2 pt-4 border-t border-gray-200">
          <button
            type="submit"
            disabled={!form.name.trim() || form.selectedProducts.length === 0}
            className="flex-1 rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-500 focus:outline-none focus:ring-2 focus:ring-green-500 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
          >
            Zapisz posiłek
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 rounded-lg bg-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-300 transition-colors"
          >
            Anuluj
          </button>
        </div>
      )}
    </form>
  )
}
