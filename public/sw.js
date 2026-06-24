const CACHE_PREFIX = 'rocks-dodgeball-recorder'
const CACHE_NAME = `${CACHE_PREFIX}-app-v1`
const STATIC_ASSET_PATHS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './pwa-assets.json',
  './icons/apple-touch-icon.png',
  './icons/pwa-192.png',
  './icons/pwa-512.png',
  './icons/maskable-512.png',
]

function scopedUrl(path) {
  return new URL(path, self.registration.scope).toString()
}

async function readBuildAssets() {
  try {
    const response = await fetch(scopedUrl('./pwa-assets.json'), { cache: 'no-store' })
    if (!response.ok) return []
    const manifest = await response.json()
    return Array.isArray(manifest.assets)
      ? manifest.assets.map((asset) => scopedUrl(asset))
      : []
  } catch {
    return []
  }
}

async function cacheAppShell() {
  const cache = await caches.open(CACHE_NAME)
  const urls = [
    ...STATIC_ASSET_PATHS.map(scopedUrl),
    ...(await readBuildAssets()),
  ]
  const uniqueUrls = [...new Set(urls)]

  await Promise.allSettled(
    uniqueUrls.map(async (url) => {
      const request = new Request(url, { cache: 'reload' })
      const response = await fetch(request)
      if (response.ok) {
        await cache.put(request, response)
      }
    }),
  )
}

self.addEventListener('install', (event) => {
  event.waitUntil(cacheAppShell())
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting()
    return
  }

  if (event.data?.type === 'CACHE_URLS' && Array.isArray(event.data.urls)) {
    event.waitUntil(
      caches.open(CACHE_NAME).then((cache) =>
        Promise.allSettled(
          event.data.urls
            .filter((url) => typeof url === 'string' && url.startsWith(self.registration.scope))
            .map((url) => cache.add(url)),
        ),
      ),
    )
  }
})

self.addEventListener('fetch', (event) => {
  const request = event.request
  if (request.method !== 'GET') return

  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return
  if (!url.href.startsWith(self.registration.scope)) return

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone()
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone))
          }
          return response
        })
        .catch(async () => {
          const cache = await caches.open(CACHE_NAME)
          return (
            (await cache.match(request)) ||
            (await cache.match(scopedUrl('./index.html'))) ||
            (await cache.match(scopedUrl('./')))
          )
        }),
    )
    return
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached

      return fetch(request).then((response) => {
        if (response.ok) {
          const clone = response.clone()
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone))
        }
        return response
      })
    }),
  )
})
