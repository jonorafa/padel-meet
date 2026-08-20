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

// ─── Persistance ────────────────────────────────────────────────────────────
// Les filtres n'étaient pas sauvegardés : ils repartaient aux valeurs par
// défaut à chaque ouverture de l'app, et tout réglage était perdu.

const VALEURS = {
  side:       ['any', 'forehand', 'backhand'],
  hand:       ['any', 'left', 'right'],
  style:      ['any', 'aggressive', 'defensive', 'all-court'],
  motivation: ['any', 'fun', 'improve', 'compete'],
};

const nombreDans = (v, min, max, defaut) => {
  const n = typeof v === 'number' ? v : parseFloat(v);
  return Number.isFinite(n) && n >= min && n <= max ? n : defaut;
};

/**
 * Valide des filtres venus du stockage, champ par champ, en retombant sur le
 * défaut pour tout ce qui ne va pas.
 *
 * Ce n'est pas de la paranoïa : une valeur périmée ou corrompue, ici, ne
 * provoque pas d'erreur visible — elle vide la pile de swipe SANS RIEN DIRE.
 * L'utilisateur croirait qu'il n'y a plus personne à afficher. Le format
 * stocké peut aussi changer d'une version à l'autre, et un ancien appareil
 * gardera longtemps l'ancien.
 */
export function normaliserFiltres(brut, defauts) {
  if (!brut || typeof brut !== 'object') return { ...defauts };
  const out = { ...defauts };

  for (const [cle, permises] of Object.entries(VALEURS)) {
    if (permises.includes(brut[cle])) out[cle] = brut[cle];
  }
  // La région n'a pas de liste fermée (pays, et la taxonomie a déjà bougé) :
  // on accepte toute chaîne non vide, faute de quoi on garde le défaut.
  if (typeof brut.region === 'string' && brut.region.trim()) out.region = brut.region;

  out.frequency = nombreDans(brut.frequency, 0, 5, defauts.frequency);
  let min = nombreDans(brut.levelMin, 1, 7, defauts.levelMin);
  let max = nombreDans(brut.levelMax, 1, 7, defauts.levelMax);
  // Bornes inversées : on les remet dans l'ordre plutôt que de tout jeter, ce
  // qui donnerait une fourchette vide et donc une pile vide.
  if (min > max) [min, max] = [max, min];
  out.levelMin = min;
  out.levelMax = max;
  return out;
}

const CLE = 'padel_filters';
const VERSION = 1;

/**
 * Relit les filtres du stockage. Ignore ceux d'un AUTRE utilisateur : sur un
 * appareil partagé, hériter des critères du compte précédent donnerait une
 * pile incompréhensible (cf. le même souci traité par cleanupOldUserData pour
 * le niveau et l'historique).
 */
export function chargerFiltres(defauts, userId = null, storage = globalThis.localStorage) {
  try {
    const brut = JSON.parse(storage.getItem(CLE));
    if (!brut || brut.v !== VERSION) return { ...defauts };
    if ((brut.userId ?? null) !== (userId ?? null)) return { ...defauts };
    return normaliserFiltres(brut.filtres, defauts);
  } catch {
    // JSON illisible, stockage indisponible (mode privé) : on repart des
    // défauts. Silencieux à dessein — perdre ses filtres n'est pas un incident.
    return { ...defauts };
  }
}

export function sauverFiltres(filtres, userId = null, storage = globalThis.localStorage) {
  try {
    storage.setItem(CLE, JSON.stringify({ v: VERSION, userId: userId ?? null, filtres }));
    return true;
  } catch {
    return false;
  }
}
