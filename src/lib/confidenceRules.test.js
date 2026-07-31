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
