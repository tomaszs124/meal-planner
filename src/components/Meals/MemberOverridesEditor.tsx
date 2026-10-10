'use client'

import type { Product } from '@/lib/supabase/client'
import IngredientRows from './IngredientRows'
import { selectionTotals, toggleMemberOverride } from './useMealForm'
import type { HouseholdMember, MemberOverrides, ProductSelection } from './types'

/**
 * "Warianty domowników" section: every household member gets a switch; when it is on,
 * that member eats their own ingredient list instead of the base recipe.
 */
export default function MemberOverridesEditor({
  products,
  householdMembers,
  currentUserId,
  baseProducts,
  overrides,
  setOverrides,
  disabled,
  isLoading,
}: {
  products: Product[]
  householdMembers: HouseholdMember[]
  currentUserId: string | undefined
  baseProducts: ProductSelection[]
  overrides: MemberOverrides
  setOverrides: (overrides: MemberOverrides) => void
  disabled?: boolean
  isLoading?: boolean
}) {
  if (householdMembers.length === 0) {
    return (
      <p className="text-sm text-gray-500">
        Brak domowników. Warianty pojawią się, gdy w gospodarstwie będzie więcej osób.
      </p>
    )
  }

  if (isLoading) {
    return (
      <ul className="space-y-2" aria-busy="true" aria-label="Ładowanie wariantów">
        {householdMembers.map((member) => (
          <li key={member.user_id} className="h-14 animate-pulse rounded-lg bg-gray-100" />
        ))}
      </ul>
    )
  }

  const baseKcal = Math.round(selectionTotals(baseProducts, products).kcal)
  const canToggleOn = baseProducts.length > 0

  return (
    <div className="space-y-2">
      {!canToggleOn && (
        <p className="text-sm text-gray-500">Dodaj najpierw składniki do przepisu bazowego, potem włącz warianty.</p>
      )}
      {householdMembers.map((member) => {
        const enabled = !!overrides[member.user_id]
        const memberRows = overrides[member.user_id] || []
        const name = member.display_name || 'Bez nazwy'
        const isMe = member.user_id === currentUserId
        const kcal = enabled ? Math.round(selectionTotals(memberRows, products).kcal) : baseKcal
        const switchId = `variant-${member.user_id}`

        return (
          <div
            key={member.user_id}
            className={`rounded-lg border ${enabled ? 'border-indigo-300 bg-indigo-50/50' : 'border-gray-200 bg-white'}`}
          >
            <div className="flex items-center justify-between gap-3 px-3 py-2.5">
              <label htmlFor={switchId} className="flex min-w-0 items-center gap-3 cursor-pointer">
                <button
                  id={switchId}
                  type="button"
                  role="switch"
                  aria-checked={enabled}
                  disabled={disabled || (!enabled && !canToggleOn)}
                  onClick={() => toggleMemberOverride(member.user_id, baseProducts, overrides, setOverrides)}
                  className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-40 ${
                    enabled ? 'bg-indigo-600' : 'bg-gray-300'
                  }`}
                >
                  <span
                    className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                      enabled ? 'translate-x-5' : 'translate-x-0.5'
                    }`}
                  />
                </button>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium text-gray-900">
                    {name}
                    {isMe && <span className="ml-1 text-gray-500 font-normal">(Ty)</span>}
                  </span>
                  <span className="block text-xs text-gray-500">
                    {enabled ? 'Własny wariant' : 'Je przepis bazowy'}
                  </span>
                </span>
              </label>
              <span className={`shrink-0 text-sm tabular-nums ${enabled ? 'font-semibold text-indigo-700' : 'text-gray-500'}`}>
                {kcal} kcal
              </span>
            </div>

            {enabled && (
              <div className="border-t border-indigo-200 px-3 py-3 space-y-2">
                <IngredientRows
                  products={products}
                  rows={memberRows}
                  onChange={(rows) => setOverrides({ ...overrides, [member.user_id]: rows })}
                  disabled={disabled}
                  scope={name}
                  tone="variant"
                  emptyText="Pusty wariant. Dodaj składniki albo skopiuj przepis bazowy."
                />
                <button
                  type="button"
                  onClick={() => setOverrides({ ...overrides, [member.user_id]: baseProducts.map((p) => ({ ...p })) })}
                  disabled={disabled || baseProducts.length === 0}
                  className="text-xs font-medium text-indigo-700 hover:text-indigo-900 disabled:opacity-50"
                >
                  Skopiuj przepis bazowy do tego wariantu
                </button>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
