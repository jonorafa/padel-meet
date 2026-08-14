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

// Certains navigateurs intégrés (constaté avec celui de WhatsApp) ont un bug
// connu : une requête de navigation interceptée par un service worker peut ne
// JAMAIS se résoudre — ni succès, ni échec, ni timeout réseau — laissant la
// page bloquée indéfiniment en plein chargement (barre d'adresse figée sur le
// spinner). Un rechargement manuel déclenche une nouvelle tentative qui,
// elle, aboutit généralement. Sans ce filet, le fetch() ci-dessous pouvait
// rester en attente pour toujours : `respondWith` n'étant jamais résolu, la
// navigation ne se terminait jamais.
function fetchAvecDelai(request, delaiMs = 8000) {
  return new Promise((resolve, reject) => {
    const minuteur = setTimeout(() => reject(new Error('TIMEOUT_RESEAU')), delaiMs);
    fetch(request).then(
      (reponse) => { clearTimeout(minuteur); resolve(reponse); },
      (erreur)  => { clearTimeout(minuteur); reject(erreur); },
    );
  });
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Laisse passer (sans intercepter) : non-GET, et tout ce qui n'est pas même origine
  // → Supabase REST/Realtime/Auth, Sentry, CDN de polices, etc.
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;

  // Navigations SPA : réseau d'abord (avec délai de sécurité), repli app
  // shell hors-ligne ou sur ce bug de navigateur.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetchAvecDelai(request).catch(() => caches.match('/index.html'))
    );
    return;
  }

  // Assets statiques de même origine : réseau d'abord, mise en cache, repli cache
  event.respondWith(
    fetchAvecDelai(request)
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
