/**
 * Tests unitaires — confidenceRules.js (modèle 50/50 play/peer, monotone)
 *
 * Exécuter avec : npm test   (ou : node --test src/lib/confidenceRules.test.js)
 *
 * Utilise `node:test`, le runner intégré à Node — aucune dépendance à installer.
 * Chaque assertion est un test nommé : en cas d'échec, la CI indique exactement
 * lequel a cassé, et non « 1 test failed » sur le fichier entier.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  applyConfidenceDelta,
  playConfidenceCredit,
  clampConfidenceRate,
  evaluatorWeight,
  simulatePeerRingCredit,
  PEER_VELOCITY_MAX,
} from './confidenceRules.js';

// ─── Canal « peer » : applyConfidenceDelta (jamais négatif) ──────────────────
describe('applyConfidenceDelta (canal peer)', () => {
  test('gap 0.00 → +5', () => assert.equal(applyConfidenceDelta(3.5, 3.5), 5));
  test('gap 0.50 → +5', () => assert.equal(applyConfidenceDelta(4.0, 3.5), 5));
  test('gap 0.60 → +2', () => assert.equal(applyConfidenceDelta(3.5, 4.1), 2));
  test('gap 1.00 → +2', () => assert.equal(applyConfidenceDelta(3.5, 4.5), 2));
  test('gap 1.50 → 0 (stagne)', () => assert.equal(applyConfidenceDelta(3.0, 4.5), 0));
  test('gap 3.00 → 0 (stagne)', () => assert.equal(applyConfidenceDelta(1.0, 4.0), 0));

  // Propriété centrale du modèle : l'indice ne baisse JAMAIS, quel que soit
  // l'écart. Un désaccord fait stagner, il ne pénalise pas.
  test('aucun crédit négatif, même en désaccord total', () => {
    for (let proposed = 0.5; proposed <= 7; proposed += 0.5) {
      assert.ok(
        applyConfidenceDelta(3.5, proposed) >= 0,
        `crédit négatif pour un niveau proposé de ${proposed}`,
      );
    }
  });
});

// ─── Canal « play » : playConfidenceCredit ───────────────────────────────────
describe('playConfidenceCredit (canal play)', () => {
  test('niveaux égaux → +5',     () => assert.equal(playConfidenceCredit(4.0, 4.0), 5));
  test('écart 0.5 → +5',         () => assert.equal(playConfidenceCredit(4.0, 3.5), 5));
  test('écart 0.6 → 0 (stagne)', () => assert.equal(playConfidenceCredit(4.0, 3.4), 0));
  test('écart 2.0 → 0 (stagne)', () => assert.equal(playConfidenceCredit(5.0, 3.0), 0));

  // Le crédit ne dépend pas de qui est le plus fort : l'écart est absolu.
  test('symétrique (l\'ordre des joueurs est sans effet)', () => {
    assert.equal(playConfidenceCredit(5.0, 3.0), playConfidenceCredit(3.0, 5.0));
    assert.equal(playConfidenceCredit(4.0, 3.5), playConfidenceCredit(3.5, 4.0));
  });
});

// ─── clampConfidenceRate : borné [50, 100], jamais sous la base ──────────────
// Migration 023 (anti-collusion) ne touche pas clampConfidenceRate — ces
// assertions restent inchangées, elles vérifient l'absence de régression.
describe('clampConfidenceRate', () => {
  test('50 + 5 = 55',       () => assert.equal(clampConfidenceRate(55), 55));
  test('borne haute → 100', () => assert.equal(clampConfidenceRate(120), 100));
  test('borne basse → 50',  () => assert.equal(clampConfidenceRate(40), 50));
  test('base exacte 50',    () => assert.equal(clampConfidenceRate(50), 50));

  // Le plafond théorique du modèle : 50 (base) + 25 (peer) + 25 (play).
  test('le maximum atteignable vaut exactement 100', () => {
    assert.equal(clampConfidenceRate(50 + 25 + 25), 100);
  });
});

// ─── evaluatorWeight : poids d'un évaluateur, borné [0.5, 1.0] ───────────────
describe('evaluatorWeight (anti-collusion, migration 023)', () => {
  test('confidence 50 (défaut) → poids 0.5 (plancher)', () => {
    assert.equal(evaluatorWeight(50), 0.5);
  });
  test('confidence 100 → poids 1.0 (plafond)', () => {
    assert.equal(evaluatorWeight(100), 1.0);
  });
  test('confidence 75 (milieu) → poids 0.75', () => {
    assert.equal(evaluatorWeight(75), 0.75);
  });
  // Défense en profondeur : même si un confidence_rate incohérent (bug,
  // donnée legacy) sortait de [50,100], le poids reste dans [0.5, 1.0].
  test('borné même hors de [50,100]', () => {
    assert.equal(evaluatorWeight(30), 0.5);
    assert.equal(evaluatorWeight(150), 1.0);
  });
});

// ─── Plafond de vitesse peer : simulation d'un anneau de complices ───────────
describe('simulatePeerRingCredit (anti-collusion, migration 023)', () => {
  // 5 complices tous à confidence 50 (défaut de lancement, tout le monde y
  // est) tentent de créditer la même cible. Avant la migration 023, les 5
  // auraient été crédités (+5 chacun, plafond canal 25 non atteint) : preuve
  // de la faille dans le commentaire de contexte du prompt. Avec le plafond
  // de vitesse (PEER_VELOCITY_MAX=2) et le poids (0.5 à confidence 50), seuls
  // 2 des 5 sont crédités : 2 × (5 × 0.5) = 5.
  test('anneau de 5 complices à confidence 50 → plafonné à +5 sur 7 jours', () => {
    assert.equal(simulatePeerRingCredit(5, 50), 5);
  });
  test('jamais plus de PEER_VELOCITY_MAX évaluations créditées, quelle que soit la taille de l\'anneau', () => {
    const credit10 = simulatePeerRingCredit(10, 50);
    const credit3  = simulatePeerRingCredit(3, 50);
    // 10 complices ne créditent pas plus que 5 (même plafond de vitesse) ;
    // 3 complices, avec seulement 2 crédités, donnent le même total que 5.
    assert.equal(credit10, 5);
    assert.equal(credit3, 5);
  });
  // Un anneau d'évaluateurs à confidence maximale (poids 1.0) reste plafonné
  // en NOMBRE d'évaluations créditées, pas seulement en poids.
  test('évaluateurs à confidence 100 (poids 1.0) → 2 × 5 = 10, pas plus', () => {
    assert.equal(simulatePeerRingCredit(5, 100), 10);
  });
  // Le plafond de vitesse est global par cible, pas par évaluateur : que ce
  // soit 1 évaluateur qui tente PEER_VELOCITY_MAX fois ou PEER_VELOCITY_MAX
  // évaluateurs distincts qui tentent une fois chacun, le total crédité est
  // identique — atteindre exactement le plafond ne le dépasse pas.
  test('atteindre exactement PEER_VELOCITY_MAX tentatives crédite tout, sans throttle', () => {
    assert.equal(simulatePeerRingCredit(PEER_VELOCITY_MAX, 50), 5);
  });
});
