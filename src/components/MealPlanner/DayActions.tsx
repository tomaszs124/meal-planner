import { useId } from 'react'
import Button from '@/components/ui/Button'
import type { HouseholdMember } from './types'
import { CopyIcon, DownloadIcon, SendIcon } from './icons'

type DayActionsProps = {
  householdMembers: HouseholdMember[]
  /** One member selection shared by "Kopiuj od domownika" and "Wyślij domownikowi" */
  memberUserId: string
  onMemberUserIdChange: (userId: string) => void
  onDuplicateFromPreviousDay: () => void
  onCopyFromMember: () => void
  onSendDayToMember: () => void
}

/** "Dzień" card: duplicate from yesterday, copy the day from / send it to a household member. */
export default function DayActions({
  householdMembers,
  memberUserId,
  onMemberUserIdChange,
  onDuplicateFromPreviousDay,
  onCopyFromMember,
  onSendDayToMember,
}: DayActionsProps) {
  const selectId = useId()

  return (
    <section className="space-y-4 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 shadow-sm">
      <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Dzień</h2>

      <Button icon={<CopyIcon />} onClick={onDuplicateFromPreviousDay}>
        Duplikuj z wczoraj
      </Button>

      {householdMembers.length > 0 && (
        <div className="space-y-2 border-t border-gray-100 dark:border-gray-700 pt-4">
          <label htmlFor={selectId} className="block text-xs font-medium text-gray-600 dark:text-gray-400">
            Domownik
          </label>
          <select
            id={selectId}
            value={memberUserId}
            onChange={(e) => onMemberUserIdChange(e.target.value)}
            className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Wybierz domownika...</option>
            {householdMembers.map((member) => (
              <option key={member.user_id} value={member.user_id}>
                {member.display_name || 'Bez nazwy'}
              </option>
            ))}
          </select>
          <div className="grid grid-cols-2 gap-2">
            <Button icon={<DownloadIcon />} disabled={!memberUserId} onClick={onCopyFromMember}>
              Kopiuj od domownika
            </Button>
            <Button icon={<SendIcon />} disabled={!memberUserId} onClick={onSendDayToMember}>
              Wyślij domownikowi
            </Button>
          </div>
        </div>
      )}
    </section>
  )
}
