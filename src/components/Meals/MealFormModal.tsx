'use client'

import { useId, useRef, type ComponentProps } from 'react'
import { useFocusTrap } from '@/components/ui/useFocusTrap'
import MealForm from './MealForm'

/**
 * Modal shell around MealForm, used for both "Nowy posiłek" and "Edytuj posiłek".
 * Full-screen sheet on phones, centered dialog from `sm` up. Header stays on top;
 * the form owns the scroll area and the sticky footer with the Save / Cancel buttons.
 */
export default function MealFormModal({
  title,
  onCancel,
  ...formProps
}: Omit<ComponentProps<typeof MealForm>, 'onCancel'> & { title: string; onCancel: () => void }) {
  const titleId = useId()
  const dialogRef = useRef<HTMLDivElement>(null)

  // Focus management + close on Escape (only when this is the top-most dialog)
  useFocusTrap(dialogRef, { active: true, onEscape: onCancel })

  return (
    <div
      className="fixed inset-0 z-[100] flex items-stretch justify-center bg-gray-900/40 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={onCancel}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="flex h-full w-full max-w-3xl flex-col bg-white shadow-xl sm:h-auto sm:max-h-[92vh] sm:rounded-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-gray-200 px-4 py-3 sm:px-6">
          <div className="min-w-0">
            <h2 id={titleId} className="text-lg font-bold text-gray-900 sm:text-xl">{title}</h2>
            {formProps.mode === 'edit' && formProps.form.name && (
              <p className="truncate text-sm text-gray-500">{formProps.form.name}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onCancel}
            aria-label="Zamknij"
            className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <MealForm onCancel={onCancel} {...formProps} />
      </div>
    </div>
  )
}
