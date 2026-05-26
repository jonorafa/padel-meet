export const REGIONS = ['Centre', 'Nord', 'Sud', 'Eilat'];

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
    tagline: "L'art du padel, redéfini.",
    cta_level: 'Établir mon niveau',
    members: 'Membres · depuis 2026',
    chooseLang: 'Choisissez votre langue',
    quizQ: 'Question', of: 'sur',
    continue: 'Continuer',
    yourLevel: 'Votre niveau initial',
    levelExplain: "Il s'affinera avec chaque match joué et évalué par vos pairs.",
    enterClub: 'Entrer au club',
    home: 'Accueil', search: 'Trouver', matches: 'Matchs', profile: 'Profil',
    greeting: 'Bonsoir,', currentLevel: 'Niveau actuel', outOf: 'sur',
    confidence: 'Indice de confiance', validated: 'Validé par 14 adversaires',
    evaluate: 'Évaluer', myLevel: 'mon niveau',
    find: 'Trouver', partner: 'un partenaire',
    recent: 'Activité récente', history: 'Historique des matchs',
    atClub: 'Au club', partners: 'Partenaires', available: 'disponibles',
    yes: 'Au jeu', no: 'Une autre fois',
    filters: 'Préférences', applyFilters: 'Appliquer',
    side: 'Côté', forehand: 'Drive', backhand: 'Revers', anySide: 'Indifférent',
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
    profile: 'Profil',
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
    tagline: 'The art of padel, redefined.',
    cta_level: 'Establish my level',
    members: 'Members · since 2026',
    chooseLang: 'Language',
    quizQ: 'Question', of: 'of',
    continue: 'Continue',
    yourLevel: 'Your initial level',
    levelExplain: 'It will refine itself with every match played and rated by your peers.',
    enterClub: 'Enter the club',
    home: 'Home', search: 'Find', matches: 'Matches', profile: 'Profile',
    greeting: 'Good evening,', currentLevel: 'Current level', outOf: 'out of',
    confidence: 'Confidence index', validated: 'Validated by 14 opponents',
    evaluate: 'Rate', myLevel: 'my level',
    find: 'Find', partner: 'a partner',
    recent: 'Recent activity', history: 'Match history',
    atClub: 'At the club', partners: 'Partners', available: 'available',
    yes: "I'm in", no: 'Another time',
    filters: 'Preferences', applyFilters: 'Apply',
    side: 'Side', forehand: 'Forehand', backhand: 'Backhand', anySide: 'Any',
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
    profile: 'Profile',
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
    tagline: 'אמנות הפאדל, מעוצבת מחדש.',
    cta_level: 'הגדר את הרמה שלי',
    members: 'חברים · מאז 2026',
    chooseLang: 'בחר את השפה שלך',
    quizQ: 'שאלה', of: 'מתוך',
    continue: 'המשך',
    yourLevel: 'הרמה ההתחלתית שלך',
    levelExplain: 'היא תשתפר עם כל משחק שתשחק ויוערך על ידי עמיתיך.',
    enterClub: 'כניסה למועדון',
    home: 'בית', search: 'מצא', matches: 'משחקים', profile: 'פרופיל',
    greeting: 'ערב טוב,', currentLevel: 'רמה נוכחית', outOf: 'מתוך',
    confidence: 'מדד אמינות', validated: 'אומת על ידי 14 יריבים',
    evaluate: 'הערך', myLevel: 'את הרמה שלי',
    find: 'מצא', partner: 'שותף',
    recent: 'פעילות אחרונה', history: 'היסטוריית משחקים',
    atClub: 'במועדון', partners: 'שותפים', available: 'זמינים',
    yes: 'אני בפנים', no: 'פעם אחרת',
    filters: 'העדפות', applyFilters: 'החל',
    side: 'צד', forehand: 'דרייב', backhand: 'גב יד', anySide: 'לא משנה',
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
    profile: 'פרופיל',
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
 *   1 = Débutant   |   3 = Intermédiaire   |   5 = Avancé   |   7 = Expert compétition
 *
 * Questions couvertes : Bandeja · Vibora · Sorties de vitre · Lecture tactique
 */
export const QUIZ_QUESTIONS = [
  // ── Q1 · Technique : Bandeja ──────────────────────────────────────────────
  { id: 1, type: 'tech',
    q: { fr: "À quelle fréquence réussis-tu une bandeja contrôlée ?", en: "How often do you land a controlled bandeja?", he: "באיזו תדירות אתה מבצע בנדחה מבוקרת?" },
    options: [
      { fr: 'Rarement',        en: 'Rarely',        he: 'לעיתים רחוקות', subFr: "Je découvre encore le geste.",           subEn: "Still learning the shot.",         subHe: 'עדיין לומד את התנועה.',       value: 1 },
      { fr: 'Occasionnellement',en:'Occasionally',  he: 'מדי פעם',       subFr: "Réussite une fois sur trois.",          subEn: "About one in three.",              subHe: 'הצלחה בכ-שליש מהמקרים.',     value: 3 },
      { fr: 'Souvent',         en: 'Often',         he: 'לעיתים קרובות', subFr: "Coup de routine, placement correct.",  subEn: "Routine shot, decent placement.",  subHe: 'מכה שגרתית, מיקום סביר.',    value: 5.5 },
      { fr: 'Arme de compétition', en: 'Competition weapon', he: 'נשק תחרותי', subFr: "Placée à volonté, direction et effet maîtrisés.", subEn: "Placed at will — direction and spin mastered.", subHe: 'שליטה מלאה בכיוון ובספין.', value: 7 },
    ]},

  // ── Q2 · Technique : Sorties de vitre ────────────────────────────────────
  { id: 2, type: 'tech',
    q: { fr: "Maîtrises-tu les sorties de vitre (fond et côté) ?", en: "Do you handle back-wall and side-glass exits?", he: 'אתה שולט ביציאות מהקירות?' },
    options: [
      { fr: 'Pas encore',         en: 'Not yet',           he: 'עוד לא',         subFr: "Le mur me surprend.",                          subEn: "The wall catches me off-guard.",       subHe: 'הקיר מפתיע אותי.',                value: 1 },
      { fr: 'Lecture correcte',   en: 'Decent read',       he: 'קריאה סבירה',    subFr: "Je récupère la balle, sans précision.",        subEn: "I recover, without precision.",        subHe: 'מציל את הכדור, בלי דיוק.',        value: 3 },
      { fr: 'Sortie propre',      en: 'Clean exit',        he: 'יציאה נקייה',    subFr: "Je relance avec intention et placement.",      subEn: "I return with intent and placement.",  subHe: 'חזרה מכוונת עם מיקום.',           value: 5.5 },
      { fr: 'Double vitre maîtrisée', en: 'Double-glass mastered', he: 'שליטה בכפל קיר', subFr: "Je transforme double vitre en attaque — niveau compétition.", subEn: "I turn double-glass into attack — competition level.", subHe: 'הופך כפל קיר להתקפה — רמת תחרות.', value: 7 },
    ]},

  // ── Q3 · Auto-éval : Régularité ───────────────────────────────────────────
  { id: 3, type: 'self',
    q:   { fr: "Régularité dans l'échange", en: "Consistency in rallies", he: 'יציבות בחילופים' },
    sub: { fr: 'De 1 (variable) à 10 (métronome).', en: "From 1 (erratic) to 10 (metronome).", he: 'מ-1 (משתנה) עד 10 (מטרונום).' }},

  // ── Q4 · Technique : Vibora ───────────────────────────────────────────────
  { id: 4, type: 'tech',
    q: { fr: "Maîtrises-tu la vibora ?", en: "How well do you master the vibora?", he: 'עד כמה אתה שולט בויברה?' },
    options: [
      { fr: 'Je ne la connais pas encore', en: "I don't know it yet",    he: 'עוד לא מכיר את המכה', subFr: "Coup découvert récemment.",                    subEn: "Just discovered the shot.",                  subHe: 'גיליתי את המכה לאחרונה.',             value: 1 },
      { fr: 'En apprentissage',            en: 'Still learning',          he: 'בשלב הלמידה',         subFr: "Résultat aléatoire, timing inconsistant.",    subEn: "Inconsistent timing, random results.",       subHe: 'תזמון לא עקבי, תוצאות אקראיות.',     value: 3 },
      { fr: 'Je la place avec intention',  en: 'I place it with intent',  he: 'משתמש בה בכוונה',    subFr: "Bonne exécution, placement correct.",         subEn: "Good execution, correct placement.",         subHe: 'ביצוע טוב, מיקום נכון.',              value: 5.5 },
      { fr: 'Arme de compétition',         en: 'Competition weapon',      he: 'נשק תחרותי',          subFr: "Vibora croisée ou à la ligne — maîtrise totale.", subEn: "Cross or line vibora — total mastery.", subHe: 'ויברה אלכסונית או קווית — שליטה מלאה.', value: 7 },
    ]},

  // ── Q5 · Auto-éval : Puissance ────────────────────────────────────────────
  { id: 5, type: 'self',
    q:   { fr: 'Puissance de frappe', en: "Striking power", he: 'עוצמת החבטה' },
    sub: { fr: 'De 1 (mesurée) à 10 (foudroyante).', en: "From 1 (measured) to 10 (thunderous).", he: 'מ-1 (מדודה) עד 10 (חזקה מאוד).' }},

  // ── Q6 · Technique : Lecture tactique ────────────────────────────────────
  { id: 6, type: 'tech',
    q: { fr: "Comment lis-tu le jeu adverse ?", en: "How do you read your opponents?", he: 'איך אתה קורא את המשחק?' },
    options: [
      { fr: 'Je réagis tard',        en: 'I react late',           he: 'מאחר להגיב',     subFr: "Le coup est déjà parti quand je bouge.",       subEn: "The shot is already gone when I move.",  subHe: 'המכה כבר יצאה כשאני זז.',          value: 1 },
      { fr: 'Anticipation correcte', en: 'Decent anticipation',    he: 'ציפייה סבירה',   subFr: "Je devine la zone, pas toujours la direction.", subEn: "I guess the zone, not always direction.", subHe: 'מנחש את האזור, לא תמיד הכיוון.',    value: 3 },
      { fr: 'Bonne lecture',         en: 'Good read',              he: 'קריאה טובה',     subFr: "Intention + zone + déplacement anticipé.",     subEn: "Intent + zone + early movement.",         subHe: 'כוונה + אזור + תנועה מוקדמת.',      value: 5.5 },
      { fr: 'Lecture experte',       en: 'Expert read',            he: 'קריאה מומחית',   subFr: "Je lis mon partenaire ET les adversaires — anticipation double, niveau tournoi.", subEn: "I read partner AND opponents — double anticipation, tournament level.", subHe: 'קורא שותף ויריבים — ציפייה כפולה, רמת טורניר.', value: 7 },
    ]},

  // ── Q7 · Auto-éval : Placement ────────────────────────────────────────────
  { id: 7, type: 'self',
    q:   { fr: 'Placement sur le court', en: "Court positioning", he: 'מיקום במגרש' },
    sub: { fr: 'De 1 (instinctif) à 10 (chirurgical).', en: "From 1 (instinctive) to 10 (surgical).", he: 'מ-1 (אינסטינקטיבי) עד 10 (כירורגי).' }},

  // ── Q8 · Auto-éval : Mental ───────────────────────────────────────────────
  { id: 8, type: 'self',
    q:   { fr: 'Mental & sang-froid', en: "Mental & composure", he: 'מנטליות וקור רוח' },
    sub: { fr: 'De 1 (réactif) à 10 (impassible).', en: "From 1 (reactive) to 10 (unflappable).", he: 'מ-1 (מגיב) עד 10 (קר רוח).' }},
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
 * BARÈME DES OPTIONS TECHNIQUES
 *   Débutant      → value: 1.0
 *   Intermédiaire → value: 3.0
 *   Avancé        → value: 5.5
 *   Expert        → value: 7.0
 *
 * FORMULE  (anti-surestimation — tech prime sur l'auto-éval)
 *   Score_Final = (Score_Technique × 0.85) + (Score_AutoEval × 0.15)
 *
 * Score_Technique : moyenne des options tech, déjà sur [1, 7]
 * Score_AutoEval  : moyenne des sliders [1,10] remappée → [0.5, 7.0]
 *                   via : 0.5 + (avg − 1) × (6.5 / 9)
 *
 * SIMULATIONS DE VÉRIFICATION
 *   MAX    tech=7.0  autoEval=7.0  → (7.0×0.85)+(7.0×0.15) = 5.95+1.05 = 7.0  ✓
 *   EXPERT tech=7.0  autoEval=5.5  → (7.0×0.85)+(5.5×0.15) = 5.95+0.825 = 6.8 ✓
 *   AVANCÉ tech=5.5  autoEval=5.5  → (5.5×0.85)+(5.5×0.15) = 4.675+0.825 = 5.5 ✓
 *
 * CAS SKIP : retourne null — ne jamais inventer de valeur par défaut.
 */
export function computeLevel(answers) {
  if (!answers || Object.keys(answers).length === 0) return null;

  let techSum = 0, techN = 0, selfSum = 0, selfN = 0;

  QUIZ_QUESTIONS.forEach(q => {
    const v = answers[q.id];
    if (v == null) return;
    if (q.type === 'tech') {
      // Valeurs : 1.0 | 3.0 | 5.5 | 7.0 — déjà sur l'échelle [1, 7]
      techSum += v;
      techN++;
    } else {
      // Slider [1, 10]
      selfSum += v;
      selfN++;
    }
  });

  // Quiz incomplet (aucune réponse tech ou aucun slider) → pas de niveau attribué
  if (techN === 0 || selfN === 0) return null;

  const techScore = techSum / techN;

  // Score auto-éval — slider [1,10] → [0.5, 7.0]
  const selfAvg   = selfSum / selfN;
  const selfScore = 0.5 + (selfAvg - 1) * (6.5 / 9);

  // Pondération : 85% technique / 15% auto-évaluation
  const raw = techScore * 0.85 + selfScore * 0.15;

  // Arrondi à 1 décimale, clamp [0.5, 7.0]
  const finalScore = Math.round(raw * 10) / 10;
  return Math.max(0.5, Math.min(7.0, finalScore));
}

// ELO simple: +/- selon résultat et différence de niveau
export function computeELODelta(myLevel, theirLevel, result) {
  const expected = 1 / (1 + Math.pow(10, (theirLevel - myLevel) / 2));
  const actual = result === 'win' ? 1 : 0;
  const K = 0.3;
  return +((K * (actual - expected)).toFixed(2));
}
