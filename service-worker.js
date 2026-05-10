/**
 * CURIOSA — Service Worker
 * Cache-first · Offline complet · Compatible PWA install
 */

const CACHE_NAME = 'curiosa-v2';
const STATIC_ASSETS = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './data.json',
  './manifest.json',
  './icons/icon-72.png',
  './icons/icon-96.png',
  './icons/icon-128.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
];

// ── INSTALL : pré-cache de tous les assets statiques
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting()) // skipWaiting DANS waitUntil
  );
});

// ── ACTIVATE : suppression des anciens caches + prise de contrôle immédiate
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

// ── FETCH : Cache-first avec fallback réseau
self.addEventListener('fetch', event => {
  // Ignorer les non-GET et les extensions Chrome internes
  if (event.request.method !== 'GET') return;
  if (event.request.url.startsWith('chrome-extension://')) return;

  const url = new URL(event.request.url);

  // Laisser passer les requêtes cross-origin non-fonts sans intercepter
  const isSameOrigin = url.origin === self.location.origin;
  const isFontRequest = url.hostname.includes('fonts.googleapis.com')
                     || url.hostname.includes('fonts.gstatic.com');
  if (!isSameOrigin && !isFontRequest) return;

  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;

      return fetch(event.request.clone())
        .then(response => {
          // Ne cacher que les réponses valides
          if (!response || response.status !== 200 || response.type === 'error') {
            return response;
          }
          const toCache = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, toCache));
          return response;
        })
        .catch(() => {
          // Offline : retourner la page principale pour les navigations
          if (event.request.mode === 'navigate') {
            return caches.match('./index.html');
          }
        });
    })
  );
});
