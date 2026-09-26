/**
 * Service Worker - School ERP
 * Network-First Strategy for dynamic, multi-tenant student lifecycles
 * Web Push Notifications & Window Interaction Handlers
 */

const CACHE_NAME = 'school-erp-v1';
const PRECACHE_ASSETS = [
  '/',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png'
];

// Install event: Pre-cache foundational structural assets resiliently and activate immediately
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      for (const asset of PRECACHE_ASSETS) {
        try {
          await cache.add(asset);
        } catch (err) {
          console.warn('[PWA ServiceWorker] Pre-cache skipped asset:', asset, err);
        }
      }
    }).then(() => {
      return self.skipWaiting();
    })
  );
});

// Activate event: Clean up previous cache versions and claim clients immediately
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    }).then(() => {
      return self.clients.claim();
    })
  );
});

// Fetch event: Strict Network-First strategy
// Ensures live School ERP data is ALWAYS fetched from bonaveeict.com.ng when online.
// Cache acts strictly as an offline fallback or shell container.
self.addEventListener('fetch', (event) => {
  const request = event.request;

  // Only handle GET requests from http / https protocols
  if (request.method !== 'GET') {
    return;
  }

  const url = new URL(request.url);
  if (!url.protocol.startsWith('http')) {
    return;
  }

  event.respondWith(
    fetch(request)
      .then((networkResponse) => {
        // When online and response is successful, update cache with a clone
        if (networkResponse && networkResponse.status === 200) {
          const responseClone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseClone);
          });
        }
        return networkResponse;
      })
      .catch(async () => {
        // Network unavailable / offline: fallback to cached resource
        const cachedResponse = await caches.match(request);
        if (cachedResponse) {
          return cachedResponse;
        }

        // For navigation requests falling back offline, provide root shell
        if (request.mode === 'navigate') {
          const fallbackShell = await caches.match('/');
          if (fallbackShell) {
            return fallbackShell;
          }
        }

        return new Response('Network offline. Unable to retrieve live School ERP data.', {
          status: 503,
          statusText: 'Service Unavailable',
          headers: new Headers({
            'Content-Type': 'text/plain'
          })
        });
      })
  );
});

// Push event: Parse incoming notification payload and display on device
self.addEventListener('push', (event) => {
  let data = {};
  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      data = { title: 'School ERP Notification', body: event.data.text() };
    }
  }

  const title = data.title || 'School ERP Alert';
  const options = {
    body: data.body || 'You have an important school update.',
    icon: data.icon || '/icon-192.png',
    badge: data.badge || '/icon-192.png',
    image: data.image || undefined,
    data: {
      url: data.url || data.link || '/',
      timestamp: Date.now(),
      ...data.data,
    },
    vibrate: data.vibrate || [100, 50, 100],
    tag: data.tag || 'school-erp-notification',
    renotify: true,
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

// Notification click event: Close alert and open/focus tenant window
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const rawUrl = (event.notification.data && event.notification.data.url)
    ? event.notification.data.url
    : '/';
  const targetUrl = new URL(rawUrl, self.location.origin).href;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(async (clientList) => {
      // 1. Focus exact match if open
      for (const client of clientList) {
        if (client.url === targetUrl && 'focus' in client) {
          return client.focus();
        }
      }
      // 2. Navigate and focus existing window on same origin
      for (const client of clientList) {
        if ('focus' in client && 'navigate' in client && client.url.includes(self.location.origin)) {
          await client.navigate(targetUrl).catch(() => {});
          return client.focus();
        }
      }
      // 3. Open new window if none active
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
