'use client'

import { useRef, type ReactNode } from 'react'
import Image from 'next/image'
import type { MealCategory, Product, Tag } from '@/lib/supabase/client'
import { useFeedback } from '@/components/ui/Feedback'
import Button from '@/components/ui/Button'
import { MEAL_CATEGORIES } from './mealHelpers'
import { handleImageChange, selectionTotals, type MealFormState } from './useMealForm'
import ProductSelectionList from './ProductSelectionList'
import MemberOverridesEditor from './MemberOverridesEditor'
import type { HouseholdMember, MealFormMode } from './types'

/**
 * Meal form shared by "add" and "edit", always rendered inside MealFormModal.
 * Sections: photo (hero), basics, ingredients, member variants, categories & tags.
 * The footer is sticky so "Zapisz" is always within reach.
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
  onCancel: () => void
}) {
  const { toast } = useFeedback()
  const isAdd = mode === 'add'
  const idPrefix = isAdd ? 'meal' : 'edit-meal'
  const busy = isAdding || isUploadingImage
  const fileInputRef = useRef<HTMLInputElement>(null)

  const totals = selectionTotals(form.selectedProducts, products)
  const canSubmit = !busy && !form.isLoadingItems && form.name.trim() !== '' && form.selectedProducts.length > 0
  const alternativeOptions = MEAL_CATEGORIES.filter((cat) => cat.value !== form.primaryCategory)

  function choosePrimary(value: MealCategory) {
    const next = form.primaryCategory === value ? '' : value
    form.setPrimaryCategory(next)
    if (next) form.setAlternativeCategories(form.alternativeCategories.filter((c) => c !== next))
  }

  function toggleAlternative(value: MealCategory) {
    form.setAlternativeCategories(
      form.alternativeCategories.includes(value)
        ? form.alternativeCategories.filter((c) => c !== value)
        : [...form.alternativeCategories, value]
    )
  }

  const inputClass =
    'w-full rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 dark:disabled:bg-gray-700'

  return (
    <form onSubmit={onSubmit} className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6 space-y-6">
        {/* 1. Photo (hero) */}
        <div className="-mx-4 -mt-5 sm:-mx-6">
          <input
            ref={fileInputRef}
            id={`${idPrefix}-image`}
            type="file"
            accept="image/jpeg,image/jpg,image/png,image/webp,image/gif"
            onChange={(e) => {
              handleImageChange(e.target.files?.[0] || null, form, toast)
              e.target.value = ''
            }}
            disabled={busy}
            className="sr-only"
            aria-label="Zdjęcie posiłku"
          />
          {form.imagePreview ? (
            <div className="relative overflow-hidden border-b border-gray-200 dark:border-gray-700">
              <Image
                src={form.imagePreview}
                alt="Podgląd zdjęcia posiłku"
                width={800}
                height={320}
                className="h-48 w-full object-cover sm:h-60"
              />
              <div className="absolute inset-x-0 bottom-0 flex flex-wrap items-center justify-between gap-2 bg-gradient-to-t from-black/60 to-transparent px-3 pb-3 pt-8">
                <span className="text-xs text-white/90">
                  {form.imageFile ? 'Nowe zdjęcie (zapisze się z posiłkiem)' : isAdd ? '' : 'Obecne zdjęcie'}
                </span>
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => fileInputRef.current?.click()} disabled={busy}>
                    Zmień
                  </Button>
                  {(isAdd || form.imageFile) && (
                    <Button
                      variant={isAdd ? 'danger' : 'secondary'}
                      size="sm"
                      onClick={() => {
                        form.setImageFile(null)
                        form.setImagePreview(isAdd ? null : form.imageOriginalUrl)
                      }}
                      disabled={busy}
                    >
                      {isAdd ? 'Usuń' : 'Cofnij'}
                    </Button>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={busy}
              className="flex w-full flex-col items-center justify-center gap-1 border-b-2 border-dashed border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-900 px-4 py-8 text-sm text-gray-600 dark:text-gray-400 hover:border-blue-400 hover:bg-blue-50/50 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
            >
              <svg className="h-6 w-6 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 16.5V18a2.25 2.25 0 002.25 2.25h13.5A2.25 2.25 0 0021 18v-1.5M16.5 7.5L12 3m0 0L7.5 7.5M12 3v13.5" />
              </svg>
              <span className="font-medium">Dodaj zdjęcie</span>
              <span className="text-xs text-gray-500 dark:text-gray-400">JPG, PNG, WebP lub GIF, do 5 MB</span>
            </button>
          )}
        </div>

        {/* 2. Basics */}
        <Section title="Podstawowe">
          <div>
            <label htmlFor={`${idPrefix}-name`} className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Nazwa posiłku
            </label>
            <input
              id={`${idPrefix}-name`}
              type="text"
              value={form.name}
              onChange={(e) => form.setName(e.target.value)}
              placeholder="np. Owsianka z bananem"
              disabled={busy}
              className={inputClass}
              required
            />
          </div>
          <div>
            <label htmlFor={`${idPrefix}-description`} className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Opis / przepis
            </label>
            <textarea
              id={`${idPrefix}-description`}
              value={form.description}
              onChange={(e) => form.setDescription(e.target.value)}
              placeholder="Przepis krok po kroku..."
              rows={4}
              disabled={busy}
              className={`${inputClass} resize-y`}
            />
          </div>
        </Section>

        {/* 3. Ingredients */}
        <Section
          title="Składniki"
          hint="Przepis bazowy, wspólny dla całego gospodarstwa."
        >
          <ProductSelectionList
            products={products}
            selectedProducts={form.selectedProducts}
            setSelectedProducts={form.setSelectedProducts}
            disabled={busy}
            isLoading={form.isLoadingItems}
          />
        </Section>

        {/* 4. Member variants */}
        <Section
          title="Warianty domowników"
          hint="Włącz, gdy ktoś je inną wersję tego posiłku. Wariant nie zmienia przepisu bazowego."
        >
          <MemberOverridesEditor
            products={products}
            householdMembers={householdMembers}
            currentUserId={currentUserId}
            baseProducts={form.selectedProducts}
            overrides={form.memberOverrides}
            setOverrides={form.setMemberOverrides}
            disabled={busy}
            isLoading={form.isLoadingItems}
          />
        </Section>
        {/* 5. Categories & tags */}
        <Section title="Kategorie i tagi">
          <div>
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Kategoria główna</p>
            <div role="group" aria-label="Kategoria główna" className="flex flex-wrap gap-2">
              {MEAL_CATEGORIES.map((cat) => {
                const active = form.primaryCategory === cat.value
                return (
                  <button
                    key={cat.value}
                    type="button"
                    onClick={() => choosePrimary(cat.value)}
                    aria-pressed={active}
                    disabled={busy}
                    className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 disabled:opacity-50 ${
                      active ? 'bg-blue-600 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                    }`}
                  >
                    {cat.label}
                  </button>
                )
              })}
            </div>
          </div>
          <div>
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Pasuje też jako <span className="font-normal text-gray-500 dark:text-gray-400">(opcjonalnie)</span>
            </p>
            <div role="group" aria-label="Kategorie alternatywne" className="flex flex-wrap gap-2">
              {alternativeOptions.map((cat) => {
                const active = form.alternativeCategories.includes(cat.value)
                return (
                  <button
                    key={cat.value}
                    type="button"
                    onClick={() => toggleAlternative(cat.value)}
                    aria-pressed={active}
                    disabled={busy}
                    className={`rounded-full border px-3 py-1.5 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 disabled:opacity-50 ${
                      active
                        ? 'border-blue-600 bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300'
                        : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
                    }`}
                  >
                    {cat.label}
                  </button>
                )
              })}
            </div>
          </div>
          <div>
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Tagi</p>
            {tags.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {isAdd ? 'Brak tagów. Dodaj je przyciskiem „Zarządzaj tagami”.' : 'Brak dostępnych tagów.'}
              </p>
            ) : (
              <div role="group" aria-label="Tagi" className="flex flex-wrap gap-2">
                {tags.map((tag) => {
                  const active = form.tags.includes(tag.id)
                  return (
                    <label
                      key={tag.id}
                      className={`rounded-full px-3 py-1.5 text-sm font-medium cursor-pointer transition-all has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-blue-500 has-[:focus-visible]:ring-offset-1 ${
                        active ? 'ring-2 ring-offset-1 dark:ring-offset-gray-900 ring-blue-500' : 'opacity-60 hover:opacity-100'
                      }`}
                      style={{ backgroundColor: tag.color, color: tag.text_color }}
                    >
                      <input
                        type="checkbox"
                        checked={active}
                        onChange={(e) =>
                          form.setTags(e.target.checked ? [...form.tags, tag.id] : form.tags.filter((id) => id !== tag.id))
                        }
                        disabled={busy}
                        className="sr-only"
                      />
                      {tag.name}
                    </label>
                  )
                })}
              </div>
            )}
          </div>
        </Section>

      </div>

      {/* Footer */}
      <div className="sticky bottom-0 shrink-0 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-3 sm:px-6 flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm text-gray-600 dark:text-gray-400">
          {form.selectedProducts.length > 0 ? (
            <>
              <span className="font-semibold text-gray-900 dark:text-gray-100 tabular-nums">{Math.round(totals.kcal)} kcal</span>
              <span className="text-gray-400 dark:text-gray-500"> · </span>
              {form.selectedProducts.length} {pluralIngredients(form.selectedProducts.length)}
            </>
          ) : (
            <span>Dodaj co najmniej jeden składnik</span>
          )}
        </div>
        <div className="flex w-full gap-2 sm:w-auto">
          <Button onClick={onCancel} disabled={busy} className="flex-1 sm:flex-none">
            Anuluj
          </Button>
          <Button type="submit" variant="primary" disabled={!canSubmit} className="flex-1 sm:flex-none">
            {busy ? 'Zapisywanie...' : isAdd ? 'Dodaj posiłek' : 'Zapisz zmiany'}
          </Button>
        </div>
      </div>
    </form>
  )
}

function Section({
  title,
  hint,
  aside,
  children,
}: {
  title: string
  hint?: string
  aside?: ReactNode
  children: ReactNode
}) {
  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">{title}</h3>
          {hint && <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{hint}</p>}
        </div>
        {aside}
      </div>
      {children}
    </section>
  )
}

function pluralIngredients(n: number): string {
  if (n === 1) return 'składnik'
  const mod10 = n % 10
  const mod100 = n % 100
  if (mod10 >= 2 && mod10 <= 4 && !(mod100 >= 12 && mod100 <= 14)) return 'składniki'
  return 'składników'
}
