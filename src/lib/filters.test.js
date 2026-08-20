import { test } from 'node:test'
import assert from 'node:assert/strict'
import { applyFilters, assouplirDunCran, elargirJusquaResultat,
         normaliserFiltres, chargerFiltres, sauverFiltres } from './filters.js'

const joueur = (o = {}) => ({
  side: 'forehand', hand: 'right', style: 'all-court', motivation: 'fun',
  country: 'Israël', level: 4, frequency: 2, ...o,
})
const strict = {
  side: 'backhand', hand: 'left', style: 'aggressive', motivation: 'compete',
  region: 'France', levelMin: 6, levelMax: 6.5, frequency: 4,
}
const large = {
  side: 'any', hand: 'any', style: 'any', motivation: 'any',
  region: 'any', levelMin: 1, levelMax: 7, frequency: 0,
}

test('applyFilters exclut bien sur chaque critere', () => {
  assert.equal(applyFilters([joueur()], { ...large, side: 'backhand' }).length, 0)
  assert.equal(applyFilters([joueur()], { ...large, hand: 'left' }).length, 0)
  assert.equal(applyFilters([joueur()], { ...large, levelMin: 5 }).length, 0)
  assert.equal(applyFilters([joueur()], { ...large, frequency: 3 }).length, 0)
  assert.equal(applyFilters([joueur()], large).length, 1)
})

test('un joueur sans niveau n\'est jamais exclu par la fourchette', () => {
  assert.equal(applyFilters([joueur({ level: null })], { ...large, levelMin: 6, levelMax: 7 }).length, 1)
})

test('la frequence part avant le niveau, la region en dernier', () => {
  // Ordre voulu : ce qui trahit le moins l'intention part en premier.
  let f = strict
  const ordre = []
  // 30 et non 12 : le niveau se relache par paliers de 0.5, donc de 6->1 il
  // consomme a lui seul 10 crans avant qu'on atteigne la region.
  for (let i = 0; i < 30; i++) {
    const r = assouplirDunCran(f)
    if (!r.change) break
    if (!ordre.includes(r.critere)) ordre.push(r.critere)
    f = r.filtres
  }
  assert.equal(ordre[0], 'frequency', 'la disponibilite se relache en premier')
  assert.equal(ordre[ordre.length - 1], 'region',
    'la region part en dernier : un partenaire a l\'autre bout du pays est le moins utile')
  assert.ok(ordre.indexOf('level') < ordre.indexOf('region'))
})

test('le niveau s\'elargit par paliers d\'un demi-point, sans deborder [1,7]', () => {
  const r1 = assouplirDunCran({ ...large, levelMin: 4, levelMax: 5 })
  assert.deepEqual([r1.filtres.levelMin, r1.filtres.levelMax], [3.5, 5.5])
  const r2 = assouplirDunCran({ ...large, levelMin: 1.2, levelMax: 6.8 })
  assert.deepEqual([r2.filtres.levelMin, r2.filtres.levelMax], [1, 7])
})

test('plus rien a elargir : change=false, aucune boucle infinie', () => {
  const r = assouplirDunCran(large)
  assert.equal(r.change, false)
  assert.equal(r.critere, null)
})

test('elargir s\'arrete DES qu\'un joueur ressort, sans tout relacher', () => {
  // Seule la frequence bloque : rien d'autre ne doit etre touche.
  const joueurs = [joueur({ side: 'backhand', hand: 'left', style: 'aggressive',
                            motivation: 'compete', country: 'France', level: 6, frequency: 1 })]
  const r = elargirJusquaResultat(joueurs, strict)
  assert.equal(r.change, true)
  assert.deepEqual(r.relaches, ['frequency'], 'ne relache que ce qui bloquait')
  assert.equal(r.filtres.side, 'backhand', 'le cote choisi est preserve')
  assert.equal(r.filtres.region, 'France', 'la region est preservee')
  assert.equal(applyFilters(joueurs, r.filtres).length, 1)
})

test('elargir jusqu\'au bout quand un seul joueur tres different existe', () => {
  const joueurs = [joueur()] // droitier, coup droit, polyvalent, loisir, Israel, niveau 4
  const r = elargirJusquaResultat(joueurs, strict)
  assert.equal(applyFilters(joueurs, r.filtres).length, 1, 'le joueur doit finir par ressortir')
  assert.equal(r.epuise, false)
})

test('aucun joueur du tout : on ne boucle pas, on signale l\'epuisement', () => {
  const r = elargirJusquaResultat([], strict)
  assert.equal(r.epuise, true)
  assert.deepEqual(r.filtres, { ...strict, side: 'any', hand: 'any', style: 'any',
    motivation: 'any', region: 'any', levelMin: 1, levelMax: 7, frequency: 0 })
})

// ─── Persistance ────────────────────────────────────────────────────────────

/** Faux localStorage, y compris le cas « stockage indisponible » (mode privé). */
function fauxStockage(initial = null, { casse = false } = {}) {
  let valeur = initial
  return {
    getItem: () => { if (casse) throw new Error('stockage indisponible'); return valeur },
    setItem: (_, v) => { if (casse) throw new Error('stockage indisponible'); valeur = v },
    lire: () => valeur,
  }
}

test('normaliser : une valeur inconnue retombe sur le defaut, sans tout jeter', () => {
  const r = normaliserFiltres({ side: 'diagonale', hand: 'left', style: 'aggressive' }, large)
  assert.equal(r.side, 'any', 'valeur inventee -> defaut')
  assert.equal(r.hand, 'left', 'les champs valides sont conserves')
  assert.equal(r.style, 'aggressive')
})

test('normaliser : bornes de niveau inversees remises dans l\'ordre', () => {
  // Les jeter donnerait une fourchette vide, donc une pile vide sans explication.
  const r = normaliserFiltres({ levelMin: 6, levelMax: 2 }, large)
  assert.deepEqual([r.levelMin, r.levelMax], [2, 6])
})

test('normaliser : valeurs hors bornes ou non numeriques ignorees', () => {
  const r = normaliserFiltres({ levelMin: 0, levelMax: 99, frequency: 'beaucoup' }, large)
  assert.deepEqual([r.levelMin, r.levelMax, r.frequency], [1, 7, 0])
})

test('normaliser : entree absente ou non-objet -> defauts', () => {
  for (const brut of [null, undefined, 'x', 42, []]) {
    assert.deepEqual(normaliserFiltres(brut, large), large)
  }
})

test('un aller-retour stockage restitue les filtres', () => {
  const st = fauxStockage()
  const f = { ...large, hand: 'left', levelMin: 3, levelMax: 5, region: 'Israël' }
  assert.equal(sauverFiltres(f, 'user-1', st), true)
  assert.deepEqual(chargerFiltres(large, 'user-1', st), f)
})

test('les filtres d\'un AUTRE utilisateur ne sont pas herites', () => {
  const st = fauxStockage()
  sauverFiltres({ ...large, hand: 'left' }, 'user-1', st)
  assert.deepEqual(chargerFiltres(large, 'user-2', st), large,
    'sur un appareil partage, on repart des defauts')
  assert.deepEqual(chargerFiltres(large, null, st), large, 'idem pour un invite')
})

test('stockage illisible ou indisponible : defauts, jamais d\'exception', () => {
  assert.deepEqual(chargerFiltres(large, 'u', fauxStockage('{pas du json')), large)
  assert.deepEqual(chargerFiltres(large, 'u', fauxStockage(null, { casse: true })), large)
  assert.equal(sauverFiltres(large, 'u', fauxStockage(null, { casse: true })), false,
    'echec signale sans faire planter l\'app')
})

test('un format d\'une version anterieure est ignore', () => {
  const st = fauxStockage(JSON.stringify({ v: 0, userId: 'u', filtres: { hand: 'left' } }))
  assert.deepEqual(chargerFiltres(large, 'u', st), large)
})

test('des filtres stockes corrompus ne peuvent pas vider la pile en silence', () => {
  // Le scenario qui motive tout ce garde-fou.
  const st = fauxStockage(JSON.stringify({
    v: 1, userId: 'u', filtres: { side: 'nawak', levelMin: 9, levelMax: 9, frequency: 99 },
  }))
  const f = chargerFiltres(large, 'u', st)
  const joueurs = [joueur()]
  assert.equal(applyFilters(joueurs, f).length, 1,
    'apres normalisation, un joueur normal doit toujours ressortir')
})
