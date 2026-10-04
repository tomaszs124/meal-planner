'use client'

import { format, parseISO } from 'date-fns'
import type { HouseholdMember } from './types'
import { getMemberDisplayName } from './shoppingListUtils'
import DateRangePicker from './DateRangePicker'

/**
 * "Generuj z planów posiłków" panel: date range, household member selection
 * and the generate button with its success notice.
 */
export default function GenerateListPanel({
  startDate,
  endDate,
  onStartChange,
  onEndChange,
  generatedRange,
  householdMembers,
  selectedMembers,
  toggleMember,
  currentUserId,
  isGenerating,
  showGenerateSuccess,
  onGenerate,
}: {
  startDate: string
  endDate: string
  onStartChange: (date: string) => void
  onEndChange: (date: string) => void
  generatedRange: { startDate: string; endDate: string } | null
  householdMembers: HouseholdMember[]
  selectedMembers: string[]
  toggleMember: (userId: string) => void
  currentUserId: string | undefined
  isGenerating: boolean
  showGenerateSuccess: boolean
  onGenerate: () => void
}) {
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 space-y-4">
      <h3 className="text-lg font-semibold text-gray-900">Generuj z planów posiłków</h3>
      
      {/* Date range */}
      <DateRangePicker
        startDate={startDate}
        endDate={endDate}
        onStartChange={onStartChange}
        onEndChange={onEndChange}
      />

      {generatedRange && (
        <div className="rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-xs text-blue-800">
          Aktualna lista została wygenerowana dla: 
          <span className="font-semibold"> {format(parseISO(generatedRange.startDate), 'dd.MM.yyyy')} - {format(parseISO(generatedRange.endDate), 'dd.MM.yyyy')}</span>
        </div>
      )}

      {/* Household members selection */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Wybierz osoby z gospodarstwa
        </label>
        <div className="space-y-2">
          {householdMembers.map((member) => (
            <label
              key={member.user_id}
              className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-2 rounded"
            >
              <input
                type="checkbox"
                checked={selectedMembers.includes(member.user_id)}
                onChange={() => toggleMember(member.user_id)}
                className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-2 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-900">
                {getMemberDisplayName(member)}
                {member.user_id === currentUserId && ' (Ty)'}
              </span>
            </label>
          ))}
        </div>
      </div>

      {/* Generate button */}
      <button
        onClick={onGenerate}
        disabled={isGenerating || selectedMembers.length === 0}
        className="w-full rounded-lg bg-green-600 px-6 py-3 text-sm font-semibold text-white hover:bg-green-500 focus:outline-none focus:ring-2 focus:ring-green-500 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
      >
        {isGenerating ? 'Generowanie...' : 'Generuj listę zakupów'}
      </button>

      {showGenerateSuccess && (
        <div className="rounded-lg border border-green-100 bg-green-50 px-3 py-2 text-xs text-green-800">
          Lista zakupów została wygenerowana.
        </div>
      )}
    </div>
  )
}
