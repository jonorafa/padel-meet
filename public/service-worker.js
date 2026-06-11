// ─────────────────────────────────────────────────────────────────────────────
// Service Worker — Padel Meet PWA
//
// Stratégie volontairement conservatrice :
//   • On n'intercepte QUE les GET de MÊME ORIGINE (assets statiques + navigations).
//   • On NE TOUCHE JAMAIS aux requêtes Supabase / Sentry / fonts (cross-origin) :
//     elles passent directement au réseau → jamais de données périmées ni d'auth
//     mise en cache.
//   • Navigations (SPA) : réseau d'abord, repli sur l'app shell hors-ligne.
//   • Assets statiques : réseau d'abord, repli sur le cache.
// ─────────────────────────────────────────────────────────────────────────────
const CACHE_NAME = 'padel-meet-v2';
const APP_SHELL = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
  '/apple-touch-icon.png',
  '/favicon.svg',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Laisse passer (sans intercepter) : non-GET, et tout ce qui n'est pas même origine
  // → Supabase REST/Realtime/Auth, Sentry, CDN de polices, etc.
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;

  // Navigations SPA : réseau d'abord, repli app shell hors-ligne
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() => caches.match('/index.html'))
    );
    return;
  }

  // Assets statiques de même origine : réseau d'abord, mise en cache, repli cache
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response && response.status === 200 && response.type === 'basic') {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
        }
        return response;
      })
      .catch(() => caches.match(request))
  );
});
