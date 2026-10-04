'use client'

import { useSyncExternalStore } from 'react'
import { usePathname } from 'next/navigation'

function subscribe(onChange: () => void) {
  window.addEventListener('online', onChange)
  window.addEventListener('offline', onChange)
  return () => {
    window.removeEventListener('online', onChange)
    window.removeEventListener('offline', onChange)
  }
}

const getOnline = () => navigator.onLine
// Server render assumes online so the banner never flashes during hydration.
const getServerOnline = () => true

/**
 * Slim bar shown above the bottom navigation while the browser reports no
 * connection. Cached data may be served by the service worker (docs/offline.md).
 */
export default function OfflineBanner() {
  const online = useSyncExternalStore(subscribe, getOnline, getServerOnline)
  const pathname = usePathname()

  // BottomNav (~77px + safe area) is hidden on /login; the bar then sits at the very bottom.
  const position =
    pathname === '/login'
      ? 'bottom-0 pb-[calc(0.375rem+env(safe-area-inset-bottom))]'
      : 'bottom-[calc(77px+env(safe-area-inset-bottom))] pb-1.5'

  // The live region stays mounted so screen readers announce the change.
  return (
    <div
      role="status"
      className={
        online
          ? undefined
          : `fixed left-0 right-0 z-50 bg-amber-100 border-t border-amber-300 text-amber-900 text-xs text-center px-4 pt-1.5 ${position}`
      }
    >
      {online ? null : 'Brak połączenia. Pokazuję ostatnie zapisane dane, zmiany mogą się nie zapisać.'}
    </div>
  )
}
