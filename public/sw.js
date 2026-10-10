/*
 * Meal Planner service worker: a conservative, runtime-only offline layer.
 * Plain JS, no build step, no library. Docs: docs/offline.md
 *
 * Bump CACHE_VERSION whenever the caching logic changes; activate() then drops
 * every cache from older versions.
 *
 * v2 (2026-10-11): REST reads no longer fall back to cache on a slow network
 * (only on a failed fetch or while offline); per-user caches are wiped by a
 * message from the app on sign-out / user change, with an "epoch" so responses
 * started before the wipe are never stored; main routes are warmed after
 * activation and on sign-in.
 */
'use strict'

const CACHE_VERSION = 'v2'
const CACHE_PREFIX = 'mp-'
const STATIC_CACHE = `${CACHE_PREFIX}static-${CACHE_VERSION}`
const PAGES_CACHE = `${CACHE_PREFIX}pages-${CACHE_VERSION}`
const REST_CACHE = `${CACHE_PREFIX}rest-${CACHE_VERSION}`
const IMAGES_CACHE = `${CACHE_PREFIX}images-${CACHE_VERSION}`
const CURRENT_CACHES = [STATIC_CACHE, PAGES_CACHE, REST_CACHE, IMAGES_CACHE]
/** Caches holding per-user data; wiped on sign-out / user change. */
const USER_CACHES = [PAGES_CACHE, REST_CACHE, IMAGES_CACHE]

/** HTML navigations only: a page shell is static, so a slow network may serve the cached copy. */
const NAVIGATION_TIMEOUT_MS = 4000
const LIMITS = {
  [STATIC_CACHE]: 300,
  [PAGES_CACHE]: 30,
  [REST_CACHE]: 200,
  [IMAGES_CACHE]: 100,
}
/** Routes fetched into the pages cache right after activation and on sign-in. */
const WARM_ROUTES = ['/dashboard', '/meals', '/shopping-list', '/products', '/settings']

/**
 * Epoch: bumped on every per-user cache wipe. A response whose request started
 * in an older epoch is not stored, so a late reply with the previous user's token
 * cannot repopulate the cache after sign-out.
 */
let epoch = 0

// Supabase origin comes from the registration URL: /sw.js?supabase=<origin>
const SUPABASE_ORIGIN = (() => {
  try {
    const raw = new URLSearchParams(self.location.search).get('supabase')
    if (!raw) return null
    const url = new URL(raw)
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.origin : null
  } catch {
    return null
  }
})()

const STORAGE_PUBLIC_PREFIX = '/storage/v1/object/public/'

self.addEventListener('install', () => {
  // Nothing is precached: Next.js hashes its assets, so a static list would go stale.
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys()
      await Promise.all(
        names
          .filter((name) => name.startsWith(CACHE_PREFIX) && !CURRENT_CACHES.includes(name))
          .map((name) => caches.delete(name))
      )
      await self.clients.claim()
      await warmRoutes()
    })()
  )
})

// Messages from the app (CurrentUserProvider): wipe per-user data, warm the main routes.
self.addEventListener('message', (event) => {
  const type = event.data && event.data.type
  if (type === 'clear-user-caches') {
    event.waitUntil(clearUserCaches())
  } else if (type === 'warm-routes') {
    event.waitUntil(warmRoutes())
  }
})

self.addEventListener('fetch', (event) => {
  const request = event.request
  let url
  try {
    url = new URL(request.url)
  } catch {
    return
  }

  // Sign-out: observe (never intercept) the call and drop per-user data. The app also
  // sends `clear-user-caches` for sign-outs that do not go through this request.
  if (SUPABASE_ORIGIN && url.origin === SUPABASE_ORIGIN && url.pathname.startsWith('/auth/v1/logout')) {
    event.waitUntil(clearUserCaches())
    return
  }

  // Never touch writes, range requests or anything auth-related.
  if (request.method !== 'GET') return
  if (request.headers.has('range')) return

  if (url.origin === self.location.origin) {
    handleSameOrigin(event, request, url)
    return
  }

  if (SUPABASE_ORIGIN && url.origin === SUPABASE_ORIGIN) {
    handleSupabase(event, request, url)
  }
  // Any other cross-origin request: browser default.
})

function handleSameOrigin(event, request, url) {
  const path = url.pathname
  if (path.startsWith('/api/') || path.startsWith('/auth/') || path === '/sw.js') return

  if (path.startsWith('/_next/static/')) {
    event.respondWith(cacheFirst(event, request, STATIC_CACHE))
    return
  }

  // next/image proxies Supabase storage images through the app origin.
  if (path === '/_next/image' && isSupabaseStorageUrl(url.searchParams.get('url'))) {
    event.respondWith(cacheFirst(event, request, IMAGES_CACHE))
    return
  }

  if (request.mode === 'navigate') {
    event.respondWith(networkFirstNavigation(event, request, url))
  }
  // Everything else (RSC payloads, prefetches, public files): browser default.
}

function handleSupabase(event, request, url) {
  const path = url.pathname
  if (path.startsWith('/rest/v1/')) {
    event.respondWith(networkFirstRest(event, request))
    return
  }
  if (path.startsWith(STORAGE_PUBLIC_PREFIX)) {
    event.respondWith(cacheFirst(event, request, IMAGES_CACHE))
  }
  // /auth/v1/, /realtime/, private /storage/: browser default.
}

function isSupabaseStorageUrl(raw) {
  if (!SUPABASE_ORIGIN || !raw) return false
  try {
    const url = new URL(raw)
    return url.origin === SUPABASE_ORIGIN && url.pathname.startsWith(STORAGE_PUBLIC_PREFIX)
  } catch {
    return false
  }
}

// ---------------------------------------------------------------------------
// Strategies
// ---------------------------------------------------------------------------

/** Immutable or rarely changing assets: cache first, network on miss (only 200s are stored). */
async function cacheFirst(event, request, cacheName) {
  const cache = await caches.open(cacheName)
  const cached = await cache.match(request)
  if (cached) return cached

  const startedIn = epoch
  const response = await fetch(request)
  if (response.status === 200) {
    event.waitUntil(putAndTrim(cacheName, request, response.clone(), startedIn))
  }
  return response
}

/**
 * HTML navigations: network first; after NAVIGATION_TIMEOUT_MS (or on network
 * failure) serve the last good copy for the same pathname. No cached copy ->
 * keep waiting for the network and let the browser show its own error.
 */
function networkFirstNavigation(event, request, url) {
  const key = new Request(url.origin + url.pathname)
  const startedIn = epoch
  const network = fetch(request).then((response) => {
    event.waitUntil(onNavigationResponse(key, response.clone(), startedIn))
    return response
  })
  // Keep the worker alive so a late response still refreshes the cache.
  event.waitUntil(network.then(noop, noop))

  return withCacheFallback(network, PAGES_CACHE, key, NAVIGATION_TIMEOUT_MS)
}

async function onNavigationResponse(key, response, startedIn) {
  const finalPath = response.url ? new URL(response.url).pathname : ''
  // Landing on /login (directly or via the auth redirect) means there is no session.
  if (finalPath === '/login' || finalPath.startsWith('/login/')) {
    await clearUserCaches()
    return
  }
  const type = response.headers.get('content-type') || ''
  if (response.status === 200 && response.type === 'basic' && !response.redirected && type.includes('text/html')) {
    await putAndTrim(PAGES_CACHE, key, response, startedIn)
  }
}

/**
 * Supabase REST GETs: always the network while it answers, however slowly, so
 * read-modify-write flows never compute on stale data. The cached copy (last 200
 * for the same URL + Accept/Accept-Profile/Prefer headers) is served only when
 * the fetch itself fails or the device reports itself offline.
 */
function networkFirstRest(event, request) {
  const key = restCacheKey(request)
  const startedIn = epoch
  const network = fetch(request).then((response) => {
    if (response.status === 200) {
      event.waitUntil(putAndTrim(REST_CACHE, key, response.clone(), startedIn))
    }
    return response
  })
  event.waitUntil(network.then(noop, noop))

  // Known offline: do not wait for a fetch that will only fail after a long time.
  if (self.navigator && self.navigator.onLine === false) {
    return caches
      .open(REST_CACHE)
      .then((cache) => cache.match(key))
      .then((cached) => cached || network)
  }
  return withCacheFallback(network, REST_CACHE, key, null)
}

function restCacheKey(request) {
  const vary = ['accept', 'accept-profile', 'prefer']
    .map((name) => `${name}=${request.headers.get(name) || ''}`)
    .join('&')
  const url = new URL(request.url)
  url.searchParams.set('__sw_vary', vary)
  return new Request(url.toString())
}

/**
 * Resolves with the network response when it arrives. With a timeout, a cached
 * copy wins once the timeout passes; without one (null) the cache is used only
 * when the network fails. No cached copy -> the network result (or its error).
 */
function withCacheFallback(network, cacheName, key, timeoutMs) {
  return new Promise((resolve, reject) => {
    let settled = false
    let timer
    const settle = (fn, value) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      fn(value)
    }
    const fromCache = () => caches.open(cacheName).then((cache) => cache.match(key))

    if (timeoutMs !== null) {
      timer = setTimeout(() => {
        fromCache().then((cached) => {
          if (cached) settle(resolve, cached)
        }, noop)
      }, timeoutMs)
    }

    network.then(
      (response) => settle(resolve, response),
      (error) => {
        fromCache().then(
          (cached) => (cached ? settle(resolve, cached) : settle(reject, error)),
          () => settle(reject, error)
        )
      }
    )
  })
}

// ---------------------------------------------------------------------------
// Cache helpers
// ---------------------------------------------------------------------------

/**
 * Insert (moving the key to the newest position) and drop the oldest entries over
 * the cap. Skipped when a per-user wipe happened after the request started.
 */
async function putAndTrim(cacheName, key, response, startedIn) {
  if (startedIn !== undefined && startedIn !== epoch) return
  try {
    const cache = await caches.open(cacheName)
    await cache.delete(key)
    await cache.put(key, response)
    const limit = LIMITS[cacheName]
    if (!limit) return
    const keys = await cache.keys()
    for (let i = 0; i < keys.length - limit; i++) {
      await cache.delete(keys[i])
    }
  } catch {
    // Quota or body errors must never break the page.
  }
}

function clearUserCaches() {
  epoch += 1
  return Promise.all(USER_CACHES.map((name) => caches.delete(name)))
}

/**
 * Fetches the main routes into the pages cache so they open offline even if the
 * user has not visited them in this session. Uses the browser's cookies; a
 * redirect to /login (no session) stores nothing.
 */
async function warmRoutes() {
  const startedIn = epoch
  await Promise.all(
    WARM_ROUTES.map(async (path) => {
      try {
        const response = await fetch(new Request(self.location.origin + path, { credentials: 'include' }))
        await onNavigationResponse(new Request(self.location.origin + path), response, startedIn)
      } catch {
        // offline or server error: nothing to warm
      }
    })
  )
}

function noop() {}
