/* Sugar City service worker.
 * Purpose: make the site installable and show a friendly page when offline.
 * It never caches the API or app files: menus, prices and order status are
 * always fetched fresh, and new deploys appear on the next visit. Only the
 * offline page (and the logo it shows) are kept. */
const CACHE = 'sc-offline-v1';
const OFFLINE_URL = '/offline.html';
const OFFLINE_ASSETS = [OFFLINE_URL, '/brand/sugarcity-logo.png'];

self.addEventListener('install', (event) => {
  // Failing to cache must not block installation.
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(OFFLINE_ASSETS.map((url) => new Request(url, { cache: 'reload' }))))
      .catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .catch(() => {})
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);

  // Page loads: network only, with the offline page as the fallback.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(async () => (await caches.match(OFFLINE_URL).catch(() => undefined)) || Response.error())
    );
    return;
  }

  // The offline page's logo: network first, cached copy only when offline.
  if (url.origin === self.location.origin && OFFLINE_ASSETS.includes(url.pathname)) {
    event.respondWith(
      fetch(request).catch(async () => (await caches.match(url.pathname).catch(() => undefined)) || Response.error())
    );
  }
  // Everything else (API, scripts, images) goes straight to the network untouched.
});
