import type { HouseholdMember } from './types'

type DayActionsProps = {
  householdMembers: HouseholdMember[]
  copyFromUserId: string
  onCopyFromUserIdChange: (userId: string) => void
  sendToUserId: string
  onSendToUserIdChange: (userId: string) => void
  copySuccessMsg: string
  sendSuccessMsg: string
  onDuplicateFromPreviousDay: () => void
  onCopyFromMember: () => void
  onSendDayToMember: () => void
}

/** Day-level actions: duplicate from yesterday, copy from / send to a household member. */
export default function DayActions({
  householdMembers,
  copyFromUserId,
  onCopyFromUserIdChange,
  sendToUserId,
  onSendToUserIdChange,
  copySuccessMsg,
  sendSuccessMsg,
  onDuplicateFromPreviousDay,
  onCopyFromMember,
  onSendDayToMember,
}: DayActionsProps) {
  return (
    <>
      {/* Duplicate from previous day */}
      <button
        onClick={onDuplicateFromPreviousDay}
        className="w-full bg-blue-600 text-white px-4 py-3 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
        </svg>
        Duplikuj z wczoraj
      </button>

      {/* Copy day from household member */}
      <div className="bg-white rounded-lg border border-gray-200 p-3 space-y-3">
        <div className="text-sm font-semibold text-gray-900">Kopiuj dzień od domownika</div>
        <select
          value={copyFromUserId}
          aria-label="Domownik, od którego skopiować dzień"
          onChange={(e) => onCopyFromUserIdChange(e.target.value)}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-black focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
        >
          <option value="">Wybierz domownika...</option>
          {householdMembers.map((member) => (
            <option key={member.user_id} value={member.user_id}>
              {member.display_name || 'Bez nazwy'}
            </option>
          ))}
        </select>
        <button
          onClick={onCopyFromMember}
          disabled={!copyFromUserId}
          className="w-full bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
        >
          Kopiuj dzień od domownika
        </button>
        {copySuccessMsg && (
          <p className="text-sm text-green-700 font-medium text-center">{copySuccessMsg}</p>
        )}
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-3 space-y-3">
        <div className="text-sm font-semibold text-gray-900">Wyślij dzień do domownika</div>
        <select
          value={sendToUserId}
          aria-label="Domownik, do którego wysłać dzień"
          onChange={(e) => onSendToUserIdChange(e.target.value)}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-black focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
        >
          <option value="">Wybierz domownika...</option>
          {householdMembers.map((member) => (
            <option key={member.user_id} value={member.user_id}>
              {member.display_name || 'Bez nazwy'}
            </option>
          ))}
        </select>
        <button
          onClick={onSendDayToMember}
          disabled={!sendToUserId}
          className="w-full bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-emerald-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
        >
          Wyślij dzień do domownika
        </button>
        {sendSuccessMsg && (
          <p className="text-sm text-green-700 font-medium text-center">{sendSuccessMsg}</p>
        )}
      </div>
    </>
  )
}
