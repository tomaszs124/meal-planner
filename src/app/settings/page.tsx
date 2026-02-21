'use client'

import { useRouter } from 'next/navigation'
import UserSettingsForm from '@/components/Settings/UserSettingsForm'

export default function SettingsPage() {
  const router = useRouter()

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto p-4">
        {/* Back button */}
        <button
          onClick={() => router.back()}
          className="mb-4 text-sm text-gray-600 hover:text-gray-900 font-medium transition-colors cursor-pointer"
        >
          ← Wróć
        </button>

        {/* Settings component */}
        <UserSettingsForm />
      </div>
    </div>
  )
}
