import type { Product } from '@/lib/supabase/client'
import type { ProductSelection } from './types'

/**
 * Pure helpers of the meal form (ingredient rows, product search, amount parsing).
 * No React here so everything is unit-testable.
 */

/** Sensible starting amount for a freshly added ingredient: 100 g for weight-based products, 1 unit otherwise. */
export function defaultAmountFor(product: Product | undefined): number {
  return product?.unit_type === '100g' ? 100 : 1
}

/** Parses what the user typed into an amount field. Accepts a decimal comma; invalid or negative input yields null. */
export function parseAmount(text: string): number | null {
  const normalized = text.trim().replace(',', '.')
  if (normalized === '' || normalized === '.') return null
  if (!/^\d*\.?\d*$/.test(normalized)) return null
  const value = parseFloat(normalized)
  return Number.isFinite(value) && value >= 0 ? value : null
}

/** Lower-cases and strips Polish diacritics so "zoladek" finds "Żołądek". */
export function normalizeSearch(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/ł/g, 'l')
}

/** Products whose name contains every word of the query (order-independent); empty query returns all. */
export function filterProducts(products: Product[], query: string): Product[] {
  const words = normalizeSearch(query).split(/\s+/).filter(Boolean)
  if (words.length === 0) return products
  return products.filter((product) => {
    const name = normalizeSearch(product.name)
    return words.every((word) => name.includes(word))
  })
}

export function appendRow(list: ProductSelection[], product: Product): ProductSelection[] {
  return [...list, { product_id: product.id, amount: defaultAmountFor(product) }]
}

export function removeRow(list: ProductSelection[], index: number): ProductSelection[] {
  return list.filter((_, i) => i !== index)
}

/** Swaps the product of a row; the amount is reset to the new product's default when the unit kind changes. */
export function setRowProduct(
  list: ProductSelection[],
  index: number,
  product: Product,
  products: Product[]
): ProductSelection[] {
  return list.map((row, i) => {
    if (i !== index) return row
    const previous = products.find((p) => p.id === row.product_id)
    const unitKindChanged = (previous?.unit_type === '100g') !== (product.unit_type === '100g')
    return {
      product_id: product.id,
      amount: unitKindChanged ? defaultAmountFor(product) : row.amount,
    }
  })
}

export function setRowAmount(list: ProductSelection[], index: number, amount: number): ProductSelection[] {
  return list.map((row, i) => (i === index ? { ...row, amount } : row))
}

/** Formats an amount for an input field: integers without decimals, otherwise up to 2 decimals, no trailing zeros. */
export function formatAmountInput(amount: number): string {
  if (!Number.isFinite(amount)) return ''
  return Number.isInteger(amount) ? String(amount) : String(parseFloat(amount.toFixed(2)))
}
