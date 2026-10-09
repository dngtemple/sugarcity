// Sugar City Studio service worker.
// It exists so the Studio can be installed on a phone's home screen. It caches
// one thing only — the offline page. Orders, stock and the app itself always
// come straight from the network, so a new deploy is live on the next visit.
const OFFLINE_CACHE = 'sc-studio-offline-v1';
const OFFLINE_URL = '/offline.html';

self.addEventListener('install', (event) => {
  // Never let a failed cache write block installation.
  event.waitUntil(
    caches.open(OFFLINE_CACHE).then((cache) => cache.add(OFFLINE_URL)).catch(() => undefined)
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== OFFLINE_CACHE).map((key) => caches.delete(key))))
      .catch(() => undefined)
      .then(() => self.clients.claim())
  );
});

// Page navigations only: try the network, show the offline page if it fails.
self.addEventListener('fetch', (event) => {
  if (event.request.mode !== 'navigate') return;
  event.respondWith(
    fetch(event.request).catch(async () => {
      const page = await caches.match(OFFLINE_URL).catch(() => undefined);
      return page || Response.error();
    })
  );
});
