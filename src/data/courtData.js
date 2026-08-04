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
// Conversion de la valeur brute d'un curseur (Groupe 1 « ressenti », 1-10)
// vers l'échelle de niveau 0.5-7.0 utilisée par computeLevel. Appliquée AVANT
// computeLevel (au moment où le composant construit `answers`), jamais dedans :
// computeLevel reste agnostique de la provenance de la valeur (option ou curseur).
//
// Courbe convexe (exposant 1.8), pas une droite : un 6-7/10 honnête (le gros
// de la confiance déclarée par un amateur) doit peser BEAUCOUP moins qu'un
// 9-10 franc, réservé aux joueurs qui n'ont normalement plus besoin de l'app.
//   raw=1 → 0.5 | raw=6 → ≈2.76 | raw=8 → ≈4.63 | raw=10 → 7.0
//
// L'inverse exacte de cette formule vit dans generateLevelSummary()
// (phraseKeyFor) pour reconstituer le bucket de résumé — toute modification
// ici doit être répercutée là-bas, sinon les résumés de niveau se cassent.
export function scaleToLevel(raw) {
  return 0.5 + 6.5 * Math.pow((raw - 1) / 9, 1.8);
}

export const QUIZ_QUESTIONS = [
  // ═══════════════════ GROUPE 1 · Ressenti (curseur 1-10) ═══════════════════
  // Pas de `options` : `inputType: 'scale'` → ScoreScreen affiche un curseur
  // tactile. La valeur brute (1-10) est convertie via scaleToLevel() avant
  // d'entrer dans `answers`.
  { id: 1, type: 'tech', inputType: 'scale', scaleMin: 1, scaleMax: 10,
    scaleMinLabel: { fr: 'Pas confiant du tout', en: 'Not confident at all', he: 'לא בטוח בכלל' },
    scaleMaxLabel: { fr: 'Totalement confiant',  en: 'Fully confident',      he: 'בטוח לחלוטין' },
    q:     { fr: "Sur une échelle de 1 à 10, à quel point es-tu confiant avec ton smash ?", en: "On a scale of 1 to 10, how confident are you with your smash?", he: "בסולם של 1 עד 10, כמה אתה בטוח בסמאש שלך?" },
    qEval: { fr: "{name} est-il confiant avec son smash (1 à 10) ?", en: "How confident is {name} with their smash (1-10)?", he: "כמה {name} בטוח בסמאש שלו (1 עד 10)?" } },

  { id: 2, type: 'tech', inputType: 'scale', scaleMin: 1, scaleMax: 10,
    scaleMinLabel: { fr: 'Pas confiant du tout', en: 'Not confident at all', he: 'לא בטוח בכלל' },
    scaleMaxLabel: { fr: 'Totalement confiant',  en: 'Fully confident',      he: 'בטוח לחלוטין' },
    q:     { fr: "Sur une échelle de 1 à 10, à quel point es-tu confiant avec ton revers slicé ?", en: "On a scale of 1 to 10, how confident are you with your backhand slice?", he: "בסולם של 1 עד 10, כמה אתה בטוח בבקהנד הסלייס שלך?" },
    qEval: { fr: "{name} est-il confiant avec son revers slicé (1 à 10) ?", en: "How confident is {name} with their backhand slice (1-10)?", he: "כמה {name} בטוח בבקהנד הסלייס שלו (1 עד 10)?" } },

  { id: 3, type: 'tech', inputType: 'scale', scaleMin: 1, scaleMax: 10,
    scaleMinLabel: { fr: 'Pas confiant du tout', en: 'Not confident at all', he: 'לא בטוח בכלל' },
    scaleMaxLabel: { fr: 'Totalement confiant',  en: 'Fully confident',      he: 'בטוח לחלוטין' },
    q:     { fr: "Sur une échelle de 1 à 10, à quel point es-tu confiant avec ton coup droit ?", en: "On a scale of 1 to 10, how confident are you with your forehand?", he: "בסולם של 1 עד 10, כמה אתה בטוח בפורהנד שלך?" },
    qEval: { fr: "{name} est-il confiant avec son coup droit (1 à 10) ?", en: "How confident is {name} with their forehand (1-10)?", he: "כמה {name} בטוח בפורהנד שלו (1 עד 10)?" } },

  // ═══════════════════ GROUPE 2 · Coups nommés ═══════════════════════════════
  { id: 4, type: 'tech',
    q:     { fr: "Tu réussis souvent une bandeja (smash tout en douceur au filet) ?", en: "Do you often land a bandeja (soft smash at the net)?", he: "אתה מבצע בנדחה (סמאש רך ברשת)?" },
    qEval: { fr: "{name} réussit-il souvent une bandeja (smash en douceur au filet) ?", en: "Does {name} often land a bandeja (soft smash at net)?", he: "{name} מבצע בנדחה (סמאש רך ברשת)?" },
    options: [
      { fr: 'Rarement, je découvre encore le geste',           en: 'Rarely, still learning the move',            he: 'לעיתים רחוקות, עדיין לומד את התנועה',   value: 1   },
      { fr: 'Occasionnellement, une fois sur trois',           en: 'Occasionally, about one in three',           he: 'מדי פעם, בערך אחד מתוך שלושה',          value: 2   },
      { fr: 'Souvent, coup de routine fiable',                 en: 'Often, a reliable routine shot',              he: 'לעיתים קרובות, מכה שגרתית ואמינה',      value: 3.5 },
      { fr: 'Je la maîtrise parfaitement, direction et effet au choix', en: 'Fully mastered, direction and spin at will', he: 'שליטה מלאה, כיוון וספין לפי הרצון', value: 7 },
    ]},

  { id: 5, type: 'tech',
    q:     { fr: "Tu réussis souvent une vibora (smash de côté, coupé et rapide) ?", en: "Do you often land a vibora (sliced side smash)?", he: "אתה מבצע ויברה (סמאש צידי בסלייס, מהיר)?" },
    qEval: { fr: "{name} réussit-il souvent une vibora (smash de côté, coupé et rapide) ?", en: "Does {name} often land a vibora (sliced side smash)?", he: "{name} מבצע ויברה (סמאש צידי בסלייס, מהיר)?" },
    options: [
      { fr: 'Je ne la connais pas encore',                     en: "I don't know it yet",                        he: 'עוד לא מכיר אותה',                      value: 1   },
      { fr: 'En apprentissage, timing incertain',              en: 'Still learning, timing is inconsistent',     he: 'בשלב לימוד, התזמון לא עקבי',            value: 2   },
      { fr: 'Je la place avec intention',                      en: 'I place it with intent',                     he: 'אני ממקם אותה בכוונה',                  value: 3.5 },
      { fr: 'Maîtrise totale, croisée ou à la ligne',          en: 'Total mastery, cross or line',               he: 'שליטה מלאה, אלכסונית או קווית',         value: 7   },
    ]},

  // ═══════════════════ GROUPE 3 · Vitres ═════════════════════════════════════
  { id: 6, type: 'tech',
    q:     { fr: "La balle rebondit sur ta vitre : tu la renvoies facilement ?", en: "The ball bounces off your glass: do you return it easily?", he: "הכדור מקפץ מהזכוכית שלך: אתה מחזיר אותו בקלות?" },
    qEval: { fr: "{name} renvoie-t-il facilement une balle qui rebondit sur sa vitre ?", en: "Does {name} easily return a ball off their glass?", he: "האם {name} מחזיר בקלות כדור שמקפץ מהזכוכית שלו?" },
    options: [
      { fr: 'Rarement, le rebond me surprend',                 en: 'Rarely, the bounce catches me off guard',    he: 'לעיתים רחוקות, הקפיצה מפתיעה אותי',     value: 1   },
      { fr: 'Je récupère la balle, mais loin du filet',        en: 'I get the ball back, but far from the net',  he: 'אני מחזיר את הכדור, אבל רחוק מהרשת',    value: 2   },
      { fr: "Je renvoie assez fort pour empêcher l'attaque",   en: 'I return hard enough to stop their attack',  he: 'אני מחזיר חזק מספיק כדי למנוע התקפה',   value: 3.5 },
      { fr: 'Je place le renvoi pour créer une ouverture',     en: 'I place the return to create an opening',    he: 'אני ממקם את ההחזרה כדי ליצור פתח',      value: 7   },
    ]},

  { id: 7, type: 'tech',
    q:     { fr: "La balle touche les deux vitres du coin : tu arrives à la renvoyer ?", en: "The ball hits both corner glasses: can you return it?", he: "הכדור נוגע בשתי הזכוכיות בפינה: אתה מצליח להחזיר?" },
    qEval: { fr: "{name} arrive-t-il à renvoyer une balle qui touche les deux vitres du coin ?", en: "Can {name} return a ball hitting both corner glasses?", he: "האם {name} מצליח להחזיר כדור שנוגע בשתי הזכוכיות בפינה?" },
    options: [
      { fr: 'Non, je perds le point',                          en: 'No, I lose the point',                       he: 'לא, אני מפסיד את הנקודה',               value: 1   },
      { fr: 'Je la renvoie, mais trop haute',                  en: 'I get it back, but too high',                he: 'אני מחזיר אותו, אבל גבוה מדי',          value: 2   },
      { fr: 'Je la renvoie basse, difficile à attaquer',       en: 'I return it low, hard to attack',            he: 'אני מחזיר אותו נמוך, קשה לתקוף',        value: 3.5 },
      { fr: 'Je transforme la double vitre en point gagnant',  en: 'I turn the corner double-glass into a winner', he: 'אני הופך את כפל הקיר לנקודה מנצחת',   value: 7   },
    ]},

  { id: 8, type: 'tech',
    q:     { fr: "Un smash puissant rebondit sur ta vitre et retombe court, près du filet : tu le renvoies ?", en: "A hard smash bounces off your glass and lands short: do you return it?", he: "סמאש חזק מהיריב קופץ בזכוכית שלך ונופל קרוב לרשת: אתה מחזיר אותו?" },
    qEval: { fr: "Un smash puissant rebondit sur la vitre de {name} et retombe court : le renvoie-t-il ?", en: "A hard smash bounces off {name}'s glass and lands short: do they return it?", he: "סמאש חזק מהיריב קופץ בזכוכית של {name} ונופל קרוב לרשת: האם הוא מחזיר?" },
    options: [
      { fr: 'Je le rate souvent, trop puissant',               en: 'I often miss it, too powerful',              he: 'אני לרוב מפספס, חזק מדי',               value: 1   },
      { fr: 'Je le renvoie, mais la balle reste haute',        en: 'I return it, but the ball stays high',       he: 'אני מחזיר אותו, אבל הכדור נשאר גבוה',   value: 2   },
      { fr: "Je le renvoie bas, l'adversaire doit relancer",   en: 'I return it low, forcing them to lift',      he: 'אני מחזיר נמוך, היריב חייב להרים',      value: 3.5 },
      { fr: 'Je contre-attaque directement dessus',            en: 'I counter-attack straight off it',           he: 'אני יוצא להתקפת נגד ישירות',            value: 7   },
    ]},

  { id: 9, type: 'tech',
    q:     { fr: "Tu frappes sur ta vitre arrière et la balle retombe loin, côté adverse : ça t'arrive ?", en: "Do you hit your back glass and land the ball deep on their side?", he: "אתה מכה בזכוכית האחורית והכדור נופל עמוק בצד היריב?" },
    qEval: { fr: "{name} frappe sur sa vitre arrière et la balle retombe loin, côté adverse ?", en: "Does {name} hit their back glass and land the ball deep on the other side?", he: "{name} מכה בזכוכית האחורית והכדור נופל עמוק בצד היריב?" },
    options: [
      { fr: 'Rarement, la balle reste courte',                 en: 'Rarely, the ball stays short',               he: 'לעיתים רחוקות, הכדור נשאר קצר',         value: 1   },
      { fr: 'Parfois profond, mais sans direction précise',    en: 'Sometimes deep, but without precise direction', he: 'לפעמים עמוק, אבל בלי כיוון מדויק',   value: 2   },
      { fr: "Profond et placé, ça complique son jeu",          en: 'Deep and placed, it complicates their game', he: 'עמוק וממוקם, זה מסבך את המשחק שלו',     value: 3.5 },
      { fr: 'Je choisis systématiquement où ça retombe',       en: 'I consistently choose where it lands',       he: 'אני בוחר באופן עקבי איפה הוא נוחת',     value: 7   },
    ]},

  // ═══════════════════ GROUPE 4 · Smash ══════════════════════════════════════
  { id: 10, type: 'tech',
    q:     { fr: "Ton smash fait sortir la balle par le côté du terrain (par 3) ?", en: "Does your smash send the ball out the side (par 3)?", he: "הסמאש שלך מוציא את הכדור מהצד של המגרש (פר 3)?" },
    qEval: { fr: "Le smash de {name} fait-il sortir la balle par le côté (par 3) ?", en: "Does {name}'s smash send the ball out the side (par 3)?", he: "האם הסמאש של {name} מוציא את הכדור מהצד (פר 3)?" },
    options: [
      { fr: 'Je ne smashe pas encore',                         en: "I can't smash yet",                          he: 'אני עדיין לא מבצע סמאש',                value: 1   },
      { fr: 'Ça sort parfois par le côté, sans le vouloir',    en: 'It sometimes exits the side, unintentionally', he: 'לפעמים יוצא מהצד, בלי כוונה',          value: 2   },
      { fr: 'Je vise le par 3 et je le réussis souvent',       en: 'I aim for the par 3 and often land it',      he: 'אני מכוון לפר 3 ולרוב מצליח',           value: 3.5 },
      { fr: 'Je choisis le par 3 selon la situation',          en: 'I choose the par 3 based on the situation',  he: 'אני בוחר פר 3 לפי המצב',                value: 7   },
    ]},

  { id: 11, type: 'tech',
    q:     { fr: "Ton smash fait sortir la balle par le fond du terrain (par 4) ?", en: "Does your smash send the ball out the back (par 4)?", he: "הסמאש שלך מוציא את הכדור מאחורי המגרש (פר 4)?" },
    qEval: { fr: "Le smash de {name} fait-il sortir la balle par le fond (par 4) ?", en: "Does {name}'s smash send the ball out the back (par 4)?", he: "האם הסמאש של {name} מוציא את הכדור מאחור (פר 4)?" },
    options: [
      { fr: 'Je ne smashe pas encore',                         en: "I can't smash yet",                          he: 'אני עדיין לא מבצע סמאש',                value: 1   },
      { fr: 'Ça sort parfois par le fond, sans le vouloir',    en: 'It sometimes exits the back, unintentionally', he: 'לפעמים יוצא מאחור, בלי כוונה',         value: 2   },
      { fr: 'Je vise le par 4 et je le réussis souvent',       en: 'I aim for the par 4 and often land it',      he: 'אני מכוון לפר 4 ולרוב מצליח',           value: 3.5 },
      { fr: 'Je choisis le par 4 selon la situation',          en: 'I choose the par 4 based on the situation',  he: 'אני בוחר פר 4 לפי המצב',                value: 7   },
    ]},

  // ═══════════════════ GROUPE 5 · Tactique ═══════════════════════════════════
  { id: 12, type: 'tech',
    q:     { fr: "Arrives-tu à lire le jeu de l'adversaire à l'avance ?", en: "Can you read your opponent's game in advance?", he: "אתה מצליח לקרוא את משחק היריב מראש?" },
    qEval: { fr: "{name} arrive-t-il à lire le jeu de l'adversaire à l'avance ?", en: "Can {name} read the opponent's game in advance?", he: "האם {name} מצליח לקרוא את משחק היריב מראש?" },
    options: [
      { fr: 'Rarement, je réagis en retard',                   en: 'Rarely, I react too late',                   he: 'לעיתים רחוקות, אני מגיב מאוחר',         value: 1   },
      { fr: 'Je devine parfois la zone, pas le coup',          en: 'I sometimes guess the zone, not the shot',   he: 'לפעמים מנחש את האזור, לא את המכה',      value: 2   },
      { fr: "J'anticipe le coup et j'ajuste ma position",      en: 'I read the shot and adjust my position',     he: 'אני צופה את המכה ומתאים את מיקומי',     value: 3.5 },
      { fr: "J'anticipe l'adversaire ET je couvre mon partenaire", en: 'I read the opponent AND cover my partner', he: 'אני צופה את היריב וגם מכסה את השותף', value: 7   },
    ]},

  { id: 13, type: 'tech',
    q:     { fr: "Arrives-tu à placer la balle exactement où tu le souhaites ?", en: "Can you place the ball exactly where you want?", he: "אתה מצליח למקם את הכדור בדיוק איפה שאתה רוצה?" },
    qEval: { fr: "{name} arrive-t-il à placer la balle exactement où il le souhaite ?", en: "Can {name} place the ball exactly where they want?", he: "האם {name} מצליח למקם את הכדור בדיוק איפה שהוא רוצה?" },
    options: [
      { fr: 'Rarement, direction aléatoire',                   en: 'Rarely, random direction',                    he: 'לעיתים רחוקות, כיוון אקראי',            value: 1   },
      { fr: 'Je vise une zone, pas un point précis',           en: 'I aim for a zone, not a precise spot',       he: 'אני מכוון לאזור, לא לנקודה מדויקת',     value: 2   },
      { fr: "Je place la balle loin de l'adversaire",          en: 'I place the ball away from the opponent',    he: 'אני ממקם את הכדור רחוק מהיריב',         value: 3.5 },
      { fr: 'Je vise directement ses pieds ou un point faible', en: 'I aim straight at their feet or a weak spot', he: 'אני מכוון ישר לרגליו או לנקודה חלשה',  value: 7   },
    ]},

  { id: 14, type: 'tech',
    q:     { fr: "En défense, réussis-tu un lob pour reprendre ta place au filet ?", en: "On defense, can you lob to get back to the net?", he: "בהגנה, אתה מצליח בלוב כדי לחזור לרשת?" },
    qEval: { fr: "{name} réussit-il un lob en défense pour reprendre sa place au filet ?", en: "Can {name} lob on defense to get back to the net?", he: "האם {name} מצליח בלוב בהגנה כדי לחזור לרשת?" },
    options: [
      { fr: 'Rarement, je reste bloqué au fond',               en: 'Rarely, I stay stuck at the back',           he: 'לעיתים רחוקות, נשאר תקוע מאחור',        value: 1   },
      { fr: "Parfois, si l'occasion est facile",               en: "Sometimes, when it's an easy chance",       he: 'לפעמים, כשההזדמנות קלה',                value: 2   },
      { fr: 'Régulièrement, je remonte activement',            en: 'Regularly, I actively move up',              he: 'באופן קבוע, אני מתקדם באופן פעיל',      value: 3.5 },
      { fr: 'Je remonte même après une défense difficile',     en: 'I move up even after a tough defensive shot', he: 'אני מתקדם גם אחרי הגנה קשה',            value: 7   },
    ]},

  // ══════════════════════════════════════════════════════════════════════════
  // ANCRES OBJECTIVES (auto-évaluation uniquement — `selfOnly`).
  // Exclues du mode « évaluer un partenaire » (on ne connaît pas l'ancienneté
  // de quelqu'un d'autre). Pondérées plus fort que la technique car ce sont
  // des faits, plus difficiles à sur-estimer que l'auto-jugement.
  // (La fréquence de jeu actuelle a été retirée : ce n'est pas un indicateur
  // de niveau — un joueur de haut niveau peut très bien jouer rarement.)
  // ══════════════════════════════════════════════════════════════════════════

  // ── Q15 · Ancre : Ancienneté ──────────────────────────────────────────────
  { id: 15, type: 'anchor', selfOnly: true, weight: 2,
    q: { fr: "Depuis combien de temps joues-tu au padel ?", en: "How long have you been playing padel?", he: "כמה זמן אתה משחק פאדל?" },
    options: [
      { fr: 'Moins de 3 mois',   en: 'Less than 3 months', he: 'פחות מ-3 חודשים',   subFr: "Je découvre le padel.",     subEn: "Just discovering padel.",     subHe: 'רק מגלה את הפאדל.',    value: 1 },
      { fr: "Moins d'1 an",      en: 'Less than 1 year',   he: 'פחות משנה',         subFr: "Je construis mes bases.",   subEn: "Building my foundations.",    subHe: 'בונה את הבסיס.',       value: 2 },
      { fr: '1 à 2 ans',         en: '1 to 2 years',       he: 'שנה עד שנתיים',     subFr: "Pratique installée.",       subEn: "Well-established practice.",  subHe: 'תרגול מבוסס.',         value: 3.5 },
      { fr: 'Plus de 2 ans',     en: 'Over 2 years',       he: 'יותר משנתיים',      subFr: "Joueur de longue date.",    subEn: "Long-time player.",           subHe: 'שחקן ותיק.',           value: 7 },
    ]},

  // ── Q16 · Ancre : Niveau / compétition ────────────────────────────────────
  { id: 16, type: 'anchor', selfOnly: true, weight: 2,
    q: { fr: "À quel niveau de jeu te situes-tu ?", en: "Where do you place your level of play?", he: "באיזו רמת משחק אתה ממקם את עצמך?" },
    options: [
      { fr: 'Je débute',      en: 'Beginner',     he: 'מתחיל',   subFr: "Phase d'apprentissage.",                        subEn: "Learning phase.",                        subHe: 'שלב למידה.',                    value: 1 },
      { fr: 'Amateur',        en: 'Amateur',      he: 'חובבן',   subFr: "Je joue pour le plaisir, niveau loisir.",       subEn: "I play for fun, casual level.",          subHe: 'משחק בשביל הכיף, רמת פנאי.',     value: 2 },
      { fr: 'Intermédiaire',  en: 'Intermediate', he: 'בינוני',  subFr: "Bases solides, je progresse régulièrement.",    subEn: "Solid basics, progressing steadily.",    subHe: 'בסיס מוצק, מתקדם בהתמדה.',       value: 3.5 },
      { fr: 'Avancé',         en: 'Advanced',     he: 'מתקדם',   subFr: "Niveau compétiteur.",                           subEn: "Competitor level.",                      subHe: 'רמת מתחרה.',                    value: 7 },
    ]},

  // ══════════════════════════════════════════════════════════════════════════
  // BONUS TACTIQUE (auto-évaluation uniquement — `selfOnly`).
  // Questions de CONNAISSANCE, pas de compétence exécutée : on ne peut donc pas
  // les juger en observant quelqu'un jouer → exclues du mode « évaluer un
  // partenaire », comme les ancres.
  //
  // Mécanisme « ne peut que gagner » : les options portent `correct` au lieu de
  // `value`. Bonne réponse → 7 est écrit dans `answers` (poids 0.3, faible) ;
  // mauvaise réponse → la clé n'est PAS écrite, donc computeLevel ignore la
  // question entièrement (ni numérateur ni dénominateur) et le niveau est
  // rigoureusement identique à celui d'un joueur qui n'aurait jamais vu ces
  // questions. Se tromper ne pénalise donc jamais.
  // ══════════════════════════════════════════════════════════════════════════

  // ── Q17 · Bonus : lob et montée synchronisée ──────────────────────────────
  { id: 17, type: 'bonus', weight: 0.3, selfOnly: true,
    q: { fr: "Tu lobes l'adversaire, qui doit reculer en défense. Que fais-tu ?", en: "You lob your opponent, forcing them back on defence. What do you do?", he: "אתה מבצע לוב ליריב, שנאלץ לסגת להגנה. מה אתה עושה?" },
    options: [
      { fr: 'Je reste au fond du court',                    en: 'I stay at the back of the court',            he: 'אני נשאר בעומק המגרש',                 correct: false },
      { fr: 'Mon partenaire monte, moi je défends',         en: 'My partner moves up, I stay back',           he: 'השותף שלי עולה, אני מגן',              correct: false },
      { fr: 'On monte tous les deux au filet',              en: 'We both move up to the net',                 he: 'שנינו עולים לרשת',                     correct: true  },
      { fr: 'On smashe immédiatement, sans changer de position', en: 'We smash right away, without moving',   he: 'סומשים מיד, בלי לשנות מיקום',          correct: false },
    ]},

  // ── Q18 · Bonus : balle au centre ─────────────────────────────────────────
  { id: 18, type: 'bonus', weight: 0.3, selfOnly: true,
    q: { fr: "Balle au centre, vous êtes 2 droitiers au filet. Qui la prend en priorité ?", en: "Ball down the middle, two right-handers at the net. Who takes it?", he: "כדור במרכז, שניכם ימניים ברשת. מי לוקח אותו?" },
    options: [
      { fr: 'Le joueur de droite (revers)',                 en: 'The player on the right (backhand)',         he: 'השחקן מימין (בקהנד)',                  correct: false },
      { fr: 'Le joueur de gauche (coup droit)',             en: 'The player on the left (forehand)',          he: 'השחקן משמאל (פורהנד)',                 correct: true  },
      { fr: 'Le plus proche du filet',                      en: 'Whoever is closest to the net',              he: 'מי שקרוב יותר לרשת',                   correct: false },
      { fr: 'On la laisse rebondir',                        en: 'We let it bounce',                           he: 'נותנים לו לקפוץ',                      correct: false },
    ]},

  // ── Q19 · Bonus : recul synchronisé ───────────────────────────────────────
  { id: 19, type: 'bonus', weight: 0.3, selfOnly: true,
    q: { fr: "Vous êtes 2 au filet, un lob adverse profond arrive au-dessus de vous. Que faites-vous ?", en: "Both at the net, a deep lob comes over your heads. What do you do?", he: "שניכם ברשת, לוב עמוק מגיע מעל ראשיכם. מה אתם עושים?" },
    options: [
      { fr: "Un seul recule, l'autre reste au filet",       en: 'One drops back, the other stays at the net', he: 'אחד נסוג, השני נשאר ברשת',             correct: false },
      { fr: 'On recule tous les deux ensemble',             en: 'We both drop back together',                 he: 'שנינו נסוגים יחד',                     correct: true  },
      { fr: 'On smashe quand même',                         en: 'We smash anyway',                            he: 'סומשים בכל זאת',                       correct: false },
      { fr: 'On reste immobile',                            en: 'We stay put',                                he: 'נשארים במקום',                         correct: false },
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
      fr: "Coup aérien joué en réponse à un lob adverse, avec un effet coupé et peu de puissance. Son but n'est pas de gagner le point mais de garder la position au filet, souvent visé dans les pieds de l'adversaire.",
      en: "An overhead shot played in response to an opponent's lob, with a slice and little power. Its goal isn't to win the point but to keep the net position — usually aimed at the opponent's feet.",
      he: "מכה גבוהה המבוצעת בתגובה ללוב של היריב, עם אפקט סלייס וכוח מועט. מטרתה אינה לזכות בנקודה אלא לשמור על עמדת הרשת, ומכוונת לרוב לרגלי היריב.",
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
      fr: "Smash plat et puissant où la balle sort par le fond du terrain, au-dessus de la vitre arrière (4 m). La puissance vient du transfert de poids et de l'accélération du poignet au moment de l'impact.",
      en: "A flat, powerful smash where the ball exits through the back glass (4 m). The power comes from the weight transfer and the wrist acceleration at the moment of impact.",
      he: "סמאש שטוח ועוצמתי שבו הכדור יוצא דרך הזכוכית האחורית (4 מ'). הכוח מגיע מהעברת המשקל ומהאצת שורש כף היד ברגע הפגיעה.",
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
 *   • 14 questions TECHNIQUES (type:'tech') — auto/peer-éval, poids 1.
 *     Les 3 premières (id 1-3, « ressenti ») sont des curseurs 1-10 convertis
 *     via scaleToLevel() AVANT d'entrer dans `answers` — computeLevel ne voit
 *     que la valeur déjà sur l'échelle 0.5-7, comme n'importe quelle option.
 *   • 2 ANCRES OBJECTIVES (type:'anchor', selfOnly, id 15-16) — ancienneté
 *     (poids 2), niveau/compétition (poids 2). Présentes uniquement en
 *     AUTO-évaluation ; en peer-éval seules les 14 tech comptent. (La
 *     fréquence de jeu actuelle a été retirée : elle ne reflète pas un
 *     niveau de padel — un joueur de haut niveau peut jouer rarement.)
 *   • 3 BONUS TACTIQUES (type:'bonus', selfOnly, id 17-19, poids 0.3) —
 *     questions de connaissance. Une bonne réponse écrit 7 dans `answers` ;
 *     une mauvaise n'écrit RIEN, donc computeLevel ignore la question comme
 *     si elle n'existait pas. Se tromper ne pénalise jamais.
 *
 * FORMULE : moyenne PONDÉRÉE des réponses (chaque option a une `value` sur la
 *   même échelle 0.5–7 ; `weight` par défaut = 1).
 *     Score = Σ(value × weight) / Σ(weight) → arrondi 1 déc. → clamp [0.5, 7.0]
 *
 * VÉRIFICATIONS (poids : 14 tech ×1 + ancres ancienneté ×2, niveau ×2 = 18,
 *                + jusqu'à 3 bonus ×0.3 = 0.9 si toutes correctes)
 *   Peer-éval max  : 14 tech × 7 / 14                      = 7.0   ✓
 *                    (ancres ET bonus sont selfOnly → absents en peer-éval)
 *   Auto MAX       : (14×7 + 7×2 + 7×2) / 18               = 7.0   ✓
 *   Auto MAX+bonus : (126 + 3×7×0.3) / (18 + 0.9) = 132.3/18.9 = 7.0   ✓
 *                    (le plafond ne bouge pas : les bonus valent 7, comme le
 *                     reste au maximum — ils ne peuvent pas dépasser 7)
 *   Auto MIN       : (11×1 + 3×0.5 + 1×2 + 1×2) / 18 ≈ 0.917 → 0.9   ✓
 *     (11 questions standard à leur pire valeur 1, les 3 curseurs à leur pire
 *      valeur convertie scaleToLevel(1) = 0.5, puis les 2 ancres à leur pire
 *      valeur 1 — « Je débute » vaut désormais 1, aligné sur l'échelle 1/3/5/7
 *      commune à toutes les autres questions, d'où un plancher à 0.9 plutôt
 *      que 1.0)
 *   Auto MIN, bonus TOUS FAUX : identique à Auto MIN (0.9) — les 3 clés sont
 *      absentes de `answers`, le calcul est bit-à-bit le même.
 *   Auto MIN, bonus TOUS JUSTES : (16.5 + 6.3) / 18.9 ≈ 1.206 → 1.2
 *      (un débutant qui connaît la tactique gagne 0.3, il ne perd jamais rien)
 *
 * RECALIBRAGE DES PALIERS INTERMÉDIAIRES — le 1er palier (1) et le 4e (7)
 * n'ont jamais bougé (les bornes MIN/MAX ci-dessus restent donc inchangées) ;
 * seuls le 2e et le 3e palier ont été resserrés (3→2, 5.5→3.5 pour les tech
 * et ancres ; courbe convexe exposant 1.8 pour les 3 curseurs « ressenti »,
 * au lieu d'une droite). Avant ce recalibrage, un amateur honnête qui
 * répondait au 3e palier partout obtenait 4.8-5.9 — une échelle 6-7 réservée
 * en principe aux joueurs de compétition. Vérifié après recalibrage :
 *   Profil « amateur honnête » (3e palier partout + curseurs 6-7/10
 *     + 1 bonus juste) : 3.5   ✓ (cible produit 2.5-4.5)
 *   Profil « quasi-max partout » (4e palier + curseurs ~9-10/10) : 6.9   ✓
 *     (cohérent avec « réservé à la compétition »)
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
    // Q1 — Confiance : smash (curseur, valeurs bucketées via phraseKeyFor)
    1: {
      1:   { fr: "tu manques encore de confiance sur ton smash",                              en: "you still lack confidence on your smash",                              he: "אתה עדיין חסר ביטחון בסמאש שלך" },
      3:   { fr: "ta confiance sur le smash reste à construire",                              en: "your smash confidence is still building",                              he: "הביטחון שלך בסמאש עדיין בבנייה" },
      5.5: { fr: "tu es plutôt confiant sur ton smash",                                       en: "you're fairly confident on your smash",                                he: "אתה די בטוח בסמאש שלך" },
      7:   { fr: "tu es totalement confiant sur ton smash",                                   en: "you're fully confident on your smash",                                 he: "אתה בטוח לחלוטין בסמאש שלך" },
    },
    // Q2 — Confiance : revers slicé (curseur)
    2: {
      1:   { fr: "ton revers slicé manque encore de confiance",                               en: "your sliced backhand still lacks confidence",                          he: "הבקהנד הסלייס שלך עדיין חסר ביטחון" },
      3:   { fr: "ta confiance sur le revers slicé se construit",                             en: "your sliced backhand confidence is building",                          he: "הביטחון שלך בבקהנד הסלייס בבנייה" },
      5.5: { fr: "tu es plutôt confiant sur ton revers slicé",                                en: "you're fairly confident with your backhand slice",                     he: "אתה די בטוח בבקהנד הסלייס שלך" },
      7:   { fr: "tu es totalement confiant sur ton revers slicé",                            en: "you're fully confident with your backhand slice",                     he: "אתה בטוח לחלוטין בבקהנד הסלייס שלך" },
    },
    // Q3 — Confiance : coup droit (curseur)
    3: {
      1:   { fr: "ton coup droit manque encore de confiance",                                 en: "your forehand still lacks confidence",                                 he: "הפורהנד שלך עדיין חסר ביטחון" },
      3:   { fr: "ta confiance sur le coup droit se construit",                               en: "your forehand confidence is building",                                 he: "הביטחון שלך בפורהנד בבנייה" },
      5.5: { fr: "tu es plutôt confiant sur ton coup droit",                                  en: "you're fairly confident with your forehand",                           he: "אתה די בטוח בפורהנד שלך" },
      7:   { fr: "tu es totalement confiant sur ton coup droit",                              en: "you're fully confident with your forehand",                            he: "אתה בטוח לחלוטין בפורהנד שלך" },
    },
    // Q4 — Bandeja
    4: {
      1:   { fr: "tu découvres encore la bandeja",                                            en: "you're still discovering the bandeja",                                 he: "אתה עדיין מגלה את הבנדחה" },
      2:   { fr: "ta bandeja se construit progressivement",                                   en: "your bandeja is gradually improving",                                  he: "הבנדחה שלך מתפתחת בהדרגה" },
      3.5: { fr: "ta bandeja est un coup de routine fiable",                                   en: "your bandeja is a reliable routine shot",                              he: "הבנדחה שלך היא מכה אמינה" },
      7:   { fr: "ta bandeja est parfaitement maîtrisée",                                      en: "your bandeja is fully mastered",                                       he: "הבנדחה שלך שלוטה לחלוטין" },
    },
    // Q5 — Vibora
    5: {
      1:   { fr: "la vibora est encore un coup à découvrir",                                   en: "the vibora is still a shot to discover",                               he: "הויברה היא עדיין מכה לגלות" },
      2:   { fr: "ta vibora est en apprentissage",                                             en: "your vibora is a work in progress",                                    he: "הויברה שלך בלמידה" },
      3.5: { fr: "tu places ta vibora avec intention",                                         en: "you place your vibora with intent",                                   he: "אתה ממקם את הויברה בכוונה" },
      7:   { fr: "ta vibora est une vraie arme offensive",                                     en: "your vibora is a genuine offensive weapon",                            he: "הויברה שלך היא נשק התקפי אמיתי" },
    },
    // Q6 — Renvoi simple (une vitre)
    6: {
      1:   { fr: "les rebonds de vitre te surprennent encore",                                en: "wall rebounds still catch you off guard",                              he: "ניתוזי הקיר עדיין מפתיעים אותך" },
      2:   { fr: "tu récupères la balle de vitre, mais loin du filet",                    en: "you get the wall ball back, but far from the net",                       he: "אתה מחזיר את כדור הקיר, אבל רחוק מהרשת" },
      3.5: { fr: "tu renvoies assez fort pour empêcher l'attaque adverse",                                    en: "you return hard enough to stop their attack",                                    he: "אתה מחזיר חזק מספיק כדי למנוע את התקפת היריב" },
      7:   { fr: "tu places ton renvoi de vitre pour créer une ouverture",                                       en: "you place your wall return to create an opening",                                  he: "אתה ממקם את החזרת הקיר כדי ליצור פתח" },
    },
    // Q7 — Double vitre du coin
    7: {
      1:   { fr: "la double vitre du coin te fait encore perdre le point",                    en: "the corner double-glass still costs you the point",                   he: "כפל הקיר בפינה עדיין עולה לך בנקודה" },
      2:   { fr: "tu renvoies la double vitre, mais trop haute",                    en: "you get the corner double-glass back, but too high",              he: "אתה מחזיר את כפל הקיר, אבל גבוה מדי" },
      3.5: { fr: "tu renvoies la double vitre basse, difficile à attaquer",                            en: "you return the corner double-glass low, hard to attack",                          he: "אתה מחזיר את כפל הקיר נמוך, קשה לתקוף" },
      7:   { fr: "tu transformes la double vitre du coin en point gagnant",                         en: "you turn the corner double-glass into a winner",                     he: "אתה הופך את כפל הקיר בפינה לנקודה מנצחת" },
    },
    // Q8 — Défense sur smash adverse puissant
    8: {
      1:   { fr: "les smashs puissants sur ta vitre te posent encore problème",               en: "powerful smashes off your glass still trouble you",                   he: "סמאשים חזקים על הזכוכית שלך עדיין מקשים עליך" },
      2:   { fr: "tu renvoies les smashs puissants, mais la balle reste haute",                      en: "you return powerful smashes, but the ball stays high",                    he: "אתה מחזיר סמאשים חזקים, אבל הכדור נשאר גבוה" },
      3.5: { fr: "tu renvoies bas sur les smashs puissants, l'adversaire doit relancer",                  en: "you return powerful smashes low, forcing them to lift",                       he: "אתה מחזיר נמוך על סמאשים חזקים, היריב חייב להרים" },
      7:   { fr: "tu transformes les smashs puissants en contre-attaque",                     en: "you turn powerful smashes into a counter-attack",                      he: "אתה הופך סמאשים חזקים להתקפת נגד" },
    },
    // Q9 — Renvoi offensif profond via vitre arrière
    9: {
      1:   { fr: "tes renvois depuis la vitre arrière restent encore courts",                 en: "your back-glass returns still stay short",                            he: "ההחזרות שלך מהזכוכית האחורית עדיין קצרות" },
      2:   { fr: "tes renvois de vitre arrière sont parfois profonds, sans direction précise",                en: "your back-glass returns are sometimes deep, without precise direction",                                   he: "ההחזרות שלך מהזכוכית האחורית לפעמים עמוקות, בלי כיוון מדויק" },
      3.5: { fr: "tes renvois de vitre arrière sont profonds et placés, ça complique son jeu",            en: "your back-glass returns are deep and placed, complicating their game",                        he: "ההחזרות שלך מהזכוכית האחורית עמוקות וממוקמות, זה מסבך את משחקו" },
      7:   { fr: "tu choisis systématiquement où retombe ton renvoi de vitre arrière",                            en: "you consistently choose where your back-glass return lands",                       he: "אתה בוחר באופן עקבי איפה נוחתת החזרת הקיר האחורי שלך" },
    },
    // Q10 — Par 3
    10: {
      1:   { fr: "le smash est encore difficile à exécuter pour toi",                         en: "the smash is still difficult for you to execute",                     he: "הסמאש עדיין קשה לביצוע עבורך" },
      2:   { fr: "ton smash sort parfois du terrain, sans intention",                         en: "your smash sometimes exits, without real intent",                     he: "הסמאש שלך יוצא לפעמים, בלי כוונה אמיתית" },
      3.5: { fr: "tu vises le par 3 et tu le réussis souvent",                     en: "you aim for the par 3 and often land it",             he: "אתה מכוון לפר 3 ולרוב מצליח" },
      7:   { fr: "tu choisis ton par 3 selon la situation",                                   en: "you choose your par 3 based on the situation",                        he: "אתה בוחר את הפר 3 שלך לפי המצב" },
    },
    // Q11 — Par 4
    11: {
      1:   { fr: "le smash est encore difficile à exécuter pour toi",                         en: "the smash is still difficult for you to execute",                     he: "הסמאש עדיין קשה לביצוע עבורך" },
      2:   { fr: "ton smash sort parfois du terrain, sans intention",                         en: "your smash sometimes exits, without real intent",                     he: "הסמאש שלך יוצא לפעמים, בלי כוונה אמיתית" },
      3.5: { fr: "tu vises le par 4 et tu le réussis souvent",                     en: "you aim for the par 4 and often land it",             he: "אתה מכוון לפר 4 ולרוב מצליח" },
      7:   { fr: "tu choisis ton par 4 selon la situation",                        en: "you choose your par 4 based on the situation",           he: "אתה בוחר את הפר 4 שלך לפי המצב" },
    },
    // Q12 — Lire le jeu adverse
    12: {
      1:   { fr: "tu réagis encore en retard sur le jeu adverse",                             en: "you still react too late to your opponent's game",                    he: "אתה עדיין מגיב באיחור למשחק היריב" },
      2:   { fr: "tu devines parfois la zone adverse, pas le coup",                                 en: "you sometimes guess the opponent's zone, not the shot",                            he: "אתה לפעמים מנחש את אזור היריב, לא את המכה" },
      3.5: { fr: "tu anticipes le coup adverse et tu ajustes ta position",                                          en: "you read the opponent's shot and adjust your position",                            he: "אתה צופה את מכת היריב ומתאים את מיקומך" },
      7:   { fr: "tu anticipes l'adversaire tout en couvrant ton partenaire",                           en: "you read the opponent while covering your partner",      he: "אתה צופה את היריב תוך כדי כיסוי השותף" },
    },
    // Q13 — Placer la balle où je veux
    13: {
      1:   { fr: "la direction de ta balle reste encore aléatoire",                           en: "your ball direction is still random",                                  he: "כיוון הכדור שלך עדיין אקראי" },
      2:   { fr: "tu vises des zones larges, la précision reste à affiner",                   en: "you aim for broad zones, precision still needs work",                 he: "אתה מכוון לאזורים רחבים, הדיוק דורש עבודה" },
      3.5: { fr: "tu places la balle loin de l'adversaire",                       en: "you place the ball away from the opponent",                      he: "אתה ממקם את הכדור רחוק מהיריב" },
      7:   { fr: "tu vises directement ses pieds ou son point faible",                             en: "you aim straight at their feet or their weak spot",                       he: "אתה מכוון ישר לרגליו או לנקודה החלשה שלו" },
    },
    // Q14 — Lob défensif pour reprendre le filet
    14: {
      1:   { fr: "tu restes encore bloqué au fond après une défense",                        en: "you still stay stuck at the back after defending",                    he: "אתה עדיין נשאר תקוע מאחור אחרי הגנה" },
      2:   { fr: "tu remontes au filet seulement sur les occasions faciles",                  en: "you move up to the net only on easy chances",                         he: "אתה מתקדם לרשת רק בהזדמנויות קלות" },
      3.5: { fr: "tu remontes activement au filet après avoir défendu",                       en: "you actively move up to the net after defending",                     he: "אתה מתקדם באופן פעיל לרשת אחרי הגנה" },
      7:   { fr: "ta transition défense-attaque au lob est maîtrisée",                        en: "your lob-based defence-to-attack transition is mastered",             he: "המעבר שלך מהגנה להתקפה בלוב נשלט לחלוטין" },
    },
  };

  // Q1-3 (« ressenti ») stockent une valeur CONTINUE (scaleToLevel(raw), ex.
  // 3.75), pas l'une des 4 constantes 1/3/5.5/7 utilisées comme clés ci-dessus.
  // On inverse scaleToLevel pour retrouver le raw (1-10) et choisir la bonne
  // phrase par tranche — jamais un lookup direct par valeur continue.
  // L'inverse doit suivre la courbe exacte de scaleToLevel (exposant 1.8) —
  // une inversion linéaire ici donnerait un bucket faux pour la plupart des
  // valeurs, puisque la conversion en amont n'est plus une droite.
  const SCALE_IDS = new Set([1, 2, 3]);
  const phraseKeyFor = (qId, val) => {
    if (!SCALE_IDS.has(qId)) return val;
    const raw = 1 + 9 * Math.pow((val - 0.5) / 6.5, 1 / 1.8);
    return raw <= 3 ? 1 : raw <= 6 ? 3 : raw <= 8 ? 5.5 : 7;
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
  // Restreint aux questions ayant une PHRASE descriptive (technique 1–14) :
  // les ancres objectives (ancienneté, niveau) ne décrivent pas un
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

  const strongPhrase = PHRASES[topQ.id]?.[phraseKeyFor(topQ.id, topQ.val)]?.[l] ?? '';
  const weakPhrase   = PHRASES[weakQ.id]?.[phraseKeyFor(weakQ.id, weakQ.val)]?.[l] ?? '';

  // Sentence 1 : intro + strength + optional 2nd strength
  let s1 = `${intro[introKey]} ${strongPhrase}`;
  if (secondQ && secondQ.id !== topQ.id && secondQ.val >= 5.5) {
    const s2phrase = PHRASES[secondQ.id]?.[phraseKeyFor(secondQ.id, secondQ.val)]?.[l] ?? '';
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
