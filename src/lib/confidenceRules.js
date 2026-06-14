/**
 * Règles déterministes du système de confidence_rate (indice de confiance).
 *
 * Modèle 75/25 (play/peer), MONOTONE (ne baisse JAMAIS).
 * La vraie logique est côté serveur (migrations 014 + 016, SECURITY DEFINER) ;
 * ce fichier sert d'aperçu / documentation et ne peut pas être manipulé côté client.
 *
 *   confidence_rate = 50 + min(12.5, Σ canal « peer ») + min(37.5, Σ canal « play »)
 *
 *   • Base 50 pour tout nouveau profil, borné [50, 100].
 *   • Canal « peer » (max +12.5, 25 % du gain) : accord des évaluations de pairs
 *     avec le niveau déclaré. Proche → crédit positif, loin → 0 (stagne).
 *   • Canal « play » (max +37.5, 75 % du gain) : matchs confirmés contre un
 *     adversaire de niveau similaire (écart ≤ 0.5).
 *
 * Décision produit (migration 016) : le jeu réel avec des partenaires proches
 * pèse 3× plus que l'évaluation subjective de pairs.
 */

export const CONFIDENCE_BASE  = 50;    // valeur de départ
export const PEER_CAP         = 12.5;  // plafond canal peer  (25 % × 50)
export const PLAY_CAP         = 37.5;  // plafond canal play  (75 % × 50)
/** @deprecated — remplacé par PEER_CAP / PLAY_CAP (modèle 75/25). Ne pas utiliser. */
export const CHANNEL_CAP      = 25;    // ancien cap symétrique 50/50 (migration 014)
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
