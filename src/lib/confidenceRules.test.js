/**
 * Tests unitaires — confidenceRules.js
 * Exécuter avec : node src/lib/confidenceRules.test.js
 */
import { applyConfidenceDelta, clampConfidenceRate } from './confidenceRules.js';

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

// ─── applyConfidenceDelta ────────────────────────────────────

console.log('\napplyConfidenceDelta');

// Écart 0.0 → +3 (parfait accord)
assert('gap 0.00 → +3', applyConfidenceDelta(3.5, 3.5), +3);

// Écart 0.25 exactement → +3
assert('gap 0.25 → +3', applyConfidenceDelta(3.5, 3.75), +3);

// Écart 0.30 → +1
assert('gap 0.30 → +1', applyConfidenceDelta(3.5, 3.8), +1);

// Écart 0.50 exactement → +1
assert('gap 0.50 → +1', applyConfidenceDelta(4.0, 3.5), +1);

// Écart 0.80 → -2
assert('gap 0.80 → -2', applyConfidenceDelta(3.5, 4.3), -2);

// Écart 1.00 exactement → -2
assert('gap 1.00 → -2', applyConfidenceDelta(3.5, 4.5), -2);

// Écart 1.50 → -5
assert('gap 1.50 → -5', applyConfidenceDelta(3.0, 4.5), -5);

// ─── clampConfidenceRate ─────────────────────────────────────

console.log('\nclampConfidenceRate');

// Application normale
assert('50 + 3 = 53',   clampConfidenceRate(50, +3), 53);
assert('50 - 5 = 45',   clampConfidenceRate(50, -5), 45);

// Borne haute
assert('98 + 3 → 100',  clampConfidenceRate(98, +3), 100);

// Borne basse
assert('2 - 5 → 0',     clampConfidenceRate(2, -5), 0);

// ─── Résumé ──────────────────────────────────────────────────

console.log(`\n${pass + fail} tests — ${pass} ✓  ${fail} ✗`);
if (fail > 0) process.exit(1);
