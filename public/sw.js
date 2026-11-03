const CACHE = 'afterlist-v2'

self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(
    keys.filter((key) => key.startsWith('afterlist-') && key !== CACHE).map((key) => caches.delete(key)),
  )).then(() => self.clients.claim()))
})

self.addEventListener('fetch', (event) => {
  const request = event.request
  const url = new URL(request.url)

  // Cache only the generic shell and build assets, never account paths or token URLs.
  if (request.method !== 'GET' || url.origin !== self.location.origin || url.search ||
    (url.pathname !== '/' && !url.pathname.startsWith('/assets/'))) return

  event.respondWith(fetch(request).then((response) => {
    if (response.ok) caches.open(CACHE).then((cache) => cache.put(request, response.clone()))
    return response
  }).catch(async () => {
    const cached = await caches.match(request)
    if (cached) return cached
    if (request.mode === 'navigate') return caches.match('/')
    return Response.error()
  }))
})
