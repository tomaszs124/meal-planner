'use client'

import type { ReactNode } from 'react'
import type { GroupedItem } from './types'
import { getGroupedItemAmountLabel } from './shoppingListUtils'

/**
 * Single aggregated product row (checkbox, name, amount, optional product note
 * tooltip and delete button). Used by the category and "all products" views.
 * `className` is the full class list of the row container; `children` are rendered
 * after the delete button (e.g. the expand toggle in the category view).
 */
export default function GroupedItemRow({
  groupedItem,
  className,
  activeProductTooltip,
  setActiveProductTooltip,
  onToggle,
  onDelete,
  children,
}: {
  groupedItem: GroupedItem
  className: string
  activeProductTooltip: string | null
  setActiveProductTooltip: (key: string | null) => void
  onToggle: (groupedItem: GroupedItem) => Promise<void>
  onDelete: (groupedItem: GroupedItem) => Promise<void>
  children?: ReactNode
}) {
  return (
    <div
      onClick={() => {
        void onToggle(groupedItem)
      }}
      className={className}
    >
      <input
        type="checkbox"
        checked={groupedItem.allChecked}
        aria-label={groupedItem.name}
        onChange={(e) => {
          e.stopPropagation()
          void onToggle(groupedItem)
        }}
        className="h-5 w-5 rounded border-gray-300 text-blue-600 focus:ring-2 focus:ring-blue-500 cursor-pointer"
      />
      <div className="flex-1 min-w-0 flex items-start gap-2">
        <div className="min-w-0">
          <p
            className={`text-sm font-medium ${
              groupedItem.allChecked ? 'line-through text-gray-500' : 'text-gray-900'
            }`}
          >
            {groupedItem.name}
          </p>
          {getGroupedItemAmountLabel(groupedItem) && (
            <p className="text-xs text-gray-500 mt-0.5">
              {getGroupedItemAmountLabel(groupedItem)}
            </p>
          )}
        </div>
        {groupedItem.product?.notes && (
          <div className="relative flex-shrink-0 mt-0.5">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                setActiveProductTooltip(activeProductTooltip === groupedItem.key ? null : groupedItem.key)
              }}
              className="w-5 h-5 flex items-center justify-center rounded-full bg-gray-200 text-gray-600 hover:bg-gray-300 transition-colors text-[10px] font-bold"
              aria-label="Pokaż notatkę"
              aria-expanded={activeProductTooltip === groupedItem.key}
            >
              i
            </button>
            {activeProductTooltip === groupedItem.key && (
              <div className="absolute left-0 bottom-full mb-2 w-56 bg-gray-900 text-white text-xs rounded-lg p-3 shadow-lg z-10">
                {groupedItem.product.notes}
                <div className="absolute left-2 top-full w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900" />
              </div>
            )}
          </div>
        )}
      </div>
      <button
        onClick={(e) => {
          e.stopPropagation()
          void onDelete(groupedItem)
        }}
        className="text-red-600 hover:text-red-700 text-sm font-medium px-2 py-1 rounded hover:bg-red-50 transition-colors flex-shrink-0"
        aria-label={`Usuń ${groupedItem.name}`}
      >
        Usuń
      </button>
      {children}
    </div>
  )
}
