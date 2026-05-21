/**
 * Règles déterministes du système de confidence_rate.
 *
 * Le confidence_rate mesure la fiabilité du niveau déclaré d'un joueur.
 * Il évolue lors des évaluations par les pairs (peer evaluations) :
 *   - Démarre à 50 pour tout nouveau profil
 *   - Borné entre 0 et 100
 *   - Augmente quand l'évaluation est proche du niveau déclaré
 *   - Diminue quand l'évaluation s'en éloigne
 *
 * La formule est côté serveur (SECURITY DEFINER) et ne peut pas
 * être manipulée côté client.
 */

/**
 * Règles indexées par écart maximal entre niveau proposé et niveau actuel.
 * Utilisées pour l'affichage/documentation côté client.
 * La logique réelle est dans submit_peer_evaluation (SQL SECURITY DEFINER).
 */
export const CONFIDENCE_RULES = [
  { maxGap: 0.25, delta: +3, label: 'Accord parfait  (≤ 0.25)' },
  { maxGap: 0.50, delta: +1, label: 'Bon accord      (≤ 0.50)' },
  { maxGap: 1.00, delta: -2, label: 'Désaccord modéré (≤ 1.0)' },
  { maxGap: Infinity, delta: -5, label: 'Fort désaccord  (> 1.0)' },
];

/**
 * Calcule le delta de confidence_rate pour une évaluation.
 * Utilisé uniquement côté client pour l'aperçu / tests.
 * La vraie mise à jour se fait via l'RPC submit_peer_evaluation.
 *
 * @param {number} currentLevel - niveau actuel du joueur évalué
 * @param {number} proposedLevel - niveau proposé par l'évaluateur
 * @returns {number} delta à ajouter au confidence_rate
 */
export function applyConfidenceDelta(currentLevel, proposedLevel) {
  const gap = Math.abs(proposedLevel - currentLevel);
  for (const rule of CONFIDENCE_RULES) {
    if (gap <= rule.maxGap) return rule.delta;
  }
  return CONFIDENCE_RULES[CONFIDENCE_RULES.length - 1].delta;
}

/**
 * Applique le delta et borne le résultat entre 0 et 100.
 *
 * @param {number} current - confidence_rate actuel
 * @param {number} delta - variation calculée
 * @returns {number} nouveau confidence_rate
 */
export function clampConfidenceRate(current, delta) {
  return Math.max(0, Math.min(100, current + delta));
}
