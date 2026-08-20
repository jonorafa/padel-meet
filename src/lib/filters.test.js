import { test } from 'node:test'
import assert from 'node:assert/strict'
import { applyFilters, assouplirDunCran, elargirJusquaResultat } from './filters.js'

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
