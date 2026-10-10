'use client'

import { useEffect } from 'react'

/**
 * Registers the offline service worker (public/sw.js) in production builds.
 * In development it removes any previously installed worker so dev builds are
 * never served stale assets. A new worker taking control does not reload the
 * page (that could drop an unsaved form); the next navigation picks it up.
 * See docs/offline.md.
 */
export default function ServiceWorkerRegistration() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return

    if (process.env.NODE_ENV !== 'production') {
      navigator.serviceWorker
        .getRegistrations()
        .then((registrations) => Promise.all(registrations.map((r) => r.unregister())))
        .catch(() => {})
      return
    }

    let supabaseOrigin = ''
    try {
      supabaseOrigin = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').origin
    } catch {
      // Without a Supabase origin the worker still caches static assets and pages.
    }
    const scriptUrl = supabaseOrigin ? `/sw.js?supabase=${encodeURIComponent(supabaseOrigin)}` : '/sw.js'

    navigator.serviceWorker
      .register(scriptUrl, { scope: '/', updateViaCache: 'none' })
      .catch((error) => console.warn('Service worker registration failed', error))
  }, [])

  return null
}

/** Tells the active worker to drop per-user caches (sign-out, user change). */
export function clearServiceWorkerUserCaches() {
  postToServiceWorker({ type: 'clear-user-caches' })
}

/** Tells the active worker to fetch the main routes into its cache (after sign-in). */
export function warmServiceWorkerRoutes() {
  postToServiceWorker({ type: 'warm-routes' })
}

function postToServiceWorker(message: { type: string }) {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return
  const controller = navigator.serviceWorker.controller
  if (controller) {
    controller.postMessage(message)
    return
  }
  // Not controlling yet (first load): deliver once it is.
  navigator.serviceWorker.ready
    .then((registration) => registration.active?.postMessage(message))
    .catch(() => {})
}
