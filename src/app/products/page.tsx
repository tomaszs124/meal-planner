'use client'

import Products from '@/components/Products/Products'
import { useRouter } from 'next/navigation'

export default function ProductsPage() {
  const router = useRouter()

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors mb-4 cursor-pointer"
        >
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 19l-7-7 7-7"
            />
          </svg>
          <span className="text-sm font-medium">Wróć</span>
        </button>

        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Produkty</h1>
          <p className="text-sm text-gray-600 mt-2">
            Zarządzaj bazą produktów spożywczych
          </p>
        </div>

        <Products />
      </div>
    </div>
  )
}
