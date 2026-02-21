'use client'

import { useRouter } from 'next/navigation'
import Meals from '@/components/Meals/Meals'

export default function MealsPage() {
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

        {/* Meals component */}
        <Meals />
      </div>
    </div>
  )
}
