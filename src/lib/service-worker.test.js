// Tests du service worker (public/service-worker.js).
//
// Ce fichier a déjà régressé deux fois en production — écran blanc puis
// index.html périmé — et il n'est exécutable ni par le bundler ni par un
// navigateur de test ici. On le charge donc dans un contexte `vm` muni d'un
// faux environnement de Service Worker, et on déclenche ses gestionnaires à la
// main. Ce qui compte n'est pas la couverture mais les deux invariants dont la
// violation casse l'app en silence : la purge doit épargner le cache d'assets,
// et chaque requête doit atterrir dans le bon cache.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createContext, Script } from 'node:vm'

const SOURCE = readFileSync(new URL('../../public/service-worker.js', import.meta.url), 'utf8')
const BUILD_ID = 'testbuild01'
const SHELL = `padel-meet-shell-${BUILD_ID}`
const ASSETS = 'padel-meet-assets'

/** Faux `caches` : nom de cache → Map(url → réponse). */
function fauxCaches(initial = {}) {
  const magasin = new Map(Object.entries(initial).map(([k, v]) => [k, new Map(Object.entries(v))]))
  const api = {
    magasin,
    async open(nom) {
      if (!magasin.has(nom)) magasin.set(nom, new Map())
      const c = magasin.get(nom)
      return {
        async put(req, res) { c.set(typeof req === 'string' ? req : req.url, res) },
        async addAll(reqs) { for (const r of reqs) c.set(typeof r === 'string' ? r : r.url, 'shell') },
        async keys() { return [...c.keys()] },
      }
    },
    async keys() { return [...magasin.keys()] },
    async delete(nom) { return magasin.delete(nom) },
    async match(req) {
      const url = typeof req === 'string' ? req : req.url
      for (const c of magasin.values()) if (c.has(url)) return c.get(url)
      return undefined
    },
  }
  return api
}

/**
 * Réponse simulée. `type: 'basic'` est indispensable : le SW ne met en cache
 * que les réponses de même origine, que le navigateur marque ainsi — alors
 * qu'une Response construite sous Node vaut 'default' et serait ignorée.
 */
function reponse(corps, { status = 200, type = 'basic' } = {}) {
  const r = { corps, status, type, ok: status >= 200 && status < 300 }
  r.clone = () => ({ ...r, clone: r.clone })
  return r
}

/** Charge le SW et renvoie ses gestionnaires + l'environnement simulé. */
function chargerSW({ caches = fauxCaches(), fetchImpl } = {}) {
  const handlers = {}
  const attentes = []
  const self = {
    location: { origin: 'https://exemple.test' },
    addEventListener: (type, fn) => { handlers[type] = fn },
    skipWaiting: () => {},
    clients: { claim: async () => {} },
  }
  const ctx = createContext({
    self, caches, URL, Request, Response, console,
    setTimeout, clearTimeout, Promise,
    fetch: fetchImpl || (async () => reponse('ok')),
  })
  new Script(SOURCE.split('__BUILD_ID__').join(BUILD_ID)).runInContext(ctx)

  const evt = (extra) => ({ ...extra, waitUntil: (p) => attentes.push(p), respondWith: (p) => attentes.push(p) })
  // Les gestionnaires du SW enchaînent des promesses non attendues (les
  // `caches.open(...).then(...)` d'écriture). On draine donc la file jusqu'à
  // ce qu'elle se stabilise, plutôt que de deviner un délai.
  const draine = async () => {
    for (let i = 0; i < 10; i++) {
      const n = attentes.length
      await Promise.allSettled(attentes)
      await new Promise((r) => setTimeout(r, 0))
      if (attentes.length === n) break
    }
  }
  return { handlers, self, caches, evt, attentes, draine }
}

test('activate purge les shells des builds precedents mais epargne le cache d\'assets', async () => {
  const caches = fauxCaches({
    'padel-meet-shell-ancien1': { '/index.html': 'vieux' },
    'padel-meet-shell-ancien2': { '/index.html': 'vieux' },
    [SHELL]: { '/index.html': 'courant' },
    [ASSETS]: { '/assets/index-abc.js': 'chunk' },
    'padel-meet-v2': { '/index.html': 'legacy' },
  })
  const { handlers, evt, draine } = chargerSW({ caches })
  const e = evt({})
  handlers.activate(e)
  await draine()

  const restants = await caches.keys()
  assert.ok(restants.includes(ASSETS), 'le cache d\'assets doit survivre : noms haches, jamais perimes')
  assert.ok(restants.includes(SHELL), 'le shell du build courant doit survivre')
  assert.ok(!restants.includes('padel-meet-shell-ancien1'), 'les shells precedents doivent etre purges')
  assert.ok(!restants.includes('padel-meet-shell-ancien2'), 'les shells precedents doivent etre purges')
})

test('un asset hache va dans le cache commun, une icone dans le cache du build', async () => {
  const caches = fauxCaches()
  const { handlers, evt, draine } = chargerSW({ caches })

  for (const chemin of ['/assets/index-abc123.js', '/icon-192.png']) {
    handlers.fetch(evt({ request: new Request(`https://exemple.test${chemin}`) }))
  }
  await draine()

  const assets = await (await caches.open(ASSETS)).keys()
  const shell = await (await caches.open(SHELL)).keys()
  assert.ok(assets.some((u) => u.endsWith('/assets/index-abc123.js')), '/assets/* → cache commun')
  assert.ok(shell.some((u) => u.endsWith('/icon-192.png')), 'icone → cache du build')
  assert.ok(!shell.some((u) => u.includes('/assets/')), 'aucun asset hache dans le cache du build')
})

test('cross-origin et non-GET ne sont jamais interceptes', async () => {
  const { handlers } = chargerSW()
  const cas = [
    new Request('https://xyz.supabase.co/rest/v1/profiles'),
    new Request('https://exemple.test/api', { method: 'POST' }),
  ]
  for (const request of cas) {
    let intercepte = false
    handlers.fetch({ request, respondWith: () => { intercepte = true }, waitUntil: () => {} })
    assert.equal(intercepte, false, `ne doit pas intercepter ${request.method} ${request.url}`)
  }
})

test('un chunk absent du serveur (404 apres deploiement) retombe sur le cache', async () => {
  const caches = fauxCaches({ [ASSETS]: { 'https://exemple.test/assets/vieux-chunk.js': 'CONTENU_EN_CACHE' } })
  const { handlers } = chargerSW({
    caches,
    fetchImpl: async () => reponse('not found', { status: 404 }),
  })
  let repondu
  handlers.fetch({
    request: new Request('https://exemple.test/assets/vieux-chunk.js'),
    respondWith: (p) => { repondu = p },
    waitUntil: () => {},
  })
  assert.equal(await repondu, 'CONTENU_EN_CACHE',
    'un onglet ouvert pendant un deploiement doit encore charger ses propres chunks')
})
