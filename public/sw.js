/*
 * Meal Planner service worker: a conservative, runtime-only offline layer.
 * Plain JS, no build step, no library. Docs: docs/offline.md
 *
 * Bump CACHE_VERSION whenever the caching logic changes; activate() then drops
 * every cache from older versions.
 */
'use strict'

const CACHE_VERSION = 'v1'
const CACHE_PREFIX = 'mp-'
const STATIC_CACHE = `${CACHE_PREFIX}static-${CACHE_VERSION}`
const PAGES_CACHE = `${CACHE_PREFIX}pages-${CACHE_VERSION}`
const REST_CACHE = `${CACHE_PREFIX}rest-${CACHE_VERSION}`
const IMAGES_CACHE = `${CACHE_PREFIX}images-${CACHE_VERSION}`
const CURRENT_CACHES = [STATIC_CACHE, PAGES_CACHE, REST_CACHE, IMAGES_CACHE]
/** Caches holding per-user data; wiped on logout. */
const USER_CACHES = [PAGES_CACHE, REST_CACHE]

const NETWORK_TIMEOUT_MS = 4000
const LIMITS = {
  [STATIC_CACHE]: 300,
  [PAGES_CACHE]: 30,
  [REST_CACHE]: 200,
  [IMAGES_CACHE]: 100,
}

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
    })()
  )
})

self.addEventListener('fetch', (event) => {
  const request = event.request
  let url
  try {
    url = new URL(request.url)
  } catch {
    return
  }

  // Logout: observe (never intercept) the sign-out call and drop per-user data.
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

  const response = await fetch(request)
  if (response.status === 200) {
    event.waitUntil(putAndTrim(cacheName, request, response.clone()))
  }
  return response
}

/**
 * HTML navigations: network first; after NETWORK_TIMEOUT_MS (or on network
 * failure) serve the last good copy for the same pathname. No cached copy ->
 * keep waiting for the network and let the browser show its own error.
 */
function networkFirstNavigation(event, request, url) {
  const key = new Request(url.origin + url.pathname)
  const network = fetch(request).then((response) => {
    event.waitUntil(onNavigationResponse(key, response.clone()))
    return response
  })
  // Keep the worker alive so a late response still refreshes the cache.
  event.waitUntil(network.then(noop, noop))

  return withCacheFallback(network, PAGES_CACHE, key)
}

async function onNavigationResponse(key, response) {
  const finalPath = response.url ? new URL(response.url).pathname : ''
  // Landing on /login (directly or via the auth redirect) means there is no session.
  if (finalPath === '/login' || finalPath.startsWith('/login/')) {
    await clearUserCaches()
    return
  }
  const type = response.headers.get('content-type') || ''
  if (response.status === 200 && response.type === 'basic' && !response.redirected && type.includes('text/html')) {
    await putAndTrim(PAGES_CACHE, key, response)
  }
}

/**
 * Supabase REST GETs: network first with the same timeout, falling back to the
 * last 200 response for the same URL (+ Accept/Accept-Profile/Prefer headers,
 * which change the response shape, e.g. `.single()` or `count`). The
 * Authorization header cannot be part of the key, hence the wipe on logout.
 */
function networkFirstRest(event, request) {
  const key = restCacheKey(request)
  const network = fetch(request).then((response) => {
    if (response.status === 200) {
      event.waitUntil(putAndTrim(REST_CACHE, key, response.clone()))
    }
    return response
  })
  event.waitUntil(network.then(noop, noop))

  return withCacheFallback(network, REST_CACHE, key)
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
 * Resolves with the network response if it arrives within the timeout. On
 * timeout or network failure serves the cached copy when there is one;
 * otherwise keeps waiting for (or rethrows) the network result.
 */
function withCacheFallback(network, cacheName, key) {
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

    timer = setTimeout(() => {
      fromCache().then((cached) => {
        if (cached) settle(resolve, cached)
      }, noop)
    }, NETWORK_TIMEOUT_MS)

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

/** Insert (moving the key to the newest position) and drop the oldest entries over the cap. */
async function putAndTrim(cacheName, key, response) {
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
  return Promise.all(USER_CACHES.map((name) => caches.delete(name)))
}

function noop() {}
