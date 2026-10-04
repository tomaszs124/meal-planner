import type { Product, ProductCategory, ProductCategoryRecord } from '@/lib/supabase/client'

export type UnitType = '100g' | 'piece' | 'tablespoon' | 'teaspoon' | 'leaf' | 'cube' | 'slice'

export const UNITS: { value: UnitType; label: string }[] = [
  { value: '100g', label: 'g' },
  { value: 'piece', label: 'Sztuka' },
  { value: 'tablespoon', label: 'Łyżka' },
  { value: 'teaspoon', label: 'Łyżeczka' },
  { value: 'leaf', label: 'Liść' },
  { value: 'cube', label: 'Kostka' },
  { value: 'slice', label: 'Plaster' },
]

export const DEFAULT_CATEGORY_NAME = 'Pozostałe'

/** Raw (string) values of the product form, shared by the add and inline-edit forms. */
export type ProductFormValues = {
  name: string
  kcal: string
  unit: UnitType
  unitWeight: string
  category: ProductCategory
  protein: string
  fat: string
  carbs: string
  notes: string
}

/** Blank form; `category` is the category preselected in the select. */
export function emptyProductForm(category: ProductCategory = ''): ProductFormValues {
  return {
    name: '',
    kcal: '',
    unit: '100g',
    unitWeight: '1',
    category,
    protein: '',
    fat: '',
    carbs: '',
    notes: '',
  }
}

/** Default weight (grams) of one unit; used when the unit changes and when a product has no weight. */
export function defaultUnitWeight(unit: string): string {
  return unit === '100g' ? '1'
    : unit === 'tablespoon' ? '15'
    : unit === 'teaspoon' ? '5'
    : unit === 'leaf' ? '2'
    : unit === 'cube' ? '10'
    : unit === 'slice' ? '30'
    : '100'
}

export function unitWeightPlaceholder(unit: UnitType): string {
  return unit === '100g' ? '1 (dla gramów)' : unit === 'piece' ? 'np. 300 dla sztuki' : unit === 'tablespoon' ? '15' : unit === 'teaspoon' ? '5' : unit === 'leaf' ? '2' : unit === 'cube' ? '10' : unit === 'slice' ? '30' : ''
}

export function unitLabel(unitType: string): string {
  return UNITS.find((u) => u.value === unitType)?.label || unitType
}

/** `Pozostałe` when it exists, otherwise the first category, otherwise ''. */
export function getDefaultCategoryName(categories: ProductCategoryRecord[]): ProductCategory {
  return categories.find((c) => c.name === DEFAULT_CATEGORY_NAME)?.name || categories[0]?.name || ''
}

/** Required fields: name, kcal, unit weight and category. */
export function isProductFormValid(values: ProductFormValues): boolean {
  return !!values.name.trim() && !!values.kcal && !!values.unitWeight && !!values.category
}

/** Columns written to `products` on insert/update. */
export function toProductPayload(values: ProductFormValues) {
  return {
    name: values.name.trim(),
    kcal_per_unit: parseFloat(values.kcal),
    unit_type: values.unit,
    unit_weight_grams: parseFloat(values.unitWeight),
    category: values.category,
    protein: values.protein ? parseFloat(values.protein) : null,
    fat: values.fat ? parseFloat(values.fat) : null,
    carbs: values.carbs ? parseFloat(values.carbs) : null,
    notes: values.notes.trim() || null,
  }
}

export function productToFormValues(product: Product): ProductFormValues {
  return {
    name: product.name,
    kcal: product.kcal_per_unit.toString(),
    unit: product.unit_type as UnitType,
    // Fall back to the unit's default weight when the product has none
    unitWeight: product.unit_weight_grams?.toString() || defaultUnitWeight(product.unit_type),
    category: product.category,
    protein: product.protein?.toString() || '',
    fat: product.fat?.toString() || '',
    carbs: product.carbs?.toString() || '',
    notes: product.notes || '',
  }
}
