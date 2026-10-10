'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { MEAL_SORT_OPTIONS, type MealSort } from '@/lib/meal-sort'

/**
 * Sort icon button with a small popover of radio options (used by the Meals list
 * and the day-plan meal picker). Escape and a click outside close it.
 */
export default function SortMenu({
  value,
  onChange,
  align = 'right',
}: {
  value: MealSort
  onChange: (sort: MealSort) => void
  align?: 'left' | 'right'
}) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const menuId = useId()
  const current = MEAL_SORT_OPTIONS.find((o) => o.value === value)

  useEffect(() => {
    if (!open) return
    function onPointerDown(event: MouseEvent | TouchEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false)
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.stopPropagation()
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('touchstart', onPointerDown)
    document.addEventListener('keydown', onKey, true)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('touchstart', onPointerDown)
      document.removeEventListener('keydown', onKey, true)
    }
  }, [open])

  return (
    <div ref={rootRef} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        aria-label={`Sortowanie: ${current?.label ?? ''}`}
        title={`Sortowanie: ${current?.label ?? ''}`}
        className={`flex h-10 w-10 items-center justify-center rounded-lg border transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${
          open
            ? 'border-gray-900 bg-gray-900 text-white dark:border-gray-100 dark:bg-gray-100 dark:text-gray-900'
            : 'border-gray-300 bg-white text-gray-700 hover:border-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:border-gray-300'
        }`}
      >
        <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 6h13M3 12h9M3 18h5m10-9v12m0 0l-3-3m3 3l3-3" />
        </svg>
      </button>

      {open && (
        <div
          id={menuId}
          role="menu"
          aria-label="Sortowanie"
          className={`absolute z-30 mt-1 w-64 rounded-xl border border-gray-200 bg-white p-1 shadow-lg dark:border-gray-700 dark:bg-gray-800 ${
            align === 'right' ? 'right-0' : 'left-0'
          }`}
        >
          <p className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Sortuj według</p>
          {MEAL_SORT_OPTIONS.map((option) => {
            const active = option.value === value
            return (
              <button
                key={option.value}
                type="button"
                role="menuitemradio"
                aria-checked={active}
                onClick={() => {
                  onChange(option.value)
                  setOpen(false)
                }}
                className={`flex w-full items-start gap-2.5 rounded-lg px-3 py-2 text-left transition-colors ${
                  active ? 'bg-brand-50 dark:bg-brand-950/60' : 'hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
              >
                <span
                  className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${active ? 'bg-brand-500' : 'bg-gray-300 dark:bg-gray-600'}`}
                  aria-hidden="true"
                />
                <span className="min-w-0">
                  <span className="block text-sm font-medium text-gray-900 dark:text-gray-100">{option.label}</span>
                  <span className="block text-xs text-gray-500 dark:text-gray-400">{option.hint}</span>
                </span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
