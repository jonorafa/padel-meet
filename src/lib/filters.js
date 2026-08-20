// Filtrage de la pile de swipe et élargissement automatique des critères.
//
// Extrait de MatchScreen : ce sont des fonctions pures, donc testables sans
// navigateur — et l'élargissement mérite des tests, car un ordre de relâchement
// mal choisi trahirait l'intention de l'utilisateur (on ne veut pas lui rendre
// n'importe qui alors qu'il a été précis sur son niveau).

/** Critères qui EXCLUENT un joueur de la pile (le « partenaire idéal » d'un
 *  profil, lui, ne sert qu'à trier — cf. src/lib/compatibility.js). */
export function applyFilters(players, f) {
  return players.filter(p => {
    if (f.side !== 'any' && p.side !== f.side) return false;
    if (f.hand !== 'any' && p.hand !== f.hand) return false;
    if (f.style !== 'any' && p.style !== f.style) return false;
    if (f.motivation !== 'any' && p.motivation !== f.motivation) return false;
    if (f.region !== 'any' && p.country !== f.region) return false;
    if (p.level !== null && p.level !== undefined && (p.level < f.levelMin || p.level > f.levelMax)) return false;
    if (f.frequency > 0 && p.frequency < f.frequency) return false;
    return true;
  });
}

// Ordre de relâchement, du moins au plus coûteux pour l'intention exprimée.
// La fréquence part en premier (c'est une contrainte de disponibilité, pas de
// jeu), puis les préférences de style, puis les caractéristiques physiques.
// Le NIVEAU s'élargit par paliers d'un demi-point avant d'être abandonné : un
// joueur qui cherche du 4–5 préfère voir du 3.5–5.5 plutôt que des débutants.
// La RÉGION part en dernier : proposer un partenaire à l'autre bout du pays
// est ce qui rend un match le plus improbable dans la vraie vie.
const ETAPES = [
  { nom: 'frequency',  applicable: (f) => f.frequency > 0,        relacher: (f) => ({ ...f, frequency: 0 }) },
  { nom: 'style',      applicable: (f) => f.style !== 'any',      relacher: (f) => ({ ...f, style: 'any' }) },
  { nom: 'motivation', applicable: (f) => f.motivation !== 'any', relacher: (f) => ({ ...f, motivation: 'any' }) },
  { nom: 'hand',       applicable: (f) => f.hand !== 'any',       relacher: (f) => ({ ...f, hand: 'any' }) },
  { nom: 'side',       applicable: (f) => f.side !== 'any',       relacher: (f) => ({ ...f, side: 'any' }) },
  {
    nom: 'level',
    applicable: (f) => f.levelMin > 1 || f.levelMax < 7,
    relacher: (f) => ({ ...f, levelMin: Math.max(1, f.levelMin - 0.5), levelMax: Math.min(7, f.levelMax + 0.5) }),
  },
  { nom: 'region',     applicable: (f) => f.region !== 'any',     relacher: (f) => ({ ...f, region: 'any' }) },
];

/** Relâche UN cran. `change` vaut false quand plus rien ne peut être élargi. */
export function assouplirDunCran(filtres) {
  const etape = ETAPES.find(e => e.applicable(filtres));
  if (!etape) return { filtres, change: false, critere: null };
  return { filtres: etape.relacher(filtres), change: true, critere: etape.nom };
}

/**
 * Élargit jusqu'à ce qu'au moins un joueur ressorte — le comportement attendu
 * d'un bouton « élargir » : un seul appui doit redonner des profils, pas
 * ouvrir un panneau à régler à la main.
 * S'arrête dès qu'il y a un résultat, pour ne pas relâcher plus que nécessaire.
 */
export function elargirJusquaResultat(players, filtres) {
  let courant = filtres;
  const relaches = [];
  // Borne de sécurité : ETAPES est fini, mais le palier de niveau se rejoue
  // tant que la fourchette n'est pas [1,7] — d'où une limite explicite.
  for (let i = 0; i < 40; i++) {
    if (applyFilters(players, courant).length > 0) break;
    const { filtres: suivant, change, critere } = assouplirDunCran(courant);
    if (!change) return { filtres: courant, change: relaches.length > 0, relaches, epuise: true };
    courant = suivant;
    if (!relaches.includes(critere)) relaches.push(critere);
  }
  return { filtres: courant, change: relaches.length > 0, relaches, epuise: false };
}
