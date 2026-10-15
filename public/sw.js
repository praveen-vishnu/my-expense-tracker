const CACHE_NAME = 'pennywise-v2'
const STATIC_ASSETS = [
  '/favicon.svg',
  '/manifest.json',
]

// Install: precache basic static icons/manifest and skip waiting immediately
self.addEventListener('install', (event) => {
  self.skipWaiting()
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch(() => {})
    })
  )
})

// Activate: delete old caches (including pennywise-v1) and claim clients immediately
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => {
          console.log('[SW] Deleting legacy cache:', key)
          return caches.delete(key)
        })
      )
    }).then(() => self.clients.claim())
  )
})

// Fetch strategy
self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  // 1. Completely ignore non-GET, non-http(s), and external extension requests (QuillBot, etc.)
  if (
    request.method !== 'GET' ||
    !url.protocol.startsWith('http') ||
    url.origin !== self.location.origin ||
    url.hostname.includes('supabase.co') ||
    url.hostname.includes('googleapis.com')
  ) {
    return
  }

  // 2. Navigation / HTML Document requests: ALWAYS Network-First
  // This ensures new deployments and asset hashes are never stuck on stale index.html
  if (request.mode === 'navigate' || request.destination === 'document') {
    event.respondWith(
      fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseCopy = networkResponse.clone()
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseCopy).catch(() => {})
            }).catch(() => {})
          }
          return networkResponse
        })
        .catch(() => {
          // Offline fallback
          return caches.match(request).then((cached) => cached || caches.match('/index.html'))
        })
    )
    return
  }

  // 3. Static Assets (/assets/ hashed JS/CSS, fonts, images): Cache-first with network fallback
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse
      }

      return fetch(request).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
          const responseCopy = networkResponse.clone()
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseCopy).catch(() => {})
          }).catch(() => {})
        }
        return networkResponse
      })
    })
  )
})
