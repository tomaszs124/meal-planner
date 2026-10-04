import type { MetadataRoute } from 'next'

/**
 * Web app manifest so the planner can be installed on a phone home screen
 * (served at /manifest.webmanifest and linked automatically by Next.js).
 * Icons are generated placeholders: replace public/icon-*.png with real artwork.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Meal Planner',
    short_name: 'Meal Planner',
    description: 'Planowanie posiłków i zakupów dla domowników',
    lang: 'pl',
    start_url: '/dashboard',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#ffffff',
    theme_color: '#16a34a',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  }
}
