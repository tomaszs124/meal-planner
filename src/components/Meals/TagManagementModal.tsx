'use client'

import { useId, useRef } from 'react'
import { useFocusTrap } from '@/components/ui/useFocusTrap'
import TagManagement from './TagManagement'

/**
 * "Zarządzaj tagami" dialog: same shell as MealFormModal (full-screen sheet on phones,
 * centered dialog from `sm` up, scrolling body). `m-0` keeps the overlay full-height
 * although it is rendered inside a `space-y-*` container.
 */
export default function TagManagementModal({ onClose }: { onClose: () => void }) {
  const titleId = useId()
  const dialogRef = useRef<HTMLDivElement>(null)

  useFocusTrap(dialogRef, { active: true, onEscape: onClose })

  return (
    <div
      className="fixed inset-0 z-[100] m-0 flex items-stretch justify-center bg-gray-900/40 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="flex h-full w-full max-w-xl flex-col bg-white dark:bg-gray-800 shadow-xl sm:h-auto sm:max-h-[92vh] sm:rounded-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-gray-200 dark:border-gray-700 px-4 py-3 sm:px-6">
          <h2 id={titleId} className="text-lg font-bold text-gray-900 dark:text-gray-100 sm:text-xl">Tagi</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Zamknij"
            className="rounded-md p-1.5 text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-600 dark:hover:text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6">
          <TagManagement />
        </div>
      </div>
    </div>
  )
}
