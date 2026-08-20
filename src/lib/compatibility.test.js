import { test } from 'node:test'
import assert from 'node:assert/strict'
import { compatScore } from './compatibility.js'
import { profileSubRegion, SUB_REGIONS } from '../data/courtData.js'

// ─── Normalisation des sous-régions ─────────────────────────────────────────
// `profiles.city` porte deux vocabulaires : sous-région pour les comptes
// réels, vraie ville pour les profils de démonstration.

test('une sous-region deja normalisee est rendue telle quelle', () => {
  for (const r of SUB_REGIONS['Israël']) {
    assert.equal(profileSubRegion({ city: r }), r)
  }
})

test('une vraie ville israelienne est ramenee a sa sous-region', () => {
  assert.equal(profileSubRegion({ city: 'Tel Aviv' }), 'Centre')
  assert.equal(profileSubRegion({ city: 'Haïfa' }), 'Nord')
  assert.equal(profileSubRegion({ city: 'Ashdod' }), 'Sud')
})

test('ville francaise, inconnue ou absente : null, jamais une supposition', () => {
  assert.equal(profileSubRegion({ city: 'Paris' }), null)
  assert.equal(profileSubRegion({ city: 'Ville Imaginaire' }), null)
  assert.equal(profileSubRegion({ city: '' }), null)
  assert.equal(profileSubRegion(null), null)
})

test('toute sous-region produite appartient bien a SUB_REGIONS', () => {
  // Garde-fou : une faute de frappe dans la table donnerait une valeur qu'aucune
  // preference ne peut egaler — donc sans effet, et silencieuse.
  const villes = ['Tel Aviv', 'Herzliya', 'Raanana', 'Netanya', 'Petah Tikva',
                  'Ramat Gan', 'Haïfa', 'Ashdod', 'Eilat', 'Jérusalem']
  for (const v of villes) {
    const sr = profileSubRegion({ city: v })
    assert.ok(SUB_REGIONS['Israël'].includes(sr), `${v} -> ${sr} hors SUB_REGIONS`)
  }
})

// ─── Effet réel sur le score ────────────────────────────────────────────────

const moi = (prefs = {}) => ({ level: 4, dominant_hand: 'right', partner_prefs: prefs })
const lui = (o = {}) => ({ level: 4, hand: 'right', side: 'forehand',
                           style: 'all-court', motivation: 'fun', ...o })

test('la preference de sous-region fait VRAIMENT monter le score', () => {
  // Le coeur du sujet : avant, pref.region n'etait lu nulle part.
  const sans = compatScore(moi({}), lui({ city: 'Tel Aviv' }))
  const avec = compatScore(moi({ region: 'Centre' }), lui({ city: 'Tel Aviv' }))
  assert.ok(avec > sans, `attendu > ${sans}, obtenu ${avec}`)
})

test('elle fonctionne aussi sur un profil demo (ville) que sur un compte reel (sous-region)', () => {
  const ref = compatScore(moi({}), lui({ city: 'Tel Aviv' }))
  assert.ok(compatScore(moi({ region: 'Centre' }), lui({ city: 'Tel Aviv' })) > ref, 'demo')
  assert.ok(compatScore(moi({ region: 'Centre' }), lui({ city: 'Centre' }))  > ref, 'compte reel')
})

test('une sous-region qui ne correspond pas n\'apporte rien', () => {
  const sans = compatScore(moi({}), lui({ city: 'Haïfa' }))
  const avec = compatScore(moi({ region: 'Centre' }), lui({ city: 'Haïfa' }))
  assert.equal(avec, sans, 'Haifa est au Nord : aucun bonus pour une preference Centre')
})

test('« indifferent » ou region absente n\'exclut ni ne bonifie personne', () => {
  const sans = compatScore(moi({}), lui({ city: 'Tel Aviv' }))
  assert.equal(compatScore(moi({ region: 'any' }), lui({ city: 'Tel Aviv' })), sans)
  // Profil sans ville exploitable : pas de bonus, mais jamais exclu non plus.
  const inconnu = compatScore(moi({ region: 'Centre' }), lui({ city: 'Paris' }))
  assert.ok(inconnu >= 40, 'le score reste dans sa plage, personne n\'est ecarte')
})

test('le score reste borne entre 40 et 99', () => {
  const parfait = compatScore(
    moi({ region: 'Centre', hand: 'left', side: 'forehand', style: 'all-court',
          motivation: 'fun', levelMin: 3, levelMax: 5 }),
    lui({ city: 'Tel Aviv', hand: 'left' }))
  assert.ok(parfait <= 99 && parfait >= 40, `score hors bornes : ${parfait}`)
})
