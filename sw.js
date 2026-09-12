/* Smart Hisab Pro — Service Worker
   Strategy:
   - App shell (HTML/CSS/JS/manifest/icons): cache-first, so UI loads instantly offline.
   - CDN libraries (Chart.js, jsPDF): cache-first with network fallback.
   - Google Apps Script API calls: NEVER cached here — the app's own JS layer
     handles cache-first-then-revalidate for data via localStorage, so the
     service worker just lets those requests pass straight to the network.
*/

const CACHE_NAME = 'hisab-pro-shell-v1';
const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Never intercept the Apps Script API — always go to network so data stays live.
  if (url.hostname.includes('script.google.com') || url.hostname.includes('script.googleusercontent.com')) {
    return;
  }

  // Only handle GET requests.
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      const networkFetch = fetch(event.request)
        .then((response) => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => cached);
      // Cache-first for instant load; refresh cache in background.
      return cached || networkFetch;
    })
  );
});
