/**
 * WSNexa Production Service Worker
 * Phase 38 Offline-First Resilience
 *
 * Implements:
 * 1. Network-First with In-App HTML Fallback for navigations
 * 2. Cache-First for immutable Next.js static chunks (/_next/static/*)
 * 3. Stale-While-Revalidate for brand assets & public images
 * 4. Safe cache versioning & automatic cleanup of obsolete caches
 * 5. Bypasses API routes & Server Actions (handled by SyncQueue)
 * 6. In-App "Connection Required" view on uncached offline navigation (no net::ERR_FAILED)
 */

const CACHE_NAME = 'wsnexa-v2';
const CACHE_VERSION = CACHE_NAME;
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const PAGES_CACHE = `${CACHE_VERSION}-pages`;

const PRECACHE_ASSETS = [
  '/',
  '/dashboard',
  '/brand/ws-mark.png',
  '/brand/wsnexa-full-logo.png',
  '/favicon.ico',
];

function getConnectionRequiredHtml() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover" />
  <title>WSNexa — Connection Required</title>
  <style>
    :root {
      --sat: env(safe-area-inset-top, 0px);
      --sab: env(safe-area-inset-bottom, 0px);
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      background-color: #ffffff;
      color: #09090b;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      padding-top: calc(max(env(safe-area-inset-top, 0px), var(--sat, 0px)) + 1rem);
      padding-bottom: calc(max(env(safe-area-inset-bottom, 0px), var(--sab, 0px)) + 1rem);
      padding-left: 1rem;
      padding-right: 1rem;
    }
    .header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      max-width: 480px;
      width: 100%;
      margin: 0 auto 2rem auto;
      padding: 0 0.5rem;
    }
    .logo-text {
      font-size: 1.125rem;
      font-weight: 900;
      letter-spacing: -0.025em;
      color: #09090b;
    }
    .offline-tag {
      font-size: 0.6875rem;
      font-weight: 800;
      background-color: #fef3c7;
      color: #92400e;
      border: 1px solid #fde68a;
      padding: 0.25rem 0.625rem;
      border-radius: 9999px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    .card {
      max-width: 480px;
      width: 100%;
      margin: auto auto;
      background: #ffffff;
      border: 1px solid #e4e4e7;
      border-radius: 1.25rem;
      padding: 2rem 1.5rem;
      text-align: center;
      box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.05);
    }
    .icon {
      width: 3.5rem;
      height: 3.5rem;
      border-radius: 9999px;
      background-color: #f4f4f5;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 1.75rem;
      margin: 0 auto 1.25rem auto;
    }
    h1 {
      font-size: 1.25rem;
      font-weight: 900;
      color: #09090b;
      margin-bottom: 0.5rem;
    }
    p {
      font-size: 0.8125rem;
      color: #71717a;
      line-height: 1.5;
      margin-bottom: 1.5rem;
    }
    .tool-group {
      display: flex;
      flex-direction: column;
      gap: 0.625rem;
      margin-bottom: 1.25rem;
    }
    .btn {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 100%;
      min-height: 46px;
      padding: 0.75rem 1rem;
      border-radius: 0.75rem;
      font-size: 0.8125rem;
      font-weight: 800;
      text-decoration: none;
      transition: all 0.15s ease;
      touch-action: manipulation;
      cursor: pointer;
    }
    .btn:active {
      transform: scale(0.98);
    }
    .btn-dark {
      background-color: #09090b;
      color: #ffffff;
      border: none;
    }
    .btn-outline {
      background-color: #fafafa;
      color: #18181b;
      border: 1px solid #d4d4d8;
    }
    .btn-secondary {
      background-color: transparent;
      color: #71717a;
      border: 1px solid #e4e4e7;
      font-weight: 600;
    }
    .notice {
      display: none;
      margin-top: 0.75rem;
      padding: 0.625rem;
      background-color: #fef3c7;
      border: 1px solid #fde68a;
      border-radius: 0.75rem;
      font-size: 0.75rem;
      font-weight: 600;
      color: #92400e;
    }
  </style>
</head>
<body>
  <div class="header">
    <span class="logo-text">WSNexa</span>
    <span class="offline-tag">Offline Mode</span>
  </div>

  <div class="card">
    <div class="icon">🌐</div>
    <h1>Connection Required</h1>
    <p>This section requires an active internet connection. Your offline tools (Take Order, Dining Tables, KDS) remain fully operational.</p>

    <div class="tool-group">
      <a href="/dashboard/waiter/order" class="btn btn-dark">Take Order (Offline Ready)</a>
      <a href="/dashboard/tables" class="btn btn-outline">Dining Tables</a>
    </div>

    <div style="display: flex; gap: 0.5rem; flex-direction: column;">
      <button type="button" onclick="handleRetry()" class="btn btn-secondary" id="retry-btn">🔄 Try Again</button>
      <a href="/dashboard" class="btn btn-secondary">Return to Dashboard</a>
    </div>

    <div id="offline-notice" class="notice">
      Device is still offline. Please connect to Wi-Fi or mobile data to access this section.
    </div>
  </div>

  <script>
    function handleRetry() {
      var notice = document.getElementById('offline-notice');
      var btn = document.getElementById('retry-btn');
      if (!navigator.onLine) {
        if (notice) notice.style.display = 'block';
        return;
      }
      if (btn) btn.textContent = 'Retrying...';
      window.location.reload();
    }
    window.addEventListener('online', function() {
      window.location.reload();
    });
  </script>
</body>
</html>`;
}

// 1. Install Event: Precache core shell assets safely
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then(async (cache) => {
        await Promise.allSettled(
          PRECACHE_ASSETS.map(async (asset) => {
            try {
              const res = await fetch(asset);
              if (res && res.status === 200) {
                await cache.put(asset, res);
              }
            } catch (err) {
              console.warn('[SW] Precache skipped for:', asset, err);
            }
          })
        );
      })
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
          .catch(() => {
            // Never return undefined: return safe 404 response
            return new Response('', {
              status: 404,
              headers: { 'X-WSNexa-Offline': '1' },
            });
          });
      })
    );
    return;
  }

  // Strategy B: Navigation requests (HTML pages) -> Network First with In-App Fallback
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
          // Device is offline: retrieve cached page if available
          const cachedResponse = await caches.match(request);
          if (cachedResponse) {
            return cachedResponse;
          }
          // If specific route is not cached, check if cached /dashboard exists
          const fallbackDashboard = await caches.match('/dashboard');
          if (fallbackDashboard) {
            return fallbackDashboard;
          }
          const fallbackRoot = await caches.match('/');
          if (fallbackRoot) {
            return fallbackRoot;
          }
          // Return in-app WSNexa "Connection Required" HTML (HTTP 200)
          return new Response(getConnectionRequiredHtml(), {
            status: 200,
            headers: {
              'Content-Type': 'text/html; charset=utf-8',
              'X-WSNexa-Offline': '1',
            },
          });
        })
    );
    return;
  }

  // Strategy C: Other GET requests (e.g. RSC payload ?_rsc=...) -> Network First with Safe Fallback
  event.respondWith(
    caches.match(request).then(async (cachedResponse) => {
      try {
        const networkResponse = await fetch(request);
        if (networkResponse && networkResponse.status === 200) {
          const responseToCache = networkResponse.clone();
          caches.open(PAGES_CACHE).then((cache) => {
            cache.put(request, responseToCache);
          });
        }
        return networkResponse;
      } catch (err) {
        if (cachedResponse) {
          return cachedResponse;
        }
        // Critical: NEVER return undefined!
        // Returning undefined causes Chromium to throw net::ERR_FAILED.
        if (url.searchParams.has('_rsc') || request.headers.get('RSC') === '1') {
          return new Response('', {
            status: 204,
            headers: {
              'Content-Type': 'text/x-component',
              'X-WSNexa-Offline': '1',
            },
          });
        }
        return new Response(JSON.stringify({ error: 'offline', offline: true }), {
          status: 503,
          headers: {
            'Content-Type': 'application/json',
            'X-WSNexa-Offline': '1',
          },
        });
      }
    })
  );
});
