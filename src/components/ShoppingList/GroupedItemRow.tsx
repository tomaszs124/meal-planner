'use client'

import { useId, type ReactNode } from 'react'
import Button from '@/components/ui/Button'
import type { GroupedItem } from './types'
import { getGroupedItemAmountLabel } from './shoppingListUtils'

/**
 * One aggregated product row of the shopping list, shared by the category view, the
 * "all products" view and the custom items of the dish view:
 * - tapping anywhere on the row (or Enter/Space on it) toggles the check,
 * - the chevron expands a detail area with optional `details` (e.g. source meals)
 *   and the "Usuń z listy" action; there is no delete control on the collapsed row.
 */
export default function GroupedItemRow({
  groupedItem,
  isExpanded,
  onToggleExpanded,
  activeProductTooltip,
  setActiveProductTooltip,
  onToggle,
  onDelete,
  details,
}: {
  groupedItem: GroupedItem
  isExpanded: boolean
  onToggleExpanded: () => void
  activeProductTooltip: string | null
  setActiveProductTooltip: (key: string | null) => void
  onToggle: (groupedItem: GroupedItem) => Promise<void>
  onDelete: (groupedItem: GroupedItem) => Promise<void>
  /** Extra content of the expanded area, shown above the delete button */
  details?: ReactNode
}) {
  const detailsId = useId()
  const amountLabel = getGroupedItemAmountLabel(groupedItem)

  return (
    <div className={`transition-opacity ${groupedItem.allChecked ? 'opacity-60' : 'opacity-100'}`}>
      <div
        role="button"
        tabIndex={0}
        onClick={() => {
          void onToggle(groupedItem)
        }}
        onKeyDown={(e) => {
          // Only the row itself; keys on the nested checkbox/buttons keep their native behaviour
          if (e.target !== e.currentTarget || e.repeat) return
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            void onToggle(groupedItem)
          }
        }}
        className={`bg-white dark:bg-gray-800 shadow-sm border border-gray-200 dark:border-gray-700 p-4 flex items-center gap-3 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
          isExpanded ? 'rounded-t-lg border-b-0' : 'rounded-lg'
        }`}
      >
        <input
          type="checkbox"
          onClick={(e) => e.stopPropagation()}
          checked={groupedItem.allChecked}
          aria-label={groupedItem.name}
          onChange={(e) => {
            e.stopPropagation()
            void onToggle(groupedItem)
          }}
          className="h-5 w-5 rounded border-gray-300 dark:border-gray-600 text-blue-600 dark:text-blue-400 focus:ring-2 focus:ring-blue-500 cursor-pointer"
        />
        <div className="flex-1 min-w-0 flex items-start gap-2">
          <div className="min-w-0">
            <p
              className={`text-sm font-medium ${
                groupedItem.allChecked ? 'line-through text-gray-500 dark:text-gray-400' : 'text-gray-900 dark:text-gray-100'
              }`}
            >
              {groupedItem.name}
            </p>
            {amountLabel && <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{amountLabel}</p>}
          </div>
          {groupedItem.product?.notes && (
            <div className="relative flex-shrink-0 mt-0.5">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  setActiveProductTooltip(activeProductTooltip === groupedItem.key ? null : groupedItem.key)
                }}
                className="w-5 h-5 flex items-center justify-center rounded-full bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-300 dark:hover:bg-gray-500 transition-colors text-[10px] font-bold"
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
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onToggleExpanded()
          }}
          aria-expanded={isExpanded}
          aria-controls={detailsId}
          aria-label={isExpanded ? `Zwiń szczegóły: ${groupedItem.name}` : `Pokaż szczegóły: ${groupedItem.name}`}
          className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex-shrink-0"
        >
          <svg
            className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      </div>
      {isExpanded && (
        <div
          id={detailsId}
          className="border border-t-0 border-gray-200 dark:border-gray-700 rounded-b-lg bg-gray-50 dark:bg-gray-900 px-3 pb-3 pt-2 space-y-3"
        >
          {details}
          <div className="flex justify-end">
            <Button
              variant="danger"
              size="sm"
              onClick={() => void onDelete(groupedItem)}
              aria-label={`Usuń z listy: ${groupedItem.name}`}
            >
              Usuń z listy
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
