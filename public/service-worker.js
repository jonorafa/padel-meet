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
//
// ── Deux caches, pour deux durées de vie différentes ────────────────────────
// La version précédente n'en avait qu'un, nommé en dur 'padel-meet-v2', jamais
// incrémenté. Conséquences :
//   • `install` ne se rejoue que si le fichier du SW change ; comme son contenu
//     était figé, l'index.html mis en cache datait de la toute première
//     installation et référençait des chunks d'un build révolu ;
//   • `activate` ne purgeait donc jamais rien, la condition de nettoyage
//     comparant le cache courant à lui-même.
// D'où la séparation :
//   • SHELL : versionné par build. Contient l'index.html et les icônes, dont
//     l'URL ne change PAS d'un déploiement à l'autre — c'est précisément ce qui
//     rendait le contenu périmable. Un nom de cache différent à chaque build
//     force une réinstallation propre et purge l'ancien.
//   • ASSETS : commun à tous les builds. Ne reçoit que /assets/*, dont le nom
//     porte un hachage de contenu : deux versions ne peuvent pas se recouvrir,
//     rien n'y est donc jamais périmé. Le garder en dehors de la purge permet à
//     un onglet resté ouvert pendant un déploiement de continuer à charger ses
//     propres chunks, qui n'existent plus côté serveur.
// ─────────────────────────────────────────────────────────────────────────────

// Remplacé au build par un identifiant dérivé du contenu (cf. le plugin
// `estampillerServiceWorker` de vite.config.js). Reste littéral en dev, où le
// SW n'a de toute façon pas d'intérêt.
const BUILD_ID     = '__BUILD_ID__';
const SHELL_CACHE  = `padel-meet-shell-${BUILD_ID}`;
const ASSETS_CACHE = 'padel-meet-assets';

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
    // `cache: 'reload'` : sans ça, addAll peut se servir dans le cache HTTP du
    // navigateur et remettre en cache l'index.html du déploiement précédent —
    // ce que cette réécriture cherche justement à empêcher.
    caches.open(SHELL_CACHE).then((cache) =>
      cache.addAll(APP_SHELL.map((url) => new Request(url, { cache: 'reload' })))
    )
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(
        names
          // Tout cache de l'app SAUF le shell courant et le cache d'assets.
          // Filtrer sur le préfixe 'padel-meet-shell-' ne suffisait pas : le
          // cache historique 'padel-meet-v2' ne le porte pas et survivait donc
          // indéfiniment — 175 entrées dont un index.html d'un build révolu,
          // constaté en production.
          .filter((n) => n.startsWith('padel-meet-') && n !== SHELL_CACHE && n !== ASSETS_CACHE)
          .map((n) => caches.delete(n))
      )
    ).then(() => self.clients.claim())
  );
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

// Repli hors-ligne d'une navigation. Renvoie systématiquement une Response :
// `respondWith` reçoit une promesse résolue à `undefined` si l'app shell est
// absente du cache, ce que le navigateur traite comme une erreur réseau — soit
// une page d'erreur au lieu du repli attendu.
function replierSurLeShell() {
  // caches.open(SHELL_CACHE).match et NON caches.match : ce dernier interroge
  // TOUS les caches de l'origine et renvoie la première correspondance. Il
  // ramenait donc l'index.html du cache historique, pointant vers des chunks
  // d'un ancien build — eux aussi encore en cache. Le repli relançait ainsi
  // une version périmée de l'app entière au lieu de la version courante.
  return caches.open(SHELL_CACHE).then((cache) => cache.match('/index.html')).then((reponse) =>
    reponse || new Response(
      '<!doctype html><meta charset="utf-8"><title>Hors ligne</title>' +
      '<body style="font-family:sans-serif;text-align:center;padding:48px 24px">' +
      '<h1 style="color:#1F5C3F">Padel Meet</h1><p>Connexion indisponible. ' +
      'Vérifie ton réseau puis recharge la page.</p>',
      { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
    )
  );
}

// Cache de destination d'une URL : /assets/* porte un hachage de contenu et va
// dans le cache commun ; le reste (icônes, manifest) suit la vie du build.
// Utilisé pour l'écriture ET pour la lecture, afin que les deux ne puissent
// jamais diverger.
function cachePour(url) {
  return caches.open(url.pathname.startsWith('/assets/') ? ASSETS_CACHE : SHELL_CACHE);
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
      fetchAvecDelai(request)
        .then((reponse) => {
          // Rafraîchit le shell mis en cache à chaque navigation réussie : même
          // si l'installation a échoué (réseau coupé au mauvais moment), le
          // repli hors-ligne reste celui du build en cours.
          if (reponse && reponse.ok) {
            const copie = reponse.clone();
            caches.open(SHELL_CACHE).then((cache) => cache.put('/index.html', copie));
          }
          return reponse;
        })
        .catch(replierSurLeShell)
    );
    return;
  }

  // Assets statiques de même origine : réseau d'abord, mise en cache, repli cache.
  event.respondWith(
    fetchAvecDelai(request)
      .then((response) => {
        if (response && response.status === 200 && response.type === 'basic') {
          const copy = response.clone();
          // /assets/* porte un hachage de contenu → cache commun, jamais purgé.
          // Le reste (icônes, manifest) suit la vie du build.
          cachePour(url).then((cache) => cache.put(request, copy));
          return response;
        }
        // Réponse reçue mais inexploitable (404 typiquement, quand un onglet
        // ouvert avant un déploiement réclame un chunk que le serveur ne sert
        // plus) : le cache d'assets détient encore ce fichier, on s'en sert
        // plutôt que de laisser remonter une erreur de chargement de module.
        return cachePour(url).then((cache) => cache.match(request)).then((c) => c || response);
      })
      .catch(() => cachePour(url).then((cache) => cache.match(request)))
  );
});
