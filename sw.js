/* ============================================================
   Gorillas — Service Worker
   Pre-cache app shell, stale-while-revalidate for local assets,
   network-first for CDN (Firebase SDK, Google Fonts)
   ============================================================ */

const CACHE_NAME = 'gorillas-shell-v1';
const SHELL_ASSETS = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './data.js',
  './bandwidth.js',
  './pages.js',
  './topology.js',
  './rack.js',
  './networks.js',
  './report.js',
  './ports.js',
  './sync.js',
  './render.js'
];

// ───────── Install: pre-cache app shell ─────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(SHELL_ASSETS))
      .then(() => self.skipWaiting())
  );
});

// ───────── Activate: clean old caches ─────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

// ───────── Fetch: strategy per origin ─────────
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET
  if (request.method !== 'GET') return;

  // Navigation (hash-routing SPA): serve cached shell, update in background
  if (request.mode === 'navigate') {
    event.respondWith(
      caches.match('./index.html').then(cached => {
        const fresh = fetch(request).then(resp => {
          if (resp && resp.ok) {
            const clone = resp.clone();
            caches.open(CACHE_NAME).then(c => c.put('./index.html', clone));
          }
          return resp;
        }).catch(() => cached);
        return cached || fresh;
      })
    );
    return;
  }

  // Same-origin assets: stale-while-revalidate
  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.match(request).then(cached => {
        const fresh = fetch(request).then(resp => {
          if (resp && resp.ok) {
            const clone = resp.clone();
            caches.open(CACHE_NAME).then(c => c.put(request, clone));
          }
          return resp;
        }).catch(() => cached);
        return cached || fresh;
      })
    );
    return;
  }

  // Cross-origin (Firebase SDK, Google Fonts): network-first, cache fallback
  event.respondWith(
    fetch(request).then(resp => {
      if (resp && (resp.ok || resp.type === 'opaque')) {
        const clone = resp.clone();
        caches.open(CACHE_NAME).then(c => c.put(request, clone));
      }
      return resp;
    }).catch(() => caches.match(request))
  );
});
