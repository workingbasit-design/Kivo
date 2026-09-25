/**
 * EveryJob service worker — offline-first for field workers.
 *
 * Strategy:
 *  - Navigations: network-first, fall back to the cached app shell, then
 *    to /offline when there's no connection at all.
 *  - /_next/static + /icons/*: cache-first (immutable build assets).
 *  - /api/*: network-only — never cache mutations or tenant data.
 *  - Other GET requests: stale-while-revalidate.
 *
 * Bump CACHE_VERSION to force clients onto a fresh shell after deploys.
 *
 * Push notifications (Web Push / VAPID):
 *  - `push`: shows a notification from the JSON payload
 *    { title, body, url, icon, tag }. Silent if the payload is empty.
 *  - `notificationclick`: focuses an open EveryJob tab or opens the
 *    deep-link URL (defaults to /dashboard).
 */
const CACHE_VERSION = 'kivo-v2';
const SHELL_CACHE = `${CACHE_VERSION}-shell`;
const ASSET_CACHE = `${CACHE_VERSION}-assets`;

const PRECACHE = ['/offline', '/icons/icon-192.png', '/manifest.webmanifest'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(SHELL_CACHE);
      await Promise.allSettled(PRECACHE.map((url) => cache.add(url)));
      // Take over immediately — field staff shouldn't need two visits.
      await self.skipWaiting();
    })()
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((k) => !k.startsWith(CACHE_VERSION))
          .map((k) => caches.delete(k))
      );
      await self.clients.claim();
    })()
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // API traffic is never cached.
  if (url.pathname.startsWith('/api/')) return;

  // Navigations: try network, fall back to cache, then the offline page.
  if (request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          const res = await fetch(request);
          const cache = await caches.open(SHELL_CACHE);
          cache.put(request, res.clone());
          return res;
        } catch {
          const cached = await caches.match(request);
          if (cached) return cached;
          const offline = await caches.match('/offline');
          return offline || Response.error();
        }
      })()
    );
    return;
  }

  // Immutable build assets + icons: cache-first.
  if (url.pathname.startsWith('/_next/static') || url.pathname.startsWith('/icons/')) {
    event.respondWith(
      (async () => {
        const cached = await caches.match(request);
        if (cached) return cached;
        const res = await fetch(request);
        const cache = await caches.open(ASSET_CACHE);
        cache.put(request, res.clone());
        return res;
      })()
    );
    return;
  }

  // Everything else: stale-while-revalidate.
  event.respondWith(
    (async () => {
      const cache = await caches.open(SHELL_CACHE);
      const cached = await cache.match(request);
      const network = fetch(request)
        .then((res) => {
          cache.put(request, res.clone());
          return res;
        })
        .catch(() => cached);
      return cached || network;
    })()
  );
});

/* ------------------------------------------------------------------ */
/* Web Push notifications                                               */
/* ------------------------------------------------------------------ */

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = {};
  }
  const title = typeof data.title === 'string' && data.title ? data.title : 'EveryJob';
  const body = typeof data.body === 'string' ? data.body : '';
  const url = typeof data.url === 'string' && data.url.startsWith('/') ? data.url : '/dashboard';
  const options = {
    body,
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    tag: typeof data.tag === 'string' && data.tag ? data.tag : 'everyjob',
    renotify: false,
    data: { url },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetPath =
    event.notification.data && typeof event.notification.data.url === 'string'
      ? event.notification.data.url
      : '/dashboard';
  const targetUrl = new URL(targetPath, self.location.origin).href;
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      for (const client of windows) {
        try {
          const clientUrl = new URL(client.url);
          if (clientUrl.origin === self.location.origin) {
            await client.focus();
            if ('navigate' in client && clientUrl.href !== targetUrl) {
              await client.navigate(targetUrl);
            }
            return;
          }
        } catch {
          // Fall through to opening a fresh window.
        }
      }
      if (self.clients.openWindow) {
        await self.clients.openWindow(targetUrl);
      }
    })()
  );
});
