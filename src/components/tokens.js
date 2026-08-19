// ─── Tokens de rayon ────────────────────────────────────────────────────────
// Échelle unique pour les coins arrondis. Introduite parce que quatre cartes
// de contenu du même type visuel affichaient quatre rayons différents
// (16 / 12 / 14 / 20) sans qu'aucune raison ne le justifie.
//
// PORTÉE VOLONTAIREMENT LIMITÉE pour l'instant : seules ces quatre cartes
// utilisent ces tokens. Le projet compte ~300 autres `borderRadius` qui
// servent à toute autre chose — bordures fines, avatars ronds, pastilles,
// barres de progression — et un remplacement mécanique changerait des tailles
// sans rapport. Leur reprise est un chantier à part, à mener avec le temps de
// vérification qu'il demande.
export const RADIUS = {
  sm:   8,    // puces, champs, petits boutons
  md:   12,   // boutons pleine largeur, lignes de liste
  lg:   16,   // cartes de contenu — le cran par défaut
  xl:   20,   // panneaux, modales, feuilles
  pill: 9999, // pastilles, avatars, badges
};
