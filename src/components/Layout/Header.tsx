'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'

export default function Header() {
  const pathname = usePathname()
  const router = useRouter()

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  // Don't show header on login page
  if (pathname === '/login') {
    return null
  }

  return (
    <header className="bg-white shadow-sm border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo / App name */}
          <div className="flex items-center">
            <Link 
              href="/dashboard" 
              className="text-xl font-bold text-gray-900 hover:text-blue-600 transition-colors"
            >
              Meal Planner
            </Link>
          </div>

          {/* Navigation */}
          <nav className="flex items-center gap-4">
            <Link
              href="/dashboard"
              className={`text-sm font-medium transition-colors ${
                pathname === '/dashboard'
                  ? 'text-blue-600'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Dashboard
            </Link>
            <Link
              href="/products"
              className={`text-sm font-medium transition-colors ${
                pathname === '/products'
                  ? 'text-blue-600'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Produkty
            </Link>
            <Link
              href="/settings"
              className={`text-sm font-medium transition-colors ${
                pathname === '/settings'
                  ? 'text-blue-600'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Ustawienia
            </Link>
            <button
              onClick={handleLogout}
              className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
            >
              Wyloguj
            </button>
          </nav>
        </div>
      </div>
    </header>
  )
}
