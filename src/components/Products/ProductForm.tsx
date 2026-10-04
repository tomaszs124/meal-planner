'use client'

import { useId } from 'react'
import type { ProductCategoryRecord } from '@/lib/supabase/client'
import {
  PACKAGE_UNIT_LABEL,
  UNITS,
  defaultUnitWeight,
  packageSizePlaceholder,
  unitWeightPlaceholder,
  type ProductFormValues,
  type UnitType,
} from './productFormHelpers'

const INPUT_CLASS =
  'w-full rounded-lg border border-gray-300 px-4 py-2 text-sm text-black focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500'

type ProductFormProps = {
  values: ProductFormValues
  onChange: (patch: Partial<ProductFormValues>) => void
  categories: ProductCategoryRecord[]
} & (
  | {
      /** Standalone "Dodaj nowy produkt" form. */
      mode: 'add'
      isSubmitting: boolean
      onSubmit: (e: React.FormEvent) => void
    }
  | {
      /** Inline edit inside a product row. */
      mode: 'edit'
      onSave: () => void
      onCancel: () => void
    }
)

/**
 * Product fields shared by the add form and the inline edit form. The two modes
 * only differ in wrappers, label/placeholder styling, ids and action buttons.
 */
export default function ProductForm(props: ProductFormProps) {
  const { values, onChange, categories } = props
  const isAdd = props.mode === 'add'
  const isSubmitting = props.mode === 'add' && props.isSubmitting

  const labelClass = isAdd ? 'block text-sm font-medium text-gray-700 mb-1' : 'block text-xs font-medium text-gray-600 mb-1'
  const inputClass = isAdd ? `${INPUT_CLASS} disabled:bg-gray-100` : INPUT_CLASS
  // Only the add form has required fields and a disabled state while saving.
  // The add form keeps its fixed ids; the inline edit form gets unique ids so its labels are associated too.
  const editIdPrefix = useId()
  const id = (name: string) => (isAdd ? `product-${name}` : `${editIdPrefix}product-${name}`)
  const disabled = isAdd ? isSubmitting : undefined
  const cellClass = isAdd ? undefined : 'flex-1'

  const numberField = (name: 'kcal' | 'protein' | 'fat' | 'carbs', idSuffix: string, label: string, placeholder: string) => (
    <div>
      <label htmlFor={id(idSuffix)} className={labelClass}>
        {label}
      </label>
      <input
        id={id(idSuffix)}
        type="number"
        inputMode="decimal"
        step="0.01"
        value={values[name]}
        onChange={(e) => onChange({ [name]: e.target.value })}
        placeholder={placeholder}
        disabled={disabled}
        className={inputClass}
        required={isAdd && name === 'kcal' ? true : undefined}
      />
    </div>
  )

  const fields = (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        <div>
          <label htmlFor={id('name')} className={labelClass}>
            Nazwa produktu
          </label>
          <input
            id={id('name')}
            type="text"
            value={values.name}
            onChange={(e) => onChange({ name: e.target.value })}
            placeholder={isAdd ? 'Nazwa produktu' : 'Nazwa'}
            disabled={disabled}
            className={inputClass}
            required={isAdd ? true : undefined}
          />
        </div>
        {numberField('kcal', 'kcal', 'Kalorie (kcal)', 'Kalorie')}
        {numberField('protein', 'protein', 'Białko (g)', 'Białko')}
        {numberField('fat', 'fat', 'Tłuszcz (g)', 'Tłuszcz')}
        {numberField('carbs', 'carbs', 'Węglowodany (g)', 'Węglowodany')}
      </div>
      <div className={isAdd ? 'grid grid-cols-1 sm:grid-cols-5 gap-3 mt-3' : 'flex items-end gap-3'}>
        <div className={cellClass}>
          <label htmlFor={id('unit')} className={labelClass}>
            Preferowana jednostka
          </label>
          <select
            id={id('unit')}
            value={values.unit}
            onChange={(e) => {
              const unit = e.target.value as UnitType
              // Auto-set default weight based on unit
              onChange({ unit, unitWeight: defaultUnitWeight(unit) })
            }}
            disabled={disabled}
            className={inputClass}
          >
            {UNITS.map((unit) => (
              <option key={unit.value} value={unit.value}>
                {unit.label}
              </option>
            ))}
          </select>
        </div>
        <div className={cellClass}>
          <label htmlFor={id('unit-weight')} className={labelClass}>
            Waga jednostki (g)
          </label>
          <input
            id={id('unit-weight')}
            type="number"
            inputMode="decimal"
            step="0.01"
            value={values.unitWeight}
            onChange={(e) => onChange({ unitWeight: e.target.value })}
            placeholder={unitWeightPlaceholder(values.unit)}
            disabled={disabled}
            className={inputClass}
            required={isAdd ? true : undefined}
          />
        </div>
        <div className={cellClass}>
          <label htmlFor={id('package-size')} className={labelClass}>
            Opakowanie ({PACKAGE_UNIT_LABEL[values.unit]})
          </label>
          <input
            id={id('package-size')}
            type="number"
            step="0.01"
            min="0"
            value={values.packageSize}
            onChange={(e) => onChange({ packageSize: e.target.value })}
            placeholder={packageSizePlaceholder(values.unit)}
            disabled={disabled}
            className={inputClass}
          />
        </div>
        <div className={cellClass}>
          <label htmlFor={id('category')} className={labelClass}>
            Kategoria
          </label>
          <select
            id={id('category')}
            value={values.category}
            onChange={(e) => onChange({ category: e.target.value })}
            disabled={isSubmitting || categories.length === 0}
            className={inputClass}
          >
            {categories.map((category) => (
              <option key={category.id} value={category.name}>
                {category.name}
              </option>
            ))}
          </select>
        </div>
        {props.mode === 'add' ? (
          <div className="flex items-end">
            <button
              type="submit"
              disabled={isSubmitting || categories.length === 0}
              className="w-full rounded-lg bg-blue-600 px-6 py-2 text-sm font-semibold text-white hover:bg-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
            >
              {isSubmitting ? 'Dodawanie...' : 'Dodaj produkt'}
            </button>
          </div>
        ) : (
          <>
            <button
              type="button"
              onClick={props.onSave}
              className="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-500 transition-colors"
            >
              Zapisz
            </button>
            <button
              type="button"
              onClick={props.onCancel}
              className="rounded-lg bg-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-300 transition-colors"
            >
              Anuluj
            </button>
          </>
        )}
      </div>
      <div className={isAdd ? 'mt-3' : undefined}>
        <label htmlFor={id('notes')} className={labelClass}>
          Notatka (opcjonalnie)
        </label>
        <textarea
          id={id('notes')}
          value={values.notes}
          onChange={(e) => onChange({ notes: e.target.value })}
          placeholder={isAdd ? 'Np. kupować tylko eko, marki X, sprawdzić datę ważności...' : 'Np. kupować tylko eko, marki X...'}
          disabled={disabled}
          rows={2}
          className={`${inputClass} resize-none`}
        />
      </div>
    </>
  )

  if (props.mode === 'add') {
    return (
      <form onSubmit={props.onSubmit} className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <h3 className="text-sm font-semibold text-gray-900 mb-3">Dodaj nowy produkt</h3>
        {fields}
      </form>
    )
  }

  return <div className="space-y-3">{fields}</div>
}
