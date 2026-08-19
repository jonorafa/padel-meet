/**
 * Nombre de PERSONNES ayant au moins un message non lu.
 *
 * Le badge de l'onglet Messages compte des interlocuteurs, pas des messages :
 * cinq messages non lus d'une même personne affichent « 1 », deux personnes
 * affichent « 2 ». La version précédente additionnait les `unreadCount` de
 * toutes les conversations et pouvait donc afficher « 5 » pour un seul
 * interlocuteur.
 *
 * On déduplique sur l'identifiant du joueur plutôt que de compter les
 * conversations : deux personnes peuvent en principe partager plusieurs
 * matchs (rematch après un unmatch), ce qui compterait la même personne deux
 * fois. Les conversations sans identifiant exploitable sont ignorées — mieux
 * vaut un badge qui sous-estime qu'un badge qui invente un interlocuteur.
 */
export function compterPersonnesNonLues(conversations) {
  if (!Array.isArray(conversations)) return 0
  const personnes = new Set()
  for (const c of conversations) {
    if ((c?.unreadCount || 0) <= 0) continue
    const id = c?.player?.id
    if (id) personnes.add(id)
  }
  return personnes.size
}
