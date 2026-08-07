import { PadelBall } from '../components/CourtUI';
import { FlameSVG } from '../components/FlameSVG';

// Étoile et couronne — tracé cohérent avec les icônes de nav (stroke 1.5, linecap round).
// Les quatre trophées étaient en emoji : rendu variable d'un téléphone à l'autre,
// alors que tout le reste de l'app est en SVG.
const StarIcon = ({ color, size = 24 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color}
    strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.2 1 5.9-5.2-2.8-5.2 2.8 1-5.9L3.5 9.7l5.9-.8z" />
  </svg>
);

const CrownIcon = ({ color, size = 24 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color}
    strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 7l4 4 5-6 5 6 4-4v11H3z" /><path d="M3 18h18" />
  </svg>
);

// Trophées débloqués par un joueur — logique pure, réutilisable pour "moi"
// (ProfileScreen/MatchesScreen) ou pour n'importe quel joueur consulté
// (PlayerCard, DetailedProfileModal).
//
// streakMax = série de victoires consécutives la plus longue. Calculée
// côté client depuis l'historique de matchs (voir MatchesScreen), disponible
// UNIQUEMENT pour l'utilisateur connecté — omettre ce paramètre pour un
// joueur consulté plutôt que d'utiliser `profiles.streak_max` (qui est un
// concept différent : la série de connexions quotidiennes, cf useStreak.js).
//
// `progress` sert à l'anneau doré de l'état verrouillé (cf Achievements) :
// il remplace le cadenas, qui ne disait pas ce qu'il restait à faire.
export function computeBadges({ matchesPlayed = 0, streakMax = 0, level = 0 } = {}) {
  return [
    {
      key: 'first_match', unlocked: matchesPlayed >= 1,
      Icon: ({ size }) => <PadelBall size={size} shadow={false} />,
      progress: { cur: Math.min(matchesPlayed, 1), max: 1 },
    },
    {
      key: 'streak_5', unlocked: streakMax >= 5,
      Icon: ({ size }) => <FlameSVG size={size * 0.85} animated={false} />,
      progress: { cur: Math.min(streakMax, 5), max: 5 },
    },
    {
      key: 'matches_10', unlocked: matchesPlayed >= 10,
      Icon: StarIcon,
      progress: { cur: Math.min(matchesPlayed, 10), max: 10 },
    },
    {
      key: 'level_5', unlocked: level >= 5,
      Icon: CrownIcon,
      progress: { cur: Math.min(level, 5), max: 5 },
    },
  ];
}
