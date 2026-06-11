/**
 * Tests unitaires — confidenceRules.js (modèle 50/50, monotone)
 * Exécuter avec : node src/lib/confidenceRules.test.js
 */
import {
  applyConfidenceDelta,
  playConfidenceCredit,
  clampConfidenceRate,
} from './confidenceRules.js';

let pass = 0;
let fail = 0;

function assert(label, got, expected) {
  if (got === expected) {
    console.log(`  ✓ ${label}`);
    pass++;
  } else {
    console.error(`  ✗ ${label} — got ${got}, expected ${expected}`);
    fail++;
  }
}

// ─── Canal « peer » : applyConfidenceDelta (jamais négatif) ──────────

console.log('\napplyConfidenceDelta (canal peer)');

assert('gap 0.00 → +5', applyConfidenceDelta(3.5, 3.5), +5);
assert('gap 0.50 → +5', applyConfidenceDelta(4.0, 3.5), +5);
assert('gap 0.60 → +2', applyConfidenceDelta(3.5, 4.1), +2);
assert('gap 1.00 → +2', applyConfidenceDelta(3.5, 4.5), +2);
assert('gap 1.50 → 0  (stagne)', applyConfidenceDelta(3.0, 4.5), 0);
assert('gap 3.00 → 0  (stagne)', applyConfidenceDelta(1.0, 4.0), 0);

// ─── Canal « play » : playConfidenceCredit ──────────────────────────

console.log('\nplayConfidenceCredit (canal play)');

assert('niveaux égaux → +5',      playConfidenceCredit(4.0, 4.0), 5);
assert('écart 0.5 → +5',          playConfidenceCredit(4.0, 3.5), 5);
assert('écart 0.6 → 0 (stagne)',  playConfidenceCredit(4.0, 3.4), 0);
assert('écart 2.0 → 0 (stagne)',  playConfidenceCredit(5.0, 3.0), 0);

// ─── clampConfidenceRate : borné [50, 100], jamais sous la base ─────

console.log('\nclampConfidenceRate');

assert('50 + 5 = 55',       clampConfidenceRate(55), 55);
assert('borne haute → 100', clampConfidenceRate(120), 100);
assert('borne basse → 50',  clampConfidenceRate(40), 50);
assert('base exacte 50',    clampConfidenceRate(50), 50);

// ─── Résumé ──────────────────────────────────────────────────

console.log(`\n${pass + fail} tests — ${pass} ✓  ${fail} ✗`);
if (fail > 0) process.exit(1);
