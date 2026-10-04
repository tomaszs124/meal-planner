'use client'

import type { ComponentProps } from 'react'
import MealForm from './MealForm'

// Modal shell around the edit-mode MealForm
export default function EditMealModal({
  onCancel,
  ...formProps
}: Omit<ComponentProps<typeof MealForm>, 'mode' | 'onCancel'> & { onCancel: () => void }) {
  return (
    <div className="fixed inset-0 bg-white/30 backdrop-blur-sm flex items-center justify-center z-[100] pt-8 pb-6">
      <div
        className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between z-10">
          <h2 className="text-2xl font-bold text-gray-900">Edytuj posiłek</h2>
          <button
            onClick={onCancel}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <MealForm mode="edit" onCancel={onCancel} {...formProps} />
      </div>
    </div>
  )
}
