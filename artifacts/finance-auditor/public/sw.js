/* Amise Finance Auditor — Service Worker (cache-first with network update) */
const CACHE = 'amise-finance-v1';

/* On install: cache the app shell */
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then(cache =>
      cache.addAll(['/', '/index.html', '/manifest.webmanifest', '/icon.svg', '/icon-maskable.svg'])
        .catch(() => {}) // non-fatal — Vercel may serve / differently
    )
  );
  self.skipWaiting();
});

/* On activate: remove stale caches */
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

/* On fetch: serve from cache, update in background (stale-while-revalidate) */
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  /* Skip cross-origin requests (Anthropic API, Google Fonts) */
  if (url.origin !== self.location.origin) return;

  e.respondWith(
    caches.open(CACHE).then(cache =>
      cache.match(e.request).then(cached => {
        const networkFetch = fetch(e.request).then(resp => {
          if (resp && resp.ok) cache.put(e.request, resp.clone());
          return resp;
        }).catch(() => undefined);

        /* Return cached version immediately; update cache in background */
        return cached ?? networkFetch;
      })
    )
  );
});
