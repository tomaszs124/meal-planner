'use client'

import { useEffect, useId, useRef, useState } from 'react'
import type { Product } from '@/lib/supabase/client'
import { translateUnit } from './mealHelpers'
import { filterProducts } from './mealFormHelpers'

/**
 * Searchable product combobox. Two looks:
 *  - with `value`: a field showing the current product (ingredient row)
 *  - without `value`: a "+ Dodaj składnik" button (append row)
 * Opens a popover with a search box; arrows / Enter / Escape work; click outside closes.
 */
export default function ProductPicker({
  products,
  value,
  onSelect,
  label,
  addLabel = '+ Dodaj składnik',
  disabled,
}: {
  products: Product[]
  value: string | null
  onSelect: (product: Product) => void
  /** Accessible name of the trigger */
  label: string
  addLabel?: string
  disabled?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [highlighted, setHighlighted] = useState(0)
  const rootRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLUListElement>(null)
  const listId = useId()

  const current = value ? products.find((p) => p.id === value) : undefined
  const matches = filterProducts(products, query)

  useEffect(() => {
    if (!open) return
    inputRef.current?.focus()
    function onPointerDown(event: MouseEvent | TouchEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('touchstart', onPointerDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('touchstart', onPointerDown)
    }
  }, [open])

  useEffect(() => {
    const item = listRef.current?.children[highlighted] as HTMLElement | undefined
    item?.scrollIntoView({ block: 'nearest' })
  }, [highlighted, open])

  function openPicker() {
    if (disabled) return
    setQuery('')
    setHighlighted(0)
    setOpen(true)
  }

  function choose(product: Product) {
    onSelect(product)
    setOpen(false)
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setHighlighted((i) => Math.min(i + 1, matches.length - 1))
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setHighlighted((i) => Math.max(i - 1, 0))
    } else if (event.key === 'Enter') {
      event.preventDefault()
      if (matches[highlighted]) choose(matches[highlighted])
    } else if (event.key === 'Escape') {
      event.preventDefault()
      event.stopPropagation()
      setOpen(false)
    }
  }

  return (
    <div ref={rootRef} className="relative">
      {current || value ? (
        <button
          type="button"
          onClick={openPicker}
          disabled={disabled}
          aria-label={label}
          aria-haspopup="listbox"
          aria-expanded={open}
          className="w-full flex items-center justify-between gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-left text-sm text-gray-900 hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:text-gray-500"
        >
          <span className="truncate">{current?.name ?? 'Nieznany produkt'}</span>
          <svg className="w-4 h-4 shrink-0 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      ) : (
        <button
          type="button"
          onClick={openPicker}
          disabled={disabled}
          aria-label={label}
          aria-haspopup="listbox"
          aria-expanded={open}
          className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-blue-300 bg-blue-50/60 px-3 py-2 text-sm font-medium text-blue-700 hover:bg-blue-100 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
        >
          {addLabel}
        </button>
      )}

      {open && (
        <div className="absolute left-0 right-0 z-20 mt-1 min-w-[16rem] rounded-lg border border-gray-200 bg-white shadow-lg">
          <div className="p-2 border-b border-gray-100">
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value)
                setHighlighted(0)
              }}
              onKeyDown={onKeyDown}
              placeholder="Szukaj produktu..."
              aria-label="Szukaj produktu"
              aria-controls={listId}
              aria-activedescendant={matches[highlighted] ? `${listId}-${matches[highlighted].id}` : undefined}
              role="combobox"
              aria-expanded="true"
              autoComplete="off"
              className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <ul ref={listRef} id={listId} role="listbox" className="max-h-60 overflow-y-auto py-1">
            {matches.length === 0 ? (
              <li className="px-3 py-2 text-sm text-gray-500">Brak produktów dla „{query}”</li>
            ) : (
              matches.map((product, index) => {
                const selected = product.id === value
                const active = index === highlighted
                return (
                  <li
                    key={product.id}
                    id={`${listId}-${product.id}`}
                    role="option"
                    aria-selected={selected}
                    onMouseEnter={() => setHighlighted(index)}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => choose(product)}
                    className={`flex items-center justify-between gap-3 px-3 py-2 text-sm cursor-pointer ${
                      active ? 'bg-blue-50 text-blue-900' : 'text-gray-900'
                    } ${selected ? 'font-semibold' : ''}`}
                  >
                    <span className="truncate">{product.name}</span>
                    <span className="shrink-0 text-xs text-gray-500">
                      {product.kcal_per_unit} kcal/100g
                      {product.unit_type !== '100g' && ` · ${translateUnit(product.unit_type)}`}
                    </span>
                  </li>
                )
              })
            )}
          </ul>
        </div>
      )}
    </div>
  )
}
