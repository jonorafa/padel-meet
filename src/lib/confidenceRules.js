/**
 * Règles déterministes du système de confidence_rate (indice de confiance).
 *
 * Modèle 50/50, MONOTONE (ne baisse JAMAIS). La vraie logique est côté serveur
 * (migration 014_backend_coherence, SECURITY DEFINER) ; ce fichier sert
 * d'aperçu / documentation et ne peut pas être manipulé côté client.
 *
 *   confidence_rate = 50 + min(25, Σ canal « peer ») + min(25, Σ canal « play »)
 *
 *   • Base 50 pour tout nouveau profil, borné [50, 100].
 *   • Canal « peer » (max +25) : accord des évaluations de pairs avec le niveau
 *     déclaré. Proche → crédit positif, loin → 0 (stagne). Jamais négatif.
 *   • Canal « play » (max +25) : matchs confirmés contre un adversaire de niveau
 *     similaire (écart ≤ 0.5).
 */

export const CONFIDENCE_BASE = 50;   // valeur de départ
export const CHANNEL_CAP     = 25;   // plafond par canal (peer / play)
export const PLAY_CREDIT     = 5;    // crédit par match de niveau similaire
export const SIMILAR_GAP     = 0.5;  // écart de niveau « similaire »

/**
 * Crédit « peer » indexé par écart maximal entre niveau proposé et niveau
 * déclaré. Toujours ≥ 0 (loin → 0, l'indice stagne, il ne descend jamais).
 */
export const CONFIDENCE_RULES = [
  { maxGap: 0.50,     delta: +5, label: 'Accord          (≤ 0.5)' },
  { maxGap: 1.00,     delta: +2, label: 'Accord modéré   (≤ 1.0)' },
  { maxGap: Infinity, delta:  0, label: 'Trop loin → stagne (> 1.0)' },
];

/**
 * Crédit « peer » (≥ 0) pour une évaluation de pair.
 * Aperçu client uniquement — la vraie mise à jour passe par l'RPC
 * submit_peer_evaluation.
 *
 * @param {number} currentLevel  - niveau déclaré du joueur évalué
 * @param {number} proposedLevel - niveau proposé par l'évaluateur
 * @returns {number} crédit à ajouter (≥ 0)
 */
export function applyConfidenceDelta(currentLevel, proposedLevel) {
  const gap = Math.abs(proposedLevel - currentLevel);
  for (const rule of CONFIDENCE_RULES) {
    if (gap <= rule.maxGap) return rule.delta;
  }
  return 0;
}

/**
 * Crédit « play » (≥ 0) pour un match confirmé : si l'adversaire est de niveau
 * similaire (écart ≤ 0.5) → +5, sinon 0.
 *
 * @param {number} myLevel       - mon niveau
 * @param {number} opponentLevel - niveau de l'adversaire
 * @returns {number} crédit à ajouter (0 ou +5)
 */
export function playConfidenceCredit(myLevel, opponentLevel) {
  return Math.abs(myLevel - opponentLevel) <= SIMILAR_GAP ? PLAY_CREDIT : 0;
}

/**
 * Borne une valeur de confidence_rate dans [base, 100].
 * L'indice ne descend jamais sous la base (50).
 *
 * @param {number} value - valeur brute
 * @returns {number} valeur bornée
 */
export function clampConfidenceRate(value) {
  return Math.max(CONFIDENCE_BASE, Math.min(100, value));
}
