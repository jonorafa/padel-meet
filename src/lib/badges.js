// Trophées débloqués par un joueur — logique pure, réutilisable pour "moi"
// (ProfileScreen/MatchesScreen) ou pour n'importe quel joueur consulté
// (PlayerCard, DetailedProfileModal).
//
// streakMax = série de victoires consécutives la plus longue. Calculée
// côté client depuis l'historique de matchs (voir MatchesScreen), disponible
// UNIQUEMENT pour l'utilisateur connecté — omettre ce paramètre pour un
// joueur consulté plutôt que d'utiliser `profiles.streak_max` (qui est un
// concept différent : la série de connexions quotidiennes, cf useStreak.js).
export function computeBadges({ matchesPlayed = 0, streakMax = 0, level = 0 } = {}) {
  return [
    { icon: '🎾', key: 'first_match', unlocked: matchesPlayed >= 1 },
    { icon: '🔥', key: 'streak_5',    unlocked: streakMax >= 5 },
    { icon: '⭐', key: 'matches_10',  unlocked: matchesPlayed >= 10 },
    { icon: '👑', key: 'level_5',     unlocked: level >= 5 },
  ];
}
