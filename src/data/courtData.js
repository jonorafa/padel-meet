export const REGIONS = ['France', 'Israël'];

/**
 * getGreeting — salutation selon l'heure locale de l'appareil.
 *   • 04:00 → 16:59  → « Bonjour » (journée)
 *   • 17:00 → 03:59  → « Bonsoir » (soirée/nuit)
 * Recalculé à chaque rendu → l'affichage suit l'horaire.
 */
export function getGreeting(lang = 'fr') {
  const h = new Date().getHours();
  const isDay = h >= 4 && h < 17;
  const G = {
    fr: { day: 'Bonjour,',  eve: 'Bonsoir,' },
    en: { day: 'Hello,',    eve: 'Good evening,' },
    he: { day: 'שלום,',      eve: 'ערב טוב,' },
  }[lang] || { day: 'Bonjour,', eve: 'Bonsoir,' };
  return isDay ? G.day : G.eve;
}

// Sous-régions par pays — utilisé à l'inscription et dans le filtrage
export const SUB_REGIONS = {
  'France': ['Paris', 'Marseille'],
  'Israël': ['Centre', 'Sud', 'Nord'],
};

// Régions appartenant à la France (pays + villes/sous-régions historiques)
const FRANCE_REGIONS = [
  'France', 'Paris', 'Marseille', 'Lyon', 'Nice', 'Bordeaux', 'Toulouse', 'Lille',
];

/**
 * regionToCountry — déduit le pays ('France' | 'Israël') d'un profil,
 * en tolérant les anciennes valeurs de region/city (Centre, Nord, Tel Aviv…).
 * Tout ce qui n'est pas français est considéré comme Israël (défaut de l'app).
 * Garantit l'isolation stricte France / Israël même sur données héritées.
 */
export function regionToCountry(p) {
  if (!p) return 'Israël';
  const r = String(p.region || p.city || '').trim();
  if (FRANCE_REGIONS.includes(r)) return 'France';
  return 'Israël';
}

// ─── LIVE SCORE ───
export const EMPTY_SCORE = {
  running: false,
  sets: [],
  currentSet: { me: 0, them: 0 },
  server: 'me',
  matchId: null,
};

export const I18N = {
  fr: {
    dir: 'ltr',
    tagline: "Trouve ton partenaire idéal de padel.",
    cta_level: 'Établir mon niveau',
    members: 'Membres · depuis 2026',
    chooseLang: 'Choisissez votre langue',
    quizQ: 'Question', of: 'sur',
    continue: 'Continuer',
    yourLevel: 'Votre niveau initial',
    levelExplain: '',
    enterClub: 'Entrer au club',
    home: 'Accueil', search: 'Trouver', learn: 'Conseil', matches: 'Matchs', profile: 'Profil',
    greeting: 'Bonsoir,', currentLevel: 'Niveau actuel', outOf: 'sur',
    confidence: 'Indice de confiance', compatibility: 'Compatibilité', validated: 'Validé par 14 adversaires',
    evaluate: 'Évaluer', myLevel: 'mon niveau',
    find: 'Trouver', partner: 'un partenaire',
    recent: 'Activité récente', history: 'Historique des matchs',
    atClub: 'Au club', partners: 'Partenaires', available: 'disponibles',
    yes: 'Au jeu', no: 'Une autre fois',
    filters: 'Préférences', applyFilters: 'Appliquer',
    side: 'Côté', forehand: 'Droite', backhand: 'Gauche', anySide: 'Indifférent',
    playerStyle: 'Style', aggressive: 'Offensif', defensive: 'Défensif', allcourt: 'Polyvalent', anyStyle: 'Indifférent',
    motivation: 'Motivation', fun: 'Le plaisir', improve: 'Progresser', compete: 'Compétition', anyMot: 'Indifférent',
    region: 'Région', frequency: 'Fréquence', availability: 'Disponibilités',
    levelRange: 'Plage de niveau', times: '× / sem.',
    // Chantier 4 — PlayerCard redesign
    styleLabel: 'Style', regionLabel: 'Région', handLabel: 'Main', sideLabel: 'Côté',
    lookingFor: 'Recherche', tapToSeeMore: 'Toucher pour voir le profil',
    partnerPrefsTitle: 'Le partenaire idéal', partnerPrefsHint: 'Décris qui tu cherches',
    changePhoto: 'Changer ma photo', uploadPhoto: 'Choisir une photo',
    hand: 'Main', leftHand: 'Gaucher', rightHand: 'Droitier',
    matchesPlayed: 'Matchs', winRateLabel: 'Victoires', bestStreakLabel: 'Série',
    setProfile: 'Mes préférences',
    reset: 'Réinitialiser',
    morning: 'Matin', evening: 'Soir', weekend: 'Weekend',
    saveAndSwipe: 'Trouver →',
    welcome: 'Bienvenue', enter: 'Entrer',
    refreshStack: 'Reprendre →',
    closedClub: 'Le club ferme ses portes.',
    closedHint: 'Revenez demain — de nouveaux membres rejoindront le court.',
    member: 'Membre', myProfile: 'Mon profil',
    myStyle: 'Mon style', settings: 'Paramètres',
    back: 'Retour', language: 'Langue',
    itsAMatch: "C'est un match !",
    matchSub: 'Vous vous êtes mutuellement choisis.',
    partnerFound: 'Partenaire trouvé',
    partnerFoundSub: 'Vous cherchez tous les deux à jouer. Organisez votre partie.',
    proposeSlot: 'Proposer un créneau',
    continueSearching: 'Continuer à chercher',
    sendMsg: 'Envoyer un message',
    keepSwiping: 'Continuer',
    notifications: 'Notifications',
    noNotifs: 'Aucune nouvelle notification',
    commonMatches: 'matchs en commun',
    online: 'En ligne',
    lastSeen: 'Vu il y a',
    scoreTracker: 'Score en direct',
    startMatch: 'Démarrer un match',
    endMatch: 'Terminer',
    myScore: 'Moi',
    theirScore: 'Eux',
    typeMessage: 'Votre message...',
    send: 'Envoyer',
    chat: 'Messages',
    noChats: 'Aucun message pour le moment.',
    winStreak: 'Série actuelle',
    hardestOpponent: 'Adversaire clé',
    levelHistory: 'Évolution du niveau',
    nextTier: 'Prochain palier',
    trophiesTitle: 'Trophées',
    evolutionTitle: 'Évolution',
    trophyFirstMatch: 'Premier match',
    trophyStreak5: 'Série de 5',
    trophyTenMatches: '10 matchs',
    trophyLevel5: 'Niveau 5',
    tierHint: 'Encore {n} {wins} contre des joueurs {floor}+ pour passer {next}',
    winWord: 'victoire', winsWord: 'victoires',
    maxTier: 'Niveau maximum atteint',
    noEvolutionYet: 'Joue des matchs pour suivre ta progression.',
    periodAll: 'Tout',
    peerRatingsLabel: 'Évaluations pairs',
    coverageLabel: 'Couverture',
    winRateVsLabel: 'Victoires {floor}+',
    promotionReadyMsg: 'Prêt(e) pour le palier {next} !',
    demotionRiskMsg: 'Attention : risque de descente de niveau.',
    noTierData: 'Joue des matchs et évalue tes adversaires pour activer les signaux.',
    gateLabel: 'Condition',
    provisionalLevel: 'Couverture insuffisante — niveau provisoire',
    skipQuiz: 'Passer →',
    darkMode: 'Mode sombre',
    statsTitle: 'Mes statistiques',
    undoSwipe: 'Annuler',
    searchPlayer: 'Rechercher un joueur',
    addPlayer: 'Ajouter',
    requestSent: 'Demande envoyée ✓',
    noPlayer: 'Aucun joueur trouvé',
    levelNotEvaluated: 'Premier match à jouer 🎾',
    noActivity: 'Aucune activité récente.',
    noMatchesYet: 'Aucun match encore joué.',
    evaluateOpponent: 'Évaluer mon adversaire',
    evalTitle: 'Évaluation de',
    evalSub: 'Quel niveau lui donnez-vous ?',
    evalSend: 'Envoyer',
    evalThanks: 'Merci pour votre évaluation !',
    evalLevelTitle: 'Quel est son vrai niveau ?',
    evalLevelSub: 'Évaluez honnêtement le niveau de',
    evalLevelSend: 'Envoyer',
    levelBeginner: 'Débutant',
    levelIntermediate: 'Intermédiaire',
    levelConfirmed: 'Confirmé',
    levelAdvanced: 'Avancé',
    levelExpert: 'Expert',
    skipForNow: 'Passer pour l\'instant',
    // Chantier 2 translations
    editProfile: 'Modifier mon profil',
    photos: 'Photos',
    managePhotos: 'Glissez pour réordonner, appuyez pour supprimer',
    addYourFirstPhoto: 'Ajoutez votre première photo',
    addMorePhotos: 'Ajouter plus de photos',
    bio: 'Biographie',
    bioPlaceholder: 'Parlez de vous en quelques mots...',
    preferences: 'Préférences',
    dominantHand: 'Main dominante',
    left: 'Gauche',
    right: 'Droite',
    preferredSide: 'Côté préféré',
    baseline: 'Ligne de fond',
    net: 'Filet',
    both: 'Les deux',
    playStyle: 'Style de jeu',
    playFrequency: 'Fréquence de jeu',
    cancel: 'Annuler',
    saving: 'Sauvegarde...',
    saveProfile: 'Enregistrer le profil',
    profileUpdated: 'Profil mis à jour !',
    playerNotFound: 'Joueur non trouvé',
    noPhotos: 'Aucune photo',
    matchHistoryWith: 'Historique des matchs avec',
    close: 'Fermer',
    winrate: 'Taux de victoire',
    wins: 'Victoires', style: 'Style', 'all-court': 'Polyvalent',
    // Chantier 3 — Anti-fraude & validation
    pendingMatches: 'Scores à valider',
    toConfirm: 'À confirmer',
    awaiting: 'En attente',
    noPendingMatches: 'Aucun score à valider',
    noPendingHint: 'Les scores soumis par vos adversaires apparaîtront ici.',
    scoreSubmittedByThem: 'a soumis ce score',
    waitingConfirmFrom: 'En attente de la confirmation de',
    expiresIn: 'Expire dans',
    youWon: 'Victoire',
    youLost: 'Défaite',
    draw: 'Égalité',
    opponent: 'Adversaire',
    confirm: 'Confirmer',
    reject: 'Rejeter',
    confirmReject: 'Êtes-vous sûr de vouloir rejeter ce score ?',
    error: 'Erreur',
    submitScore: 'Soumettre le score',
    selectOpponent: 'Sélectionnez l\'adversaire',
    noMatchesForSubmit: 'Vous n\'avez aucun partenaire de match. Trouvez-en un d\'abord.',
    finalScore: 'Score final',
    submitForConfirmation: 'Envoyer pour confirmation',
    submitHint: 'Votre adversaire devra confirmer le score sous 72h.',
    // Sprint 3-4
    scoreInputMode: 'Saisir', liveMode: 'En direct', textMode: 'Par texte',
    scoreInputPlaceholder: 'Ex: 6-4 6-3', scoreInputHint: 'Séparer les sets par un espace',
    scoreInvalid: 'Format invalide — ex: 6-4 6-3',
    photoRequired: 'Ajoutez une photo pour continuer',
    rateMatch: 'Évaluer ce match', skipEval: 'Passer',
    likesReceived: 'Likes reçus', noLikesYet: 'Aucun like pour l\'instant',
    errorTitle: 'Une erreur est survenue', errorHint: 'Rechargez la page pour réessayer.', reload: 'Recharger',
  },
  en: {
    dir: 'ltr',
    tagline: 'Find your ideal padel partner.',
    cta_level: 'Establish my level',
    members: 'Members · since 2026',
    chooseLang: 'Language',
    quizQ: 'Question', of: 'of',
    continue: 'Continue',
    yourLevel: 'Your initial level',
    levelExplain: '',
    enterClub: 'Enter the club',
    home: 'Home', search: 'Find', learn: 'Tip', matches: 'Matches', profile: 'Profile',
    greeting: 'Good evening,', currentLevel: 'Current level', outOf: 'out of',
    confidence: 'Confidence index', compatibility: 'Compatibility', validated: 'Validated by 14 opponents',
    evaluate: 'Rate', myLevel: 'my level',
    find: 'Find', partner: 'a partner',
    recent: 'Recent activity', history: 'Match history',
    atClub: 'At the club', partners: 'Partners', available: 'available',
    yes: "I'm in", no: 'Another time',
    filters: 'Preferences', applyFilters: 'Apply',
    side: 'Side', forehand: 'Right', backhand: 'Left', anySide: 'Any',
    playerStyle: 'Style', aggressive: 'Offensive', defensive: 'Defensive', allcourt: 'All-court', anyStyle: 'Any',
    motivation: 'Motivation', fun: 'For fun', improve: 'Improve', compete: 'Compete', anyMot: 'Any',
    region: 'Region', frequency: 'Frequency', availability: 'Availability',
    levelRange: 'Level range', times: '× / week',
    // Chantier 4 — PlayerCard redesign
    styleLabel: 'Style', regionLabel: 'Region', handLabel: 'Hand', sideLabel: 'Side',
    lookingFor: 'Looking for', tapToSeeMore: 'Tap to see profile',
    partnerPrefsTitle: 'My ideal partner', partnerPrefsHint: 'Describe who you are looking for',
    changePhoto: 'Change my photo', uploadPhoto: 'Choose a photo',
    hand: 'Hand', leftHand: 'Left-handed', rightHand: 'Right-handed',
    matchesPlayed: 'Matches', winRateLabel: 'Win rate', bestStreakLabel: 'Streak',
    setProfile: 'My preferences',
    reset: 'Reset',
    morning: 'Morning', evening: 'Evening', weekend: 'Weekend',
    saveAndSwipe: 'Find →',
    welcome: 'Welcome', enter: 'Enter',
    refreshStack: 'Refresh →',
    closedClub: 'The club is closing.',
    closedHint: 'Come back tomorrow — new members will join the court.',
    member: 'Member', myProfile: 'My profile',
    myStyle: 'My style', settings: 'Settings',
    back: 'Back', language: 'Language',
    itsAMatch: "It's a match!",
    matchSub: 'You both chose each other.',
    partnerFound: 'Partner found',
    partnerFoundSub: 'You both want to play. Set up your match.',
    proposeSlot: 'Propose a time',
    continueSearching: 'Keep searching',
    sendMsg: 'Send a message',
    keepSwiping: 'Keep swiping',
    notifications: 'Notifications',
    noNotifs: 'No new notifications',
    commonMatches: 'matches in common',
    online: 'Online',
    lastSeen: 'Last seen',
    scoreTracker: 'Live Score',
    startMatch: 'Start a match',
    endMatch: 'End',
    myScore: 'Me',
    theirScore: 'Them',
    typeMessage: 'Your message...',
    send: 'Send',
    chat: 'Messages',
    noChats: 'No messages yet.',
    winStreak: 'Current streak',
    hardestOpponent: 'Key opponent',
    levelHistory: 'Level history',
    nextTier: 'Next tier',
    trophiesTitle: 'Trophies',
    evolutionTitle: 'Progress',
    trophyFirstMatch: 'First match',
    trophyStreak5: '5-win streak',
    trophyTenMatches: '10 matches',
    trophyLevel5: 'Level 5',
    tierHint: '{n} more {wins} vs {floor}+ players to reach {next}',
    winWord: 'win', winsWord: 'wins',
    maxTier: 'Top level reached',
    noEvolutionYet: 'Play matches to track your progress.',
    periodAll: 'All',
    peerRatingsLabel: 'Peer ratings',
    coverageLabel: 'Coverage',
    winRateVsLabel: 'Wins vs {floor}+',
    promotionReadyMsg: 'Ready for tier {next}!',
    demotionRiskMsg: 'Warning: demotion risk detected.',
    noTierData: 'Play matches and rate opponents to activate signals.',
    gateLabel: 'Gate',
    provisionalLevel: 'Insufficient coverage — provisional level',
    skipQuiz: 'Skip →',
    darkMode: 'Dark mode',
    statsTitle: 'My stats',
    undoSwipe: 'Undo',
    searchPlayer: 'Search a player',
    addPlayer: 'Add',
    requestSent: 'Request sent ✓',
    noPlayer: 'No player found',
    levelNotEvaluated: 'First match to play 🎾',
    noActivity: 'No recent activity.',
    noMatchesYet: 'No matches played yet.',
    evaluateOpponent: 'Rate my opponent',
    evalTitle: 'Rating',
    evalSub: 'What level would you give them?',
    evalSend: 'Send',
    evalThanks: 'Thanks for your rating!',
    evalLevelTitle: "What's their real level?",
    evalLevelSub: "Honestly rate the level of",
    evalLevelSend: 'Send',
    levelBeginner: 'Beginner',
    levelIntermediate: 'Intermediate',
    levelConfirmed: 'Confirmed',
    levelAdvanced: 'Advanced',
    levelExpert: 'Expert',
    skipForNow: 'Skip for now',
    // Chantier 2 translations
    editProfile: 'Edit profile',
    photos: 'Photos',
    managePhotos: 'Drag to reorder, tap to delete',
    addYourFirstPhoto: 'Add your first photo',
    addMorePhotos: 'Add more photos',
    bio: 'Bio',
    bioPlaceholder: 'Tell us about yourself...',
    preferences: 'Preferences',
    dominantHand: 'Dominant hand',
    left: 'Left',
    right: 'Right',
    preferredSide: 'Preferred side',
    baseline: 'Baseline',
    net: 'Net',
    both: 'Both',
    playStyle: 'Play style',
    playFrequency: 'Play frequency',
    cancel: 'Cancel',
    saving: 'Saving...',
    saveProfile: 'Save profile',
    profileUpdated: 'Profile updated!',
    playerNotFound: 'Player not found',
    noPhotos: 'No photos',
    matchHistoryWith: 'Match history with',
    close: 'Close',
    winrate: 'Win rate',
    wins: 'Wins', style: 'Style', 'all-court': 'All-court',
    // Chantier 3 — Anti-fraud & validation
    pendingMatches: 'Pending scores',
    toConfirm: 'To confirm',
    awaiting: 'Awaiting',
    noPendingMatches: 'No pending scores',
    noPendingHint: 'Scores submitted by your opponents will appear here.',
    scoreSubmittedByThem: 'submitted this score',
    waitingConfirmFrom: 'Awaiting confirmation from',
    expiresIn: 'Expires in',
    youWon: 'You won',
    youLost: 'You lost',
    draw: 'Draw',
    opponent: 'Opponent',
    confirm: 'Confirm',
    reject: 'Reject',
    confirmReject: 'Are you sure you want to reject this score?',
    error: 'Error',
    submitScore: 'Submit score',
    selectOpponent: 'Select opponent',
    noMatchesForSubmit: 'You have no match partners yet. Find one first.',
    finalScore: 'Final score',
    submitForConfirmation: 'Send for confirmation',
    submitHint: 'Your opponent will have 72h to confirm the score.',
    // Sprint 3-4
    scoreInputMode: 'Enter', liveMode: 'Live', textMode: 'Text',
    scoreInputPlaceholder: 'e.g. 6-4 6-3', scoreInputHint: 'Separate sets with a space',
    scoreInvalid: 'Invalid format — e.g. 6-4 6-3',
    photoRequired: 'Add a photo to continue',
    rateMatch: 'Rate this match', skipEval: 'Skip',
    likesReceived: 'Likes received', noLikesYet: 'No likes yet',
    errorTitle: 'Something went wrong', errorHint: 'Reload the page to try again.', reload: 'Reload',
  },
  he: {
    dir: 'rtl',
    tagline: 'מצא את שותף הפאדל האידיאלי שלך.',
    cta_level: 'הגדר את הרמה שלי',
    members: 'חברים · מאז 2026',
    chooseLang: 'בחר את השפה שלך',
    quizQ: 'שאלה', of: 'מתוך',
    continue: 'המשך',
    yourLevel: 'הרמה ההתחלתית שלך',
    levelExplain: '',
    enterClub: 'כניסה למועדון',
    home: 'בית', search: 'מצא', learn: 'טיפ', matches: 'משחקים', profile: 'פרופיל',
    greeting: 'ערב טוב,', currentLevel: 'רמה נוכחית', outOf: 'מתוך',
    confidence: 'מדד אמינות', compatibility: 'תאימות', validated: 'אומת על ידי 14 יריבים',
    evaluate: 'הערך', myLevel: 'את הרמה שלי',
    find: 'מצא', partner: 'שותף',
    recent: 'פעילות אחרונה', history: 'היסטוריית משחקים',
    atClub: 'במועדון', partners: 'שותפים', available: 'זמינים',
    yes: 'אני בפנים', no: 'פעם אחרת',
    filters: 'העדפות', applyFilters: 'החל',
    side: 'צד', forehand: 'ימין', backhand: 'שמאל', anySide: 'לא משנה',
    playerStyle: 'סגנון', aggressive: 'התקפי', defensive: 'הגנתי', allcourt: 'מאוזן', anyStyle: 'לא משנה',
    motivation: 'מוטיבציה', fun: 'הנאה', improve: 'שיפור', compete: 'תחרות', anyMot: 'לא משנה',
    region: 'אזור', frequency: 'תדירות', availability: 'זמינות',
    levelRange: 'טווח רמה', times: '× / שבוע',
    // Chantier 4 — PlayerCard redesign
    styleLabel: 'סגנון', regionLabel: 'אזור', handLabel: 'יד', sideLabel: 'צד',
    lookingFor: 'מחפש', tapToSeeMore: 'הקש לפרופיל מלא',
    partnerPrefsTitle: 'השותף האידיאלי', partnerPrefsHint: 'תאר את מי שאתה מחפש',
    changePhoto: 'שנה תמונה', uploadPhoto: 'בחר תמונה',
    hand: 'יד', leftHand: 'שמאלי', rightHand: 'ימני',
    matchesPlayed: 'משחקים', winRateLabel: 'נצחונות', bestStreakLabel: 'רצף',
    setProfile: 'ההעדפות שלי',
    reset: 'איפוס',
    morning: 'בוקר', evening: 'ערב', weekend: 'סוף שבוע',
    saveAndSwipe: '← מצא',
    welcome: 'ברוך הבא', enter: 'כניסה',
    refreshStack: '← חזרה',
    closedClub: 'המועדון סוגר את שעריו.',
    closedHint: 'חזור מחר — חברים חדשים יצטרפו למגרש.',
    member: 'חבר', myProfile: 'הפרופיל שלי',
    myStyle: 'הסגנון שלי', settings: 'הגדרות',
    back: 'חזרה', language: 'שפה',
    itsAMatch: '!זה מאץ׳',
    matchSub: '.שניכם בחרתם זה בזה',
    partnerFound: 'נמצא שותף',
    partnerFoundSub: 'שניכם רוצים לשחק. תאמו את המשחק שלכם.',
    proposeSlot: 'הצע מועד',
    continueSearching: 'המשך לחפש',
    sendMsg: 'שלח הודעה',
    keepSwiping: 'המשך',
    notifications: 'התראות',
    noNotifs: 'אין התראות חדשות',
    commonMatches: 'משחקים משותפים',
    online: 'מחובר',
    lastSeen: 'נראה לפני',
    scoreTracker: 'ניקוד חי',
    startMatch: 'התחל משחק',
    endMatch: 'סיום',
    myScore: 'אני',
    theirScore: 'הם',
    typeMessage: '...ההודעה שלך',
    send: 'שלח',
    chat: 'הודעות',
    noChats: 'אין הודעות עדיין.',
    winStreak: 'רצף נוכחי',
    hardestOpponent: 'יריב מרכזי',
    levelHistory: 'התפתחות הרמה',
    nextTier: 'דרגה הבאה',
    trophiesTitle: 'גביעים',
    evolutionTitle: 'התקדמות',
    trophyFirstMatch: 'משחק ראשון',
    trophyStreak5: 'רצף של 5',
    trophyTenMatches: '10 משחקים',
    trophyLevel5: 'רמה 5',
    tierHint: 'עוד {n} {wins} מול שחקנים {floor}+ כדי להגיע ל-{next}',
    winWord: 'ניצחון', winsWord: 'ניצחונות',
    maxTier: 'הגעת לרמה המקסימלית',
    noEvolutionYet: 'שחק משחקים כדי לעקוב אחר ההתקדמות שלך.',
    periodAll: 'הכל',
    peerRatingsLabel: 'הערכות עמיתים',
    coverageLabel: 'כיסוי',
    winRateVsLabel: 'ניצחונות {floor}+',
    promotionReadyMsg: 'מוכן לדרגה {next}!',
    demotionRiskMsg: 'אזהרה: סיכון לירידת דרגה.',
    noTierData: 'שחק משחקים והעריך יריבים כדי להפעיל את האותות.',
    gateLabel: 'תנאי',
    provisionalLevel: 'כיסוי לא מספיק — רמה זמנית',
    skipQuiz: '← דלג',
    darkMode: 'מצב כהה',
    statsTitle: 'הסטטיסטיקות שלי',
    undoSwipe: 'בטל',
    searchPlayer: 'חפש שחקן',
    addPlayer: 'הוסף',
    requestSent: '✓ בקשה נשלחה',
    noPlayer: 'לא נמצא שחקן',
    levelNotEvaluated: 'מחכה למשחק הראשון 🎾',
    noActivity: 'אין פעילות אחרונה.',
    noMatchesYet: 'אין משחקים עדיין.',
    evaluateOpponent: 'הערך את היריב שלי',
    evalTitle: 'הערכה של',
    evalSub: 'איזה רמה תיתן לו?',
    evalSend: 'שלח',
    evalThanks: 'תודה על ההערכה!',
    evalLevelTitle: 'מה הרמה האמיתית שלו?',
    evalLevelSub: 'הערך בכנות את רמתו של',
    evalLevelSend: 'שלח',
    levelBeginner: 'מתחיל',
    levelIntermediate: 'בינוני',
    levelConfirmed: 'מתקדם',
    levelAdvanced: 'מתקדם מאוד',
    levelExpert: 'מומחה',
    skipForNow: 'דלג לעת עתה',
    // Chantier 2 translations
    editProfile: 'עריכת פרופיל',
    photos: 'תמונות',
    managePhotos: 'גרור לסדר מחדש, הקש למחיקה',
    addYourFirstPhoto: 'הוסף את התמונה הראשונה שלך',
    addMorePhotos: 'הוסף עוד תמונות',
    bio: 'ביוגרפיה',
    bioPlaceholder: 'ספר לנו קצת על עצמך...',
    preferences: 'העדפות',
    dominantHand: 'יד דומיננטית',
    left: 'שמאל',
    right: 'ימין',
    preferredSide: 'צד מועדף',
    baseline: 'קו הקצה',
    net: 'רשת',
    both: 'שניהם',
    playStyle: 'סגנון משחק',
    playFrequency: 'תדירות משחק',
    cancel: 'ביטול',
    saving: 'שמירה...',
    saveProfile: 'שמור פרופיל',
    profileUpdated: 'הפרופיל עודכן!',
    playerNotFound: 'שחקן לא נמצא',
    noPhotos: 'אין תמונות',
    matchHistoryWith: 'היסטוריית משחקים עם',
    close: 'סגור',
    winrate: 'אחוז ניצחונות',
    wins: 'נצחונות', style: 'סגנון', 'all-court': 'מאוזן',
    // Chantier 3 — Anti-fraud & validation
    pendingMatches: 'תוצאות לאישור',
    toConfirm: 'לאישור',
    awaiting: 'בהמתנה',
    noPendingMatches: 'אין תוצאות לאישור',
    noPendingHint: 'תוצאות שיוגשו על ידי היריבים שלך יופיעו כאן.',
    scoreSubmittedByThem: 'הגיש תוצאה זו',
    waitingConfirmFrom: 'ממתין לאישור מאת',
    expiresIn: 'פג תוקף בעוד',
    youWon: 'ניצחת',
    youLost: 'הפסדת',
    draw: 'תיקו',
    opponent: 'יריב',
    confirm: 'אשר',
    reject: 'דחה',
    confirmReject: 'האם אתה בטוח שברצונך לדחות תוצאה זו?',
    error: 'שגיאה',
    submitScore: 'הגש תוצאה',
    selectOpponent: 'בחר יריב',
    noMatchesForSubmit: 'אין לך עדיין שותפי משחק. מצא אחד קודם.',
    finalScore: 'תוצאה סופית',
    submitForConfirmation: 'שלח לאישור',
    submitHint: 'ליריב שלך יהיו 72 שעות לאשר את התוצאה.',
    // Sprint 3-4
    scoreInputMode: 'הזן', liveMode: 'חי', textMode: 'טקסט',
    scoreInputPlaceholder: 'לדוגמה: 6-4 6-3', scoreInputHint: 'הפרד סטים ברווח',
    scoreInvalid: 'פורמט לא חוקי — לדוגמה: 6-4 6-3',
    photoRequired: 'הוסף תמונה כדי להמשיך',
    rateMatch: 'דרג משחק זה', skipEval: 'דלג',
    likesReceived: 'לייקים שהתקבלו', noLikesYet: 'אין עדיין לייקים',
    errorTitle: 'אירעה שגיאה', errorHint: 'טען מחדש את הדף.', reload: 'טען מחדש',
  },
};

// ─── CONSEILS DU JOUR ────────────────────────────────────────────────────────
// Rotation déterministe : index = floor(timestamp_ms / 86400000) % total
// → même conseil toute la journée, change à minuit UTC.
// Chaque conseil a une version FR / EN / HE.
export const DAILY_TIPS = [
  {
    fr: "En défense, mieux vaut un lob haut que de tenter le coup gagnant.",
    en: "On defense, a high lob is better than going for a risky winner.",
    he: "בהגנה, עדיף לוב גבוה מאשר לנסות מכת ניצחון מסוכנת.",
  },
  {
    fr: "Lisez les épaules de l'adversaire pour anticiper la direction de sa frappe.",
    en: "Read your opponent's shoulders to anticipate the direction of their shot.",
    he: "קראו את כתפי היריב כדי לחזות את כיוון המכה שלו.",
  },
  {
    fr: "Le saviez-vous ? 80 % des points se gagnent au filet.",
    en: "Did you know? 80% of points are won at the net.",
    he: "הידעתם? 80% מהנקודות מוכרעות ברשת.",
  },
  {
    fr: "En défense, lobez l'adversaire puis remontez au filet avec votre partenaire.",
    en: "On defense, lob your opponent then move up to the net with your partner.",
    he: "בהגנה, בצעו לוב על היריב ואז עלו לרשת יחד עם השותף שלכם.",
  },
  {
    fr: "Montez et descendez toujours en même temps que votre partenaire.",
    en: "Always move up and back at the same time as your partner.",
    he: "עלו וירדו תמיד יחד עם השותף שלכם.",
  },
  {
    fr: "Joueur de gauche : si la balle arrive au centre, privilégiez la vibora ; si elle arrive à gauche, la bandeja.",
    en: "Left-side player: if the ball comes to the middle, favor the vibora; if it comes to the left, the bandeja.",
    he: "שחקן צד שמאל: אם הכדור מגיע למרכז — העדיפו ויבורה; אם הוא מגיע לשמאל — בנדחה.",
  },
  {
    fr: "Le saviez-vous ? Il existe 3 formes de raquette : ronde, goutte d'eau et diamant.",
    en: "Did you know? There are 3 racket shapes: round, teardrop and diamond.",
    he: "הידעתם? קיימות שלוש צורות מחבט: עגול, טיפה ויהלום.",
  },
  {
    fr: "Les raquettes en diamant ont un sweet spot plus petit : idéales pour les joueurs intermédiaires / avancés.",
    en: "Diamond rackets have a smaller sweet spot — ideal for intermediate / advanced players.",
    he: "מחבטי יהלום בעלי נקודת פגיעה (sweet spot) קטנה יותר — אידיאליים לשחקנים בינוניים / מתקדמים.",
  },
];

/**
 * QUIZ D'ÉVALUATION DU NIVEAU
 *
 * Échelle de référence (calquée Playtomic) : 0.5 → 7.0
 *   0.5 – 1.5  Débutant
 *   1.5 – 3.5  Intermédiaire
 *   3.5 – 5.5  Avancé
 *   5.5 – 7.0  Expert / Pro
 *
 * Barème des réponses techniques (4 niveaux) :
 *   1.0 = Débutant   |   3.0 = Intermédiaire   |   5.5 = Avancé   |   7.0 = Expert compétition
 *
 * 10 questions tech | valeurs {1, 3, 5.5, 7} | moyenne pure
 * Q1 Bandeja · Q2 Sorties de vitre · Q3 Régularité · Q4 Vibora
 * Q5 Puissance · Q6 Lecture tactique · Q7 Placement · Q8 Mental
 * Q9 Précision balle · Q10 Smash par 3 / par 4
 */
export const QUIZ_QUESTIONS = [
  // ── Q1 · Technique : Bandeja ──────────────────────────────────────────────
  { id: 1, type: 'tech',
    q:     { fr: "Un smash au-dessus de la tête, frappé en douceur et sans grande puissance, juste pour garder ta position au filet — ce coup s'appelle la bandeja. À quelle fréquence le réussis-tu ?", en: "An overhead smash hit softly, without much power, just to keep your position at the net — this shot is called the bandeja. How often do you land it?", he: "סמאש מעל הראש, מוכה בעדינות וללא כוח רב, רק כדי לשמור על המיקום שלך ברשת — המכה הזו נקראת בנדחה. באיזו תדירות אתה מצליח אותה?" },
    qEval: { fr: "{name} arrive-t-il à frapper un smash au-dessus de la tête, en douceur et sans grande puissance, pour garder sa position au filet — la bandeja ?", en: "Can {name} hit an overhead smash softly, without much power, to keep their position at the net — the bandeja?", he: "האם {name} מצליח להכות סמאש מעל הראש, בעדינות וללא כוח רב, כדי לשמור על מיקומו ברשת — הבנדחה?" },
    options: [
      { fr: 'Rarement',              en: 'Rarely',                 he: 'לעיתים רחוקות', subFr: "Je découvre encore le geste.",                  subEn: "Still learning the shot.",                    subHe: 'עדיין לומד את התנועה.',             value: 1   },
      { fr: 'Occasionnellement',     en: 'Occasionally',           he: 'מדי פעם',       subFr: "Réussite une fois sur trois.",                  subEn: "About one in three.",                         subHe: 'הצלחה בכ-שליש מהמקרים.',           value: 3   },
      { fr: 'Souvent',               en: 'Often',                  he: 'לעיתים קרובות', subFr: "Coup de routine, placement correct.",           subEn: "Routine shot, decent placement.",             subHe: 'מכה שגרתית, מיקום סביר.',          value: 5.5 },
      { fr: 'Je la contrôle parfaitement', en: 'Perfect control', he: 'שליטה מושלמת',  subFr: "Direction et effet maîtrisés, fiable en match.", subEn: "Direction and spin mastered — reliable in matches.", subHe: 'שליטה בכיוון ובספין — אמינה במשחק.', value: 7 },
    ]},

  // ── Q2 · Technique : Sorties de vitre ────────────────────────────────────
  { id: 2, type: 'tech',
    q:     { fr: "Quand la balle passe au-dessus de toi et rebondit sur la vitre de ton camp, arrives-tu à la laisser revenir puis à la renvoyer proprement — ce qu'on appelle une sortie de vitre ?", en: "When the ball goes over you and bounces off the glass on your side, can you let it come back and return it cleanly — what's called a glass exit?", he: 'כשהכדור עובר מעליך ומקפץ מהזכוכית בצד שלך, אתה מצליח לתת לו לחזור ואז להחזיר אותו נקי — מה שנקרא יציאה מהקיר?' },
    qEval: { fr: "Quand la balle rebondit sur la vitre de son camp, {name} arrive à la laisser revenir et à la renvoyer proprement (sortie de vitre) ?", en: "When the ball bounces off the glass on their side, can {name} let it come back and return it cleanly (glass exit)?", he: 'כשהכדור מקפץ מהזכוכית בצד שלו, האם {name} מצליח לתת לו לחזור ולהחזיר אותו נקי (יציאה מהקיר)?' },
    options: [
      { fr: 'Pas encore',         en: 'Not yet',           he: 'עוד לא',         subFr: "Le mur me surprend.",                          subEn: "The wall catches me off-guard.",       subHe: 'הקיר מפתיע אותי.',                value: 1 },
      { fr: 'Lecture correcte',   en: 'Decent read',       he: 'קריאה סבירה',    subFr: "Je récupère la balle, sans précision.",        subEn: "I recover, without precision.",        subHe: 'מציל את הכדור, בלי דיוק.',        value: 3 },
      { fr: 'Sortie propre',      en: 'Clean exit',        he: 'יציאה נקייה',    subFr: "Je relance avec intention et placement.",      subEn: "I return with intent and placement.",  subHe: 'חזרה מכוונת עם מיקום.',           value: 5.5 },
      { fr: 'Double vitre maîtrisée', en: 'Double-glass mastered', he: 'שליטה בכפל קיר', subFr: "Je transforme double vitre en attaque — niveau compétition.", subEn: "I turn double-glass into attack — competition level.", subHe: 'הופך כפל קיר להתקפה — רמת תחרות.', value: 7 },
    ]},

  // ── Q3 · Technique : Fautes directes en échange de fond ──────────────────
  { id: 3, type: 'tech',
    q:     { fr: "Sur un échange de fond de court (5 frappes ou plus), à quelle fréquence perds-tu le point sur une faute directe, hors sortie de vitre ?", en: "In a baseline rally (5 shots or more), how often do you lose the point on a direct error, glass exits aside?", he: 'בחילוף מקו הבסיס (5 מכות או יותר), באיזו תדירות אתה מאבד את הנקודה בשגיאה ישירה, מלבד יציאות מהקיר?' },
    qEval: { fr: "Sur un échange de fond de court (5 frappes ou plus), à quelle fréquence {name} perd le point sur une faute directe, hors sortie de vitre ?", en: "In a baseline rally (5 shots or more), how often does {name} lose the point on a direct error, glass exits aside?", he: 'בחילוף מקו הבסיס (5 מכות או יותר), באיזו תדירות {name} מאבד את הנקודה בשגיאה ישירה, מלבד יציאות מהקיר?' },
    options: [
      { fr: "Souvent — l'échange se termine vite par ma faute",              en: "Often — the rally ends quickly on my error",                 he: 'לעיתים קרובות — החילוף נגמר מהר בשגיאה שלי',       subFr: "Le point m'échappe avant de le construire.",     subEn: "The point is lost before I build it.",            subHe: 'הנקודה אובדת לפני שאני בונה אותה.',          value: 1   },
      { fr: "De temps en temps, surtout si l'échange se prolonge",           en: "Now and then, especially in longer rallies",                 he: 'מדי פעם, בעיקר כשהחילוף מתארך',                   subFr: "Je tiens 4-5 frappes, puis je craque.",          subEn: "I hold 4-5 shots, then I crack.",                 subHe: 'אני מחזיק 4-5 מכות, ואז נשבר.',              value: 3   },
      { fr: "Rarement — je tiens l'échange jusqu'à créer une occasion",      en: "Rarely — I hold the rally until I create an opening",        he: 'לעיתים רחוקות — אני מחזיק עד שאני יוצר הזדמנות',   subFr: "Régularité fiable, même en match serré.",        subEn: "Reliable consistency, even in close matches.",    subHe: 'עקביות אמינה, גם במשחקים קרובים.',           value: 5.5 },
      { fr: "Quasiment jamais, même en fin de match sous pression",          en: "Almost never, even late in the match under pressure",        he: 'כמעט אף פעם, גם בסוף המשחק תחת לחץ',              subFr: "Niveau compétition — la fatigue et le score ne m'affectent pas.", subEn: "Competition level — fatigue and score don't affect me.", subHe: 'רמת תחרות — עייפות ותוצאה לא משפיעות עלי.', value: 7   },
    ]},

  // ── Q4 · Technique : Vibora ───────────────────────────────────────────────
  { id: 4, type: 'tech',
    q:     { fr: "Un smash frappé de côté, avec un effet coupé qui fait rebondir la balle bas et vite chez l'adversaire, presque impossible à rattraper — ce coup s'appelle la vibora. À quelle fréquence le réussis-tu ?", en: "A smash hit from the side, with a slice that makes the ball bounce low and fast on the opponent's side, nearly impossible to retrieve — this shot is called the vibora. How often do you land it?", he: 'סמאש מוכה מהצד, עם אפקט חתוך שגורם לכדור לקפוץ נמוך ומהר אצל היריב, כמעט בלתי אפשרי להחזרה — המכה הזו נקראת ויברה. באיזו תדירות אתה מצליח אותה?' },
    qEval: { fr: "{name} arrive-t-il à frapper un smash de côté avec un effet coupé qui fait rebondir la balle bas et vite chez l'adversaire — la vibora ?", en: "Can {name} hit a smash from the side with a slice that makes the ball bounce low and fast on the opponent's side — the vibora?", he: 'האם {name} מצליח להכות סמאש מהצד עם אפקט חתוך שגורם לכדור לקפוץ נמוך ומהר אצל היריב — הויברה?' },
    options: [
      { fr: 'Je ne la connais pas encore', en: "I don't know it yet",    he: 'עוד לא מכיר את המכה', subFr: "Coup découvert récemment.",                    subEn: "Just discovered the shot.",                  subHe: 'גיליתי את המכה לאחרונה.',             value: 1   },
      { fr: 'En apprentissage',            en: 'Still learning',          he: 'בשלב הלמידה',         subFr: "Résultat aléatoire, timing inconsistant.",    subEn: "Inconsistent timing, random results.",       subHe: 'תזמון לא עקבי, תוצאות אקראיות.',     value: 3   },
      { fr: 'Je la place avec intention',  en: 'I place it with intent',  he: 'משתמש בה בכוונה',    subFr: "Bonne exécution, placement correct.",         subEn: "Good execution, correct placement.",         subHe: 'ביצוע טוב, מיקום נכון.',              value: 5.5 },
      { fr: 'Maîtrise totale',             en: 'Total mastery',           he: 'שליטה מלאה',          subFr: "Vibora croisée ou à la ligne — au choix selon la situation.", subEn: "Cross or line vibora — chosen based on situation.", subHe: 'ויברה אלכסונית או קווית — לפי המצב.', value: 7 },
    ]},

  // ── Q5 · Technique : Accélération liftée ─────────────────────────────────
  { id: 5, type: 'tech',
    q:     { fr: "Quand l'occasion se présente, arrives-tu à accélérer une balle liftée (coup droit ou revers) sans la mettre dehors ou dans le filet ?", en: "When the chance comes, can you accelerate a topspin ball (forehand or backhand) without sending it out or into the net?", he: 'כשההזדמנות מגיעה, אתה מצליח להאיץ כדור עם טופספין (יד ימין או גב) בלי להוציא אותו או לתקוע אותו ברשת?' },
    qEval: { fr: "Quand l'occasion se présente, {name} arrive à accélérer une balle liftée (coup droit ou revers) sans la mettre dehors ou dans le filet ?", en: "When the chance comes, can {name} accelerate a topspin ball (forehand or backhand) without sending it out or into the net?", he: 'כשההזדמנות מגיעה, האם {name} מצליח להאיץ כדור עם טופספין (יד ימין או גב) בלי להוציא אותו או לתקוע אותו ברשת?' },
    options: [
      { fr: "Rarement — la balle part souvent dehors ou dans le filet",     en: "Rarely — the ball often goes out or into the net",          he: 'לעיתים רחוקות — הכדור לרוב יוצא או נתקע ברשת',     subFr: "La puissance n'est pas encore une arme.",        subEn: "Power is not yet a weapon.",                      subHe: 'כוח עדיין אינו נשק.',                        value: 1   },
      { fr: "Une fois sur deux, sans grande intention",                    en: "About half the time, without much intent",                  he: 'פעם בשתיים, ללא כוונה ברורה',                      subFr: "Ça part fort, mais sans contrôle du résultat.",   subEn: "It fires hard, but I don't control the outcome.", subHe: 'יוצא חזק, אבל בלי שליטה בתוצאה.',           value: 3   },
      { fr: "Régulièrement, avec effet et direction maîtrisés",            en: "Regularly, with spin and direction under control",          he: 'באופן קבוע, עם שליטה בספין ובכיוון',              subFr: "Je choisis quand accélérer.",                     subEn: "I choose when to accelerate.",                    subHe: 'אני בוחר מתי להאיץ.',                        value: 5.5 },
      { fr: "Presque systématiquement, avec puissance et précision",       en: "Almost every time, with power and precision",               he: 'כמעט תמיד, עם כוח ודיוק',                          subFr: "Puissance + précision + constance — niveau tournoi.", subEn: "Power + precision + consistency — tournament level.", subHe: 'כוח + דיוק + עקביות — רמת טורניר.',         value: 7   },
    ]},

  // ── Q6 · Technique : Anticipation du coup adverse ────────────────────────
  { id: 6, type: 'tech',
    q:     { fr: "Quand l'adversaire s'apprête à jouer depuis le fond (lob, contre-attaque, ou frappe faible), arrives-tu à anticiper lequel avant qu'il ne frappe, pour ajuster ta position ?", en: "When an opponent is about to play from the back (lob, counter-attack, or weak shot), can you read which one before they hit, so you can adjust your position?", he: 'כשהיריב עומד לשחק מהאחור (לוב, התקפת נגד, או מכה חלשה), אתה מצליח לצפות מה יבוא לפני המכה, כדי להתאים את המיקום שלך?' },
    qEval: { fr: "Quand l'adversaire s'apprête à jouer depuis le fond, {name} arrive à anticiper le coup avant la frappe, pour ajuster sa position ?", en: "When an opponent is about to play from the back, can {name} read the shot before it's hit, to adjust their position?", he: 'כשהיריב עומד לשחק מהאחור, האם {name} מצליח לצפות את המכה לפני הביצוע, כדי להתאים את מיקומו?' },
    options: [
      { fr: "Rarement — je réagis seulement après avoir vu le coup",        en: "Rarely — I react only after seeing the shot",               he: 'לעיתים רחוקות — אני מגיב רק אחרי שראיתי את המכה',   subFr: "Le coup est déjà parti quand je bouge.",         subEn: "The shot is already gone when I move.",           subHe: 'המכה כבר יצאה כשאני זז.',                    value: 1   },
      { fr: "Je devine parfois la zone, rarement le type de coup",          en: "I sometimes guess the zone, rarely the type of shot",       he: 'לפעמים מנחש את האזור, רק לעיתים את סוג המכה',      subFr: "Anticipation partielle, souvent en retard.",     subEn: "Partial anticipation, often too late.",           subHe: 'ציפייה חלקית, לרוב מאוחרת.',                 value: 3   },
      { fr: "Je lis correctement l'intention et j'ajuste ma position à temps", en: "I read the intent correctly and adjust my position in time", he: 'אני קורא נכון את הכוונה ומתאים את מיקומי בזמן',   subFr: "Bonne lecture, positionnement anticipé.",        subEn: "Good read, early positioning.",                   subHe: 'קריאה טובה, מיקום מוקדם.',                   value: 5.5 },
      { fr: "Je lis mon adversaire ET couvre mon partenaire en même temps", en: "I read my opponent AND cover my partner at the same time",  he: 'אני קורא את היריב וגם מכסה את השותף שלי בו-זמנית',  subFr: "Anticipation double — niveau tournoi.",          subEn: "Double anticipation — tournament level.",         subHe: 'ציפייה כפולה — רמת טורניר.',                 value: 7   },
    ]},

  // ── Q7 · Technique : Reprendre le filet après une défense ────────────────
  { id: 7, type: 'tech',
    q:     { fr: "Après avoir défendu un coup adverse (lob ou balle repoussée au fond), arrives-tu à reprendre ta place au filet plutôt que de rester bloqué au fond ?", en: "After defending an opponent's shot (a lob or a ball pushing you to the back), can you get back to the net rather than staying stuck at the back?", he: 'אחרי שהתגוננת ממכה של היריב (לוב או כדור שדחף אותך לאחור), אתה מצליח לחזור למקומך ברשת במקום להישאר תקוע מאחור?' },
    qEval: { fr: "Après avoir défendu un coup adverse, {name} arrive à reprendre sa place au filet plutôt que de rester bloqué au fond ?", en: "After defending an opponent's shot, can {name} get back to the net rather than staying stuck at the back?", he: 'אחרי שהתגונן ממכה של היריב, האם {name} מצליח לחזור למקומו ברשת במקום להישאר תקוע מאחור?' },
    options: [
      { fr: "Rarement — une fois repoussé au fond, j'y reste presque tout l'échange", en: "Rarely — once pushed back, I stay there most of the rally", he: 'לעיתים רחוקות — ברגע שנדחפתי לאחור, אני נשאר שם רוב החילוף', subFr: "Je me contente de renvoyer, sans chercher à remonter.", subEn: "I just return the ball, without trying to move up.", subHe: 'אני רק מחזיר, בלי לנסות להתקדם.',            value: 1   },
      { fr: "Parfois, si l'occasion est évidente",                          en: "Sometimes, when the opening is obvious",                     he: 'לפעמים, כשההזדמנות ברורה',                        subFr: "Je remonte quand la balle est facile, sinon je reste en retrait.", subEn: "I move up on easy balls, otherwise I hang back.", subHe: 'מתקדם בכדור קל, אחרת נשאר מאחור.',      value: 3   },
      { fr: "Régulièrement, dès que je récupère un coup jouable",           en: "Regularly, as soon as I get a playable ball",                he: 'באופן קבוע, ברגע שאני משיג כדור בר-משחק',          subFr: "Je cherche activement à reprendre le filet après avoir défendu.", subEn: "I actively look to retake the net after defending.", subHe: 'אני מחפש באופן פעיל לחזור לרשת אחרי הגנה.', value: 5.5 },
      { fr: "Presque systématiquement, même après une défense difficile",   en: "Almost every time, even after a tough defensive shot",       he: 'כמעט תמיד, גם אחרי הגנה קשה',                     subFr: "Transition défense-attaque maîtrisée — niveau tournoi.", subEn: "Defence-to-attack transition mastered — tournament level.", subHe: 'מעבר מהגנה להתקפה בשליטה — רמת טורניר.', value: 7   },
    ]},

  // ── Q8 · Technique : Service sur point d'or ──────────────────────────────
  { id: 8, type: 'tech',
    q:     { fr: "Sur un point d'or (40-40) ou une balle de match, que se passe-t-il sur ton service ?", en: "On a golden point (40-40) or a match point, what happens to your serve?", he: 'בנקודת זהב (40-40) או בנקודת משחק, מה קורה להגשה שלך?' },
    qEval: { fr: "Sur un point d'or (40-40) ou une balle de match, que se passe-t-il sur le service de {name} ?", en: "On a golden point (40-40) or a match point, what happens to {name}'s serve?", he: 'בנקודת זהב (40-40) או בנקודת משחק, מה קורה להגשה של {name}?' },
    options: [
      { fr: "Je rate souvent mon service (dans le filet ou hors carré)",    en: "I often miss my serve (into the net or outside the box)",    he: 'אני לרוב מפספס את ההגשה (ברשת או מחוץ למשבצת)',    subFr: "La pression fait sortir le mauvais geste.",      subEn: "Pressure brings out the wrong motion.",           subHe: 'הלחץ מוציא את התנועה הלא נכונה.',            value: 1   },
      { fr: "Je sers, mais plus faible et plus prévisible que d'habitude", en: "I get it in, but weaker and more predictable than usual",    he: 'אני מגיש, אבל חלש וצפוי יותר מהרגיל',             subFr: "Je sécurise trop, l'adversaire l'attend.",       subEn: "I play it too safe, the opponent expects it.",    subHe: 'אני משחק בטוח מדי, היריב מצפה לזה.',        value: 3   },
      { fr: "Je garde mon service habituel, sans changement",              en: "I keep my usual serve, no change",                          he: 'אני שומר על ההגשה הרגילה שלי, ללא שינוי',         subFr: "Sang-froid, pas de panique sur le geste.",       subEn: "Composed, no panic in the motion.",               subHe: 'קור רוח, ללא פאניקה בתנועה.',                value: 5.5 },
      { fr: "Je sers encore plus précisément que d'habitude",              en: "I serve even more precisely than usual",                    he: 'אני מגיש בדיוק גדול אף יותר מהרגיל',              subFr: "Les points importants font ressortir le meilleur de moi — niveau compétition.", subEn: "Big points bring out my best — competition level.", subHe: 'נקודות גדולות מוציאות ממני את הטוב ביותר — רמת תחרות.', value: 7   },
    ]},

  // ── Q9 · Technique : Chiquita ────────────────────────────────────────────
  { id: 9, type: 'tech',
    q:     { fr: "Arrives-tu à jouer une balle lente et basse qui plonge dans les pieds de l'adversaire au filet, pour l'empêcher de smasher — ce coup s'appelle la chiquita ?", en: "Can you play a slow, low ball that drops at the feet of the opponent at the net, to stop them smashing — this shot is called the chiquita?", he: 'אתה מצליח לשחק כדור איטי ונמוך שצונח לרגלי היריב ברשת, כדי למנוע ממנו לסמש — המכה הזו נקראת צ׳יקיטה?' },
    qEval: { fr: "{name} arrive à jouer une balle lente et basse dans les pieds de l'adversaire au filet (la chiquita) pour l'empêcher de smasher ?", en: "Can {name} play a slow, low ball at the feet of the opponent at the net (the chiquita) to stop them smashing?", he: 'האם {name} מצליח לשחק כדור איטי ונמוך לרגלי היריב ברשת (הצ׳יקיטה) כדי למנוע ממנו לסמש?' },
    options: [
      { fr: "Rarement — ma balle reste souvent haute, facile à smasher",    en: "Rarely — my ball often stays high, easy to smash",          he: 'לעיתים רחוקות — הכדור שלי לרוב נשאר גבוה, קל לסמש', subFr: "Je ne connais pas encore ce coup.",             subEn: "I don't know this shot yet.",                     subHe: 'אני עדיין לא מכיר את המכה הזו.',             value: 1   },
      { fr: "Parfois, mais sans grande précision sur les pieds",           en: "Sometimes, but without much precision at the feet",         he: 'לפעמים, אבל ללא דיוק רב אל הרגליים',              subFr: "L'intention est là, l'exécution manque de régularité.", subEn: "The intent is there, the execution isn't consistent.", subHe: 'הכוונה קיימת, הביצוע לא עקבי.',        value: 3   },
      { fr: "Régulièrement, ça oblige l'adversaire à remonter la balle",   en: "Regularly, it forces the opponent to lift the ball",        he: 'באופן קבוע, זה מאלץ את היריב להרים את הכדור',      subFr: "Coup tactique fiable.",                          subEn: "Reliable tactical shot.",                         subHe: 'מכה טקטית אמינה.',                           value: 5.5 },
      { fr: "Presque à volonté, même sous pression",                       en: "Almost at will, even under pressure",                       he: 'כמעט כרצוני, גם תחת לחץ',                         subFr: "Coup tactique maîtrisé — niveau tournoi.",       subEn: "Tactical shot mastered — tournament level.",      subHe: 'מכה טקטית בשליטה — רמת טורניר.',            value: 7   },
    ]},

  // ── Q10 · Général : Smash par 3 / par 4 ─────────────────────────────────
  { id: 10, type: 'tech',
    q:     { fr: "Arrives-tu à smasher assez fort pour que la balle rebondisse et sorte du terrain, par-dessus le grillage du côté (on appelle ça un par 3) ou par-dessus la vitre du fond (un par 4) ?", en: "Can you smash hard enough for the ball to bounce and exit the court, over the side fence (called a par 3) or over the back glass (a par 4)?", he: 'אתה מצליח לסמש חזק מספיק כדי שהכדור יקפוץ ויצא מהמגרש, מעל הגדר בצד (נקרא פר 3) או מעל הזכוכית מאחור (פר 4)?' },
    qEval: { fr: "{name} arrive à smasher assez fort pour faire sortir la balle du terrain, par le côté (par 3) ou par le fond (par 4) ?", en: "Can {name} smash hard enough to make the ball exit the court, by the side (par 3) or the back (par 4)?", he: 'האם {name} מצליח לסמש חזק מספיק כדי להוציא את הכדור מהמגרש, מהצד (פר 3) או מאחור (פר 4)?' },
    options: [
      { fr: 'Je ne smache pas encore',                        en: "I can't smash yet",                           he: 'עדיין לא מבצע סמאש',                    subFr: "Le smash est encore difficile à exécuter.",        subEn: "The smash is still difficult to execute.",          subHe: 'הסמאש עדיין קשה לביצוע.',             value: 1   },
      { fr: 'Parfois la balle sort du fond',                  en: 'Sometimes the ball exits at the back',        he: 'לפעמים הכדור יוצא מהאחור',              subFr: "La balle sort du terrain, mais sans intention.",   subEn: "The ball exits, but without real intention.",       subHe: 'הכדור יוצא מהמגרש, אך ללא כוונה.',    value: 3   },
      { fr: 'Je réussis régulièrement un par 3',              en: 'I regularly pull off a par 3',                he: 'אני מבצע בהצלחה פר 3 באופן קבוע',       subFr: "Smash latéral contrôlé — la balle sort du côté.",  subEn: "Controlled side smash — the ball exits the side.",  subHe: 'סמאש צידי מבוקר — הכדור יוצא מהצד.', value: 5.5 },
      { fr: 'Par 3 et par 4 au choix selon la situation',    en: 'Par 3 or par 4, I choose based on situation',  he: 'פר 3 או פר 4, אני בוחר לפי המצב',       subFr: "Je choisis la sortie — côté ou fond — avec intention.", subEn: "I choose the exit — side or back — with full intent.", subHe: 'אני בוחר יציאה — צד או אחור — עם כוונה מלאה.', value: 7   },
    ]},

  // ══════════════════════════════════════════════════════════════════════════
  // ANCRES OBJECTIVES (auto-évaluation uniquement — `selfOnly`).
  // Exclues du mode « évaluer un partenaire » (on ne connaît pas l'ancienneté
  // ni la fréquence de quelqu'un d'autre). Pondérées plus fort que la technique
  // car ce sont des faits, plus difficiles à sur-estimer que l'auto-jugement.
  // ══════════════════════════════════════════════════════════════════════════

  // ── Q11 · Ancre : Ancienneté ──────────────────────────────────────────────
  { id: 11, type: 'anchor', selfOnly: true, weight: 2,
    q: { fr: "Depuis combien de temps joues-tu au padel ?", en: "How long have you been playing padel?", he: "כמה זמן אתה משחק פאדל?" },
    options: [
      { fr: 'Moins de 6 mois',            en: 'Less than 6 months',     he: 'פחות מ-6 חודשים',  subFr: "Je débute.",                          subEn: "I'm just starting.",                  subHe: 'אני רק מתחיל.',                  value: 1   },
      { fr: '6 mois à 2 ans',             en: '6 months to 2 years',    he: '6 חודשים עד שנתיים', subFr: "Je construis mes bases.",             subEn: "Building my foundations.",            subHe: 'בונה את הבסיס.',                 value: 3   },
      { fr: '2 à 5 ans',                  en: '2 to 5 years',           he: '2 עד 5 שנים',       subFr: "Pratique installée.",                 subEn: "Well-established practice.",          subHe: 'תרגול מבוסס.',                   value: 5   },
      { fr: 'Plus de 5 ans, régulièrement', en: 'Over 5 years, regularly', he: 'מעל 5 שנים, באופן קבוע', subFr: "Joueur de longue date.",          subEn: "Long-time player.",                   subHe: 'שחקן ותיק.',                     value: 7   },
    ]},

  // ── Q12 · Ancre : Fréquence de jeu ────────────────────────────────────────
  { id: 12, type: 'anchor', selfOnly: true, weight: 1,
    q: { fr: "À quelle fréquence joues-tu en ce moment ?", en: "How often do you play right now?", he: "באיזו תדירות אתה משחק כעת?" },
    options: [
      { fr: 'Rarement (quelques fois par an)', en: 'Rarely (a few times a year)', he: 'לעיתים רחוקות (כמה פעמים בשנה)', subFr: "Jeu occasionnel.",            subEn: "Occasional play.",            subHe: 'משחק מזדמן.',          value: 1.5 },
      { fr: '1 fois par semaine ou moins',     en: 'Once a week or less',          he: 'פעם בשבוע או פחות',           subFr: "Rythme léger.",               subEn: "Light pace.",                 subHe: 'קצב קל.',              value: 3   },
      { fr: '2 à 3 fois par semaine',          en: '2 to 3 times a week',          he: '2 עד 3 פעמים בשבוע',          subFr: "Joueur régulier.",            subEn: "Regular player.",             subHe: 'שחקן קבוע.',           value: 4.5 },
      { fr: '4 fois ou plus par semaine',      en: '4+ times a week',              he: '4 פעמים או יותר בשבוע',       subFr: "Pratique intensive.",         subEn: "Intensive practice.",         subHe: 'תרגול אינטנסיבי.',     value: 6.5 },
    ]},

  // ── Q13 · Ancre : Niveau / compétition ────────────────────────────────────
  { id: 13, type: 'anchor', selfOnly: true, weight: 2,
    q: { fr: "À quel niveau de jeu te situes-tu ?", en: "Where do you place your level of play?", he: "באיזו רמת משחק אתה ממקם את עצמך?" },
    options: [
      { fr: 'Je débute, je joue pour apprendre',          en: "Beginner, I play to learn",                 he: 'מתחיל, משחק כדי ללמוד',         subFr: "Phase d'apprentissage.",            subEn: "Learning phase.",                  subHe: 'שלב למידה.',                value: 1.5 },
      { fr: 'Loisir : je joue entre amis, sans compétition', en: "Casual: friendly games, no competition", he: 'פנאי: משחק עם חברים, ללא תחרות', subFr: "Bon niveau loisir.",               subEn: "Solid casual level.",              subHe: 'רמת פנאי טובה.',            value: 3.5 },
      { fr: 'Je gagne souvent en loisir / petits tournois', en: "I often win casual / small tournaments",  he: 'מנצח לעיתים קרובות בפנאי / טורנירים קטנים', subFr: "Au-dessus du loisir moyen.", subEn: "Above average casual.",        subHe: 'מעל ממוצע הפנאי.',         value: 5   },
      { fr: 'Je joue en compétition officielle (tournois classés)', en: "I play official competition (ranked tournaments)", he: 'משחק בתחרות רשמית (טורנירים מדורגים)', subFr: "Niveau compétiteur.",  subEn: "Competitor level.",            subHe: 'רמת מתחרה.',               value: 7   },
    ]},
];

/**
 * GLOSSARY — Définitions des termes techniques du padel
 * Utilisé dans ScoreScreen pour afficher un tooltip au clic sur le terme.
 * Chaque entrée : { term: {fr, en, he}, def: {fr, en, he} }
 */
export const GLOSSARY = [
  {
    key: 'bandeja',
    term: { fr: 'bandeja', en: 'bandeja', he: 'בנדחה' },
    def: {
      fr: "Coup en hauteur joué depuis le côté, avec effet lifté. La balle retombe profonde dans le terrain adverse. L'un des coups signatures du padel, entre smash et lob.",
      en: "An overhead shot played from the side with topspin. The ball lands deep in the opponent's court — one of padel's signature shots, between a smash and a lob.",
      he: "מכה גבוהה מהצד עם ספין. הכדור נוחת עמוק בשדה היריב — אחד המהלכים האופייניים לפאדל.",
    },
  },
  {
    key: 'vibora',
    term: { fr: 'vibora', en: 'vibora', he: 'ויברה' },
    def: {
      fr: "Smash latéral puissant avec un mouvement en serpentine (\"víbora\" = serpent en espagnol). Génère une balle rapide et basse très difficile à rattraper. Arme offensive avancée.",
      en: "A powerful lateral smash with a snake-like swing (\"víbora\" = snake in Spanish). Generates a fast, low ball that's very hard to return. Advanced offensive weapon.",
      he: "סמאש צידי עוצמתי עם תנועה מתפתלת ('ויברה' = נחש בספרדית). מייצר כדור מהיר ונמוך שקשה מאוד להחזיר.",
    },
  },
  {
    key: 'sortie de vitre',
    term: { fr: 'sortie de vitre', en: 'glass exit', he: 'יציאת קיר' },
    def: {
      fr: "Coup joué après que la balle rebondit sur la vitre de fond ou de côté. Technique-clé du padel : il faut anticiper le rebond, reculer, et relancer avec intention.",
      en: "A shot played after the ball bounces off the back or side glass. Key padel skill: you must anticipate the rebound, step back, and play with intent.",
      he: "מכה שמשחקים אחרי שהכדור קפץ מהזכוכית האחורית או הצידית. מיומנות מפתח בפאדל.",
    },
  },
  {
    key: 'double vitre',
    term: { fr: 'double vitre', en: 'double glass', he: 'כפל קיר' },
    def: {
      fr: "Balle qui rebondit sur deux vitres consécutivement (fond puis côté, ou l'inverse). Très difficile à lire car la trajectoire change deux fois.",
      en: "A ball that bounces off two glass walls consecutively (back then side, or vice versa). Very hard to read because the trajectory changes twice.",
      he: "כדור שקופץ משתי זכוכיות ברצף. קשה מאוד לקריאה כי המסלול משתנה פעמיים.",
    },
  },
  {
    key: 'par 3',
    term: { fr: 'par 3', en: 'par 3', he: 'פר 3' },
    def: {
      fr: "Smash où la balle sort du terrain par le côté, au-dessus du grillage latéral (3 m de haut). Joué avec effet lifté pour faire \"kiquer\" la balle vers l'extérieur après rebond.",
      en: "A smash where the ball exits through the side fence (3 m high). Played with topspin to make the ball \"kick\" sideways after bouncing.",
      he: "סמאש שבו הכדור יוצא דרך הגדר הצידית (גובה 3 מ'). מבוצע עם ספין לפנים כדי שהכדור 'יקפוץ' הצידה אחרי הנחיתה.",
    },
  },
  {
    key: 'par 4',
    term: { fr: 'par 4', en: 'par 4', he: 'פר 4' },
    def: {
      fr: "Smash plat et puissant où la balle sort par le fond du terrain, au-dessus de la vitre arrière (4 m). Le coup le plus difficile et le plus spectaculaire du padel.",
      en: "A flat, powerful smash where the ball exits through the back glass (4 m). The hardest and most spectacular shot in padel.",
      he: "סמאש שטוח ועוצמתי שבו הכדור יוצא דרך הזכוכית האחורית (4 מ'). המכה הקשה והמרשימה ביותר בפאדל.",
    },
  },
];

/**
 * computeLevel — Calcul du niveau Playtomic (0.5 – 7.0)
 * ════════════════════════════════════════════════════════════════
 *
 * ÉCHELLE DE RÉFÉRENCE
 *   0.5 – 1.5  Débutant
 *   1.5 – 3.5  Intermédiaire
 *   3.5 – 5.5  Avancé
 *   5.5 – 7.0  Expert / Compétition
 *
 * QUESTIONS
 *   • 10 questions TECHNIQUES (type:'tech') — auto/peer-éval, poids 1.
 *   • 3 ANCRES OBJECTIVES (type:'anchor', selfOnly) — ancienneté (poids 2),
 *     fréquence (poids 1), niveau/compétition (poids 2). Présentes uniquement
 *     en AUTO-évaluation ; en peer-éval seules les 10 techniques comptent.
 *
 * FORMULE : moyenne PONDÉRÉE des réponses (chaque option a une `value` sur la
 *   même échelle 0.5–7 ; `weight` par défaut = 1).
 *     Score = Σ(value × weight) / Σ(weight) → arrondi 1 déc. → clamp [0.5, 7.0]
 *
 * VÉRIFICATIONS (poids : 10 tech ×1 + ancres ancienneté ×2, fréquence ×1, niveau ×2 = 15)
 *   Peer-éval : 10 tech × 7   / 10                   = 7.0   ✓ (ancres absentes)
 *   Auto MAX  : (10×7 + 7×2 + 6.5×1 + 7×2) / 15 ≈ 6.97 → 7.0 ✓
 *   Débutant honnête : tech 1 + ancres bas → ~1.2  ✓
 *
 * CAS SKIP : retourne null — ne jamais inventer de valeur par défaut.
 */
export function computeLevel(answers) {
  if (!answers || Object.keys(answers).length === 0) return null;

  let sum = 0, wsum = 0;

  QUIZ_QUESTIONS.forEach(q => {
    const v = answers[q.id];
    if (v == null) return;            // question non répondue (ex. ancres en peer-éval)
    const w = q.weight ?? 1;          // technique = 1 ; ancres pondérées
    sum  += v * w;
    wsum += w;
  });

  // Aucune réponse → pas de niveau attribué
  if (wsum === 0) return null;

  const raw = sum / wsum;

  // Arrondi à 1 décimale, clamp [0.5, 7.0]
  const finalScore = Math.round(raw * 10) / 10;
  return Math.max(0.5, Math.min(7.0, finalScore));
}

// ─── Percentile top joueurs ───────────────────────────────────────────────────
// Basé sur une distribution typique de joueurs de padel.
// Retourne "Top X%" de joueurs que le joueur dépasse.
export function levelToTopPercent(level) {
  const table = [
    [7.0, 2], [6.5, 4], [6.0, 7], [5.5, 12],
    [5.0, 18], [4.5, 28], [4.0, 40], [3.5, 55],
    [3.0, 68], [2.5, 78], [2.0, 86], [1.5, 93],
    [1.0, 97], [0.5, 100],
  ];
  for (const [lvl, pct] of table) {
    if (level >= lvl) return pct;
  }
  return 100;
}

// ─── Résumé de niveau personnalisé ───────────────────────────────────────────
// Génère 2 phrases basées sur les réponses RÉELLES au quiz.
// Déterministe : les mêmes réponses → le même texte toujours.
export function generateLevelSummary(answers, lang) {
  if (!answers || Object.keys(answers).length === 0) return null;
  const l = lang === 'en' ? 'en' : lang === 'he' ? 'he' : 'fr';

  // Phrases par question × valeur (fr/en/he)
  const PHRASES = {
    // Q1 — Bandeja
    1: {
      1:   { fr: "tu découvres encore les coups hauts comme la bandeja",                    en: "you're still discovering overhead shots like the bandeja",               he: "אתה עדיין מגלה מכות גבוהות כמו הבנדחה" },
      3:   { fr: "ta bandeja se construit progressivement",                                  en: "your bandeja is gradually improving",                                   he: "הבנדחה שלך מתפתחת בהדרגה" },
      5.5: { fr: "ta bandeja est un coup de routine fiable en match",                        en: "your bandeja is a reliable routine shot in matches",                    he: "הבנדחה שלך היא מכה אמינה במשחקים" },
      7:   { fr: "ta bandeja est parfaitement maîtrisée — direction et effet au choix",      en: "your bandeja is fully mastered — direction and spin at will",           he: "הבנדחה שלך שלוטה לחלוטין — כיוון וספין לפי הרצון" },
    },
    // Q2 — Sorties de vitre
    2: {
      1:   { fr: "les rebonds de vitre te surprennent encore",                               en: "wall rebounds still catch you off guard",                               he: "ניתוזי קיר עדיין מפתיעים אותך" },
      3:   { fr: "tu récupères les balles de vitre sans grande précision",                   en: "you retrieve wall balls without much precision",                        he: "אתה מציל כדורי קיר ללא דיוק רב" },
      5.5: { fr: "tu relances proprement depuis les vitres avec intention",                  en: "you cleanly replay from the walls with intent",                         he: "אתה מחזיר נקי מהקירות עם כוונה" },
      7:   { fr: "tu transformes les doubles vitres en situations d'attaque",                en: "you turn double-wall shots into attacking opportunities",                he: "אתה הופך כפל-קיר להזדמנויות התקפה" },
    },
    // Q3 — Fautes directes en échange de fond
    3: {
      1:   { fr: "tes échanges de fond se terminent encore vite sur une faute directe",     en: "your baseline rallies still end quickly on a direct error",             he: "החילופים שלך מהאחור עדיין נגמרים מהר בשגיאה ישירה" },
      3:   { fr: "tu tiens quatre à cinq frappes avant de craquer sur les échanges longs",  en: "you hold four or five shots before cracking in longer rallies",         he: "אתה מחזיק ארבע-חמש מכות לפני שנשבר בחילופים ארוכים" },
      5.5: { fr: "tu tiens l'échange de fond jusqu'à créer ton occasion",                    en: "you hold the baseline rally until you create your opening",             he: "אתה מחזיק את החילוף מהאחור עד שאתה יוצר הזדמנות" },
      7:   { fr: "tu ne cèdes quasiment jamais sur une faute directe, même en fin de match", en: "you almost never give away a direct error, even late in the match",     he: "אתה כמעט אף פעם לא מוסר שגיאה ישירה, גם בסוף המשחק" },
    },
    // Q4 — Vibora
    4: {
      1:   { fr: "la vibora est encore un coup à découvrir",                                  en: "the vibora is still a shot to discover",                               he: "הויברה היא עדיין מכה לגלות" },
      3:   { fr: "ta vibora est en apprentissage, le timing n'est pas encore constant",       en: "your vibora is in progress, timing is still inconsistent",             he: "הויברה שלך בלמידה, התזמון עדיין לא עקבי" },
      5.5: { fr: "tu places ta vibora avec intention — exécution et direction maîtrisées",    en: "you place your vibora with intent — execution and direction mastered",  he: "אתה ממקם את הויברה בכוונה — ביצוע וכיוון נשלטים" },
      7:   { fr: "ta vibora — croisée ou à la ligne — est une vraie arme offensive",          en: "your vibora — cross or line — is a genuine offensive weapon",          he: "הויברה שלך — אלכסונית או קווית — היא נשק התקפי אמיתי" },
    },
    // Q5 — Accélération liftée
    5: {
      1:   { fr: "tes accélérations liftées partent encore souvent dehors ou dans le filet",  en: "your topspin drives still often go out or into the net",               he: "ההאצות שלך עם טופספין עדיין לרוב יוצאות או נתקעות ברשת" },
      3:   { fr: "tu accélères une fois sur deux, sans contrôler le résultat",                 en: "you accelerate about half the time, without controlling the outcome",  he: "אתה מאיץ פעם בשתיים, בלי לשלוט בתוצאה" },
      5.5: { fr: "tu choisis quand accélérer — effet et direction maîtrisés",                  en: "you choose when to accelerate — spin and direction under control",     he: "אתה בוחר מתי להאיץ — שליטה בספין ובכיוון" },
      7:   { fr: "tu accélères presque à volonté, avec puissance et précision",                en: "you accelerate almost at will, with power and precision",              he: "אתה מאיץ כמעט כרצונך, עם כוח ודיוק" },
    },
    // Q6 — Anticipation du coup adverse
    6: {
      1:   { fr: "tu ne réagis encore qu'une fois le coup adverse parti",                     en: "you still react only once the opponent's shot is gone",                he: "אתה עדיין מגיב רק אחרי שהמכה של היריב יצאה" },
      3:   { fr: "tu devines parfois la zone, rarement le type de coup adverse",               en: "you sometimes guess the zone, rarely the type of shot",                he: "אתה לפעמים מנחש את האזור, רק לעיתים את סוג המכה" },
      5.5: { fr: "tu lis l'intention adverse et ajustes ta position à temps",                  en: "you read the opponent's intent and adjust your position in time",      he: "אתה קורא את כוונת היריב ומתאים את מיקומך בזמן" },
      7:   { fr: "tu lis l'adversaire tout en couvrant ton partenaire — niveau tournoi",       en: "you read the opponent while covering your partner — tournament level", he: "אתה קורא את היריב תוך כדי כיסוי השותף — רמת טורניר" },
    },
    // Q7 — Reprendre le filet après une défense
    7: {
      1:   { fr: "une fois repoussé au fond, tu y restes presque tout l'échange",             en: "once pushed to the back, you stay there for most of the rally",        he: "ברגע שנדחפת לאחור, אתה נשאר שם רוב החילוף" },
      3:   { fr: "tu remontes au filet quand la balle est facile, sinon tu restes en retrait", en: "you move up to the net on easy balls, otherwise you hang back",       he: "אתה מתקדם לרשת בכדור קל, אחרת נשאר מאחור" },
      5.5: { fr: "tu cherches activement à reprendre le filet après avoir défendu",           en: "you actively look to retake the net after defending",                  he: "אתה מחפש באופן פעיל לחזור לרשת אחרי הגנה" },
      7:   { fr: "ta transition défense-attaque est maîtrisée — niveau tournoi",              en: "your defence-to-attack transition is mastered — tournament level",     he: "המעבר שלך מהגנה להתקפה בשליטה — רמת טורניר" },
    },
    // Q8 — Service sur point d'or
    8: {
      1:   { fr: "ton service lâche encore sur les points d'or et les balles de match",       en: "your serve still breaks down on golden points and match points",       he: "ההגשה שלך עדיין נשברת בנקודות זהב ובנקודות משחק" },
      3:   { fr: "tu sécurises ton service sur les points importants, au prix de l'agressivité", en: "you play your serve safe on big points, at the cost of aggression",  he: "אתה משחק בטוח בהגשה בנקודות גדולות, על חשבון האגרסיביות" },
      5.5: { fr: "tu gardes ton service habituel sur les points décisifs",                     en: "you keep your usual serve on decisive points",                        he: "אתה שומר על ההגשה הרגילה שלך בנקודות מכריעות" },
      7:   { fr: "ton service devient encore plus précis sur les points d'or — niveau compétition", en: "your serve gets even sharper on golden points — competition level", he: "ההגשה שלך נעשית מדויקת אף יותר בנקודות זהב — רמת תחרות" },
    },
    // Q9 — Chiquita
    9: {
      1:   { fr: "ta balle reste encore haute au filet, facile à smasher pour l'adversaire",  en: "your ball still sits high at the net, easy for the opponent to smash", he: "הכדור שלך עדיין נשאר גבוה ברשת, קל ליריב לסמש" },
      3:   { fr: "ta chiquita part avec la bonne intention, sans encore trouver les pieds",   en: "your chiquita has the right intent, but doesn't find the feet yet",    he: "לצ׳יקיטה שלך יש את הכוונה הנכונה, אך היא עדיין לא מוצאת את הרגליים" },
      5.5: { fr: "ta chiquita oblige régulièrement l'adversaire à remonter la balle",         en: "your chiquita regularly forces the opponent to lift the ball",         he: "הצ׳יקיטה שלך מאלצת באופן קבוע את היריב להרים את הכדור" },
      7:   { fr: "tu sors ta chiquita presque à volonté, même sous pression — niveau tournoi", en: "you produce your chiquita almost at will, even under pressure — tournament level", he: "אתה מוציא את הצ׳יקיטה שלך כמעט כרצונך, גם תחת לחץ — רמת טורניר" },
    },
    // Q10 — Smash
    10: {
      1:   { fr: "le smash est encore difficile à exécuter pour toi",                         en: "the smash is still difficult to execute",                               he: "הסמאש עדיין קשה לביצוע עבורך" },
      3:   { fr: "la balle sort parfois du terrain, encore sans vraie intention",             en: "the ball exits sometimes but without real intent",                     he: "הכדור יוצא לפעמים אך ללא כוונה אמיתית" },
      5.5: { fr: "ton par 3 sort régulièrement — smash latéral contrôlé",                    en: "your par 3 exits consistently — controlled lateral smash",             he: "הפר 3 שלך יוצא בהתמדה — סמאש צידי מבוקר" },
      7:   { fr: "tu choisis entre par 3 et par 4 selon la situation — smash de compétition", en: "you choose par 3 or par 4 by situation — competition-level smash",   he: "אתה בוחר פר 3 או פר 4 לפי המצב — סמאש תחרותי" },
    },
  };

  const INTRO = {
    fr: {
      high:  "Joueur expérimenté,",
      mid:   "Joueur intermédiaire avancé,",
      low:   "En progression,",
      begin: "En phase d'apprentissage,",
    },
    en: {
      high:  "Experienced player,",
      mid:   "Advanced intermediate player,",
      low:   "On the rise,",
      begin: "In the learning phase,",
    },
    he: {
      high:  "שחקן מנוסה,",
      mid:   "שחקן ביניים מתקדם,",
      low:   "בהתפתחות,",
      begin: "בשלב הלמידה,",
    },
  };

  const CONNECTOR = {
    fr: { and: " et ", but: ". À travailler : ", develop: ". Ton prochain cap : " },
    en: { and: " and ", but: ". To work on: ", develop: ". Your next step: " },
    he: { and: " ו", but: ". לעבוד על: ", develop: ". האתגר הבא שלך: " },
  };

  // Collect answered questions with their values.
  // Restreint aux questions ayant une PHRASE descriptive (technique 1–10) :
  // les ancres objectives (ancienneté, fréquence, niveau) ne décrivent pas un
  // « point fort/faible » de jeu et n'ont pas de phrase.
  const answered = QUIZ_QUESTIONS
    .filter(q => answers[q.id] != null && PHRASES[q.id])
    .map(q => ({ id: q.id, val: answers[q.id] }));

  if (answered.length === 0) return null;

  const sorted = [...answered].sort((a, b) => b.val - a.val);
  const avg = answered.reduce((s, q) => s + q.val, 0) / answered.length;

  const topQ    = sorted[0];
  const secondQ = sorted[1] && sorted[1].val >= sorted[0].val - 0.5 ? sorted[1] : null;
  const weakQ   = sorted[sorted.length - 1];

  const intro = INTRO[l];
  const conn  = CONNECTOR[l];

  const introKey = avg >= 5.5 ? 'high' : avg >= 3.5 ? 'mid' : avg >= 2 ? 'low' : 'begin';

  const strongPhrase = PHRASES[topQ.id]?.[topQ.val]?.[l] ?? '';
  const weakPhrase   = PHRASES[weakQ.id]?.[weakQ.val]?.[l] ?? '';

  // Sentence 1 : intro + strength + optional 2nd strength
  let s1 = `${intro[introKey]} ${strongPhrase}`;
  if (secondQ && secondQ.id !== topQ.id && secondQ.val >= 5.5) {
    const s2phrase = PHRASES[secondQ.id]?.[secondQ.val]?.[l] ?? '';
    if (s2phrase) s1 += `${conn.and}${s2phrase}`;
  }
  s1 = s1.charAt(0).toUpperCase() + s1.slice(1) + '.';

  // Sentence 2 : weakness / next step
  let s2 = '';
  if (weakQ.val < 5.5) {
    const connector = avg >= 5 ? conn.develop : conn.but;
    s2 = `${connector.trim().replace(/^./, c => c.toUpperCase())} ${weakPhrase}.`;
  }

  return { sentence1: s1, sentence2: s2 };
}

// ELO simple: +/- selon résultat et différence de niveau
export function computeELODelta(myLevel, theirLevel, result) {
  const expected = 1 / (1 + Math.pow(10, (theirLevel - myLevel) / 2));
  const actual = result === 'win' ? 1 : 0;
  const K = 0.3;
  return +((K * (actual - expected)).toFixed(2));
}
