/**
 * Règles déterministes du système de confidence_rate (indice de confiance).
 *
 * Modèle 50/50 (play/peer), MONOTONE (ne baisse JAMAIS).
 * La vraie logique est côté serveur (migrations 014 + 018 + 023, SECURITY
 * DEFINER) ; ce fichier sert d'aperçu / documentation et ne peut pas être
 * manipulé côté client.
 *
 *   confidence_rate = 50 + min(25, Σ canal « peer ») + min(25, Σ canal « play »)
 *
 *   • Base 50 pour tout nouveau profil, borné [50, 100].
 *   • Canal « peer » (max +25, 50 % du gain) : accord des évaluations de pairs
 *     avec le niveau déclaré. Proche → crédit positif, loin → 0 (stagne).
 *   • Canal « play » (max +25, 50 % du gain) : matchs confirmés contre un
 *     adversaire de niveau similaire (écart ≤ 0.5).
 *
 * Anti-collusion (migration 023) — canal « peer » uniquement, le canal
 * « play » exige déjà l'accord des deux joueurs + une soumission de score,
 * bien plus coûteux à fabriquer :
 *   • Plafond de vitesse : au plus PEER_VELOCITY_MAX évaluations créditées
 *     par utilisateur évalué sur PEER_VELOCITY_WINDOW_DAYS jours, quel que
 *     soit le nombre d'évaluateurs différents qui tentent. Au-delà, le
 *     crédit est refusé (delta=0, tracé avec le préfixe `throttled_peer`).
 *   • Poids d'évaluateur, dans [0.5, 1.0] : voir evaluatorWeight(). Un
 *     évaluateur peu fiable (confidence basse) crédite moins.
 *
 * Historique : la migration 016 avait tenté un modèle 75/25 (play 3× peer) ;
 * la migration 018 est revenue au 50/50 à parts égales (décision produit).
 * La migration 023 n'introduit aucun decay ni dégressivité — décision
 * produit séparée, non tranchée.
 */

export const CONFIDENCE_BASE  = 50;    // valeur de départ
export const CHANNEL_CAP      = 25;    // plafond par canal (50 % × 50) — peer ET play
export const PEER_CAP         = 25;    // plafond canal peer  (alias de CHANNEL_CAP)
export const PLAY_CAP         = 25;    // plafond canal play  (alias de CHANNEL_CAP)
export const PLAY_CREDIT     = 5;    // crédit par match de niveau similaire
export const SIMILAR_GAP     = 0.5;  // écart de niveau « similaire »

export const PEER_VELOCITY_WINDOW_DAYS = 7;  // fenêtre glissante du plafond de vitesse
export const PEER_VELOCITY_MAX         = 2;  // évaluations peer créditées max sur la fenêtre

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

/**
 * Poids d'un évaluateur, dans [0.5, 1.0], en fonction de son propre
 * confidence_rate. Borne basse à 0.5 plutôt que 0 : au lancement tous les
 * utilisateurs sont à 50 (défaut), un plancher à 0 gèlerait le système
 * entier (aucun crédit ne pourrait jamais être accordé). Un évaluateur neuf
 * compte moitié — ce qui préserve le démarrage tout en rendant les
 * évaluateurs peu fiables mécaniquement moins rentables.
 *
 * @param {number} evaluatorConfidenceRate - confidence_rate de l'évaluateur
 * @returns {number} poids ∈ [0.5, 1.0]
 */
export function evaluatorWeight(evaluatorConfidenceRate) {
  const raw = 0.5 + 0.5 * (evaluatorConfidenceRate - 50) / 50;
  return Math.max(0.5, Math.min(1.0, raw));
}

/**
 * Simule le crédit peer total qu'un anneau d'évaluateurs complices peut
 * obtenir pour UNE cible sur une fenêtre de PEER_VELOCITY_WINDOW_DAYS jours,
 * en appliquant le plafond de vitesse (au plus PEER_VELOCITY_MAX évaluations
 * créditées, peu importe le nombre d'évaluateurs distincts) et le poids de
 * chacun. Miroir JS de la logique serveur dans add_confidence_credit
 * (migration 023) — pas la logique elle-même.
 *
 * @param {number} ringSize - nombre d'évaluateurs complices qui tentent
 * @param {number} evaluatorConfidenceRate - confidence_rate de CHAQUE complice
 * @param {number} baseAmount - crédit de base par évaluation (5 pour gap ≤0.5)
 * @returns {number} crédit peer total réellement accordé sur la fenêtre
 */
export function simulatePeerRingCredit(ringSize, evaluatorConfidenceRate, baseAmount = 5) {
  const weight = evaluatorWeight(evaluatorConfidenceRate);
  let credited = 0;
  let total = 0;
  for (let i = 0; i < ringSize && credited < PEER_VELOCITY_MAX; i++) {
    total += Math.round(baseAmount * weight * 10) / 10;
    credited++;
  }
  return Math.min(total, PEER_CAP);
}
