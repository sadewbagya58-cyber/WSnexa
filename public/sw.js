/**
 * WSNexa Production Service Worker
 * Phase 38 Offline-First Resilience
 *
 * Implements:
 * 1. Network-First with Cache-Fallback for HTML navigations
 * 2. Cache-First for immutable Next.js static chunks (/_next/static/*)
 * 3. Stale-While-Revalidate for brand assets & public images
 * 4. Safe cache versioning & automatic cleanup of obsolete caches
 * 5. Bypasses API routes & Server Actions (handled by SyncQueue)
 */

const CACHE_VERSION = 'wsnexa-v1';
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const PAGES_CACHE = `${CACHE_VERSION}-pages`;

const PRECACHE_ASSETS = [
  '/',
  '/dashboard',
  '/brand/ws-mark.png',
  '/brand/wsnexa-full-logo.png',
  '/favicon.ico',
];

// 1. Install Event: Precache core shell assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => cache.addAll(PRECACHE_ASSETS).catch((err) => {
        console.warn('[SW] Precache asset caching partial warning:', err);
      }))
      .then(() => self.skipWaiting())
  );
});

// 2. Activate Event: Clean up outdated caches
self.addEventListener('activate', (event) => {
  const currentCaches = [STATIC_CACHE, PAGES_CACHE];
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) =>
        Promise.all(
          cacheNames.map((cacheName) => {
            if (!currentCaches.includes(cacheName)) {
              console.log('[SW] Deleting obsolete cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        )
      )
      .then(() => self.clients.claim())
  );
});

// 3. Fetch Event
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Ignore non-HTTP(S) schemes (e.g. chrome-extension, capacitor)
  if (!url.protocol.startsWith('http')) {
    return;
  }

  // Never cache API routes, sync endpoints, or POST/PUT/DELETE mutations
  if (
    request.method !== 'GET' ||
    url.pathname.startsWith('/api/') ||
    url.pathname.startsWith('/auth/')
  ) {
    return;
  }

  // Strategy A: Next.js static assets & chunks (/_next/static/*) -> Cache First
  if (url.pathname.startsWith('/_next/static/') || url.pathname.startsWith('/brand/')) {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse;
        }
        return fetch(request)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              const responseToCache = networkResponse.clone();
              caches.open(STATIC_CACHE).then((cache) => {
                cache.put(request, responseToCache);
              });
            }
            return networkResponse;
          })
          .catch(() => cachedResponse);
      })
    );
    return;
  }

  // Strategy B: Navigation requests (HTML pages) -> Network First with Cache Fallback
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseToCache = networkResponse.clone();
            caches.open(PAGES_CACHE).then((cache) => {
              cache.put(request, responseToCache);
            });
          }
          return networkResponse;
        })
        .catch(async () => {
          // Device is offline: retrieve cached page
          const cachedResponse = await caches.match(request);
          if (cachedResponse) {
            return cachedResponse;
          }
          // If specific route is not cached, return cached /dashboard or root shell
          const fallbackDashboard = await caches.match('/dashboard');
          if (fallbackDashboard) {
            return fallbackDashboard;
          }
          const fallbackRoot = await caches.match('/');
          if (fallbackRoot) {
            return fallbackRoot;
          }
          return new Response('Offline - WSNexa Application Shell unavailable', {
            status: 503,
            headers: { 'Content-Type': 'text/plain' },
          });
        })
    );
    return;
  }

  // Strategy C: Other GET requests (e.g. RSC payload ?_rsc=...) -> Stale While Revalidate
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      const fetchPromise = fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseToCache = networkResponse.clone();
            caches.open(PAGES_CACHE).then((cache) => {
              cache.put(request, responseToCache);
            });
          }
          return networkResponse;
        })
        .catch(() => cachedResponse);

      return cachedResponse || fetchPromise;
    })
  );
});
