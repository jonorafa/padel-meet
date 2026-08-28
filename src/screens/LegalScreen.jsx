import { useNavigate } from 'react-router-dom'
import { usePrefs } from '../context/PrefsContext'
import { COURT } from '../components/CourtUI'

// ─────────────────────────────────────────────────────────────────────────────
// Pages légales — Politique de confidentialité & CGU (EULA).
// Publiques (accessibles sans compte) : /privacy et /terms.
//
// Les CGU incluent la clause « tolérance zéro » exigée par l'App Store (1.2).
//
// Trilingue fr/en/he : chaque document est écrit en entier dans chaque langue,
// et non reconstitué à partir de fragments traduits. Un texte juridique se
// relit comme un tout — le découper en clés d'i18n le rendrait impossible à
// faire valider par un juriste.
// ─────────────────────────────────────────────────────────────────────────────
const CONTACT_EMAIL = 'jonathanbens10@gmail.com'
const CONTROLLER = 'Jonathan Bensimon'          // responsable de traitement (Art. 13 RGPD)
const AUTHORITY_URL = 'gov.il/en/departments/the_privacy_protection_authority'
const UPDATED = { fr: '24 août 2026', en: 'August 24, 2026', he: '24 באוגוסט 2026' }

export default function LegalScreen({ doc = 'privacy' }) {
  const { lang, dark } = usePrefs()
  const navigate = useNavigate()

  const rtl = lang === 'he'
  const bg     = dark ? COURT.darkBg   : COURT.cream
  const ink    = dark ? COURT.darkText : COURT.ink
  const muted  = dark ? COURT.darkMuted: COURT.stone
  const border = dark ? COURT.darkBorder : `${COURT.green}28`

  // Spectral n'a pas de glyphes hébreux : en hébreu on bascule sur Mulish,
  // qui retombe sur la police système hébraïque (même règle que partout ailleurs).
  const ffTitle = rtl ? 'Mulish, sans-serif' : 'Spectral, serif'

  const h1 = { fontFamily: ffTitle, fontSize: 26, fontWeight: 800, color: ink, margin: '0 0 4px' }
  const h2 = { fontFamily: ffTitle, fontSize: 18, fontWeight: 800, color: dark ? COURT.greenOnDark : COURT.green, margin: '22px 0 8px' }
  const dateStyle = { fontFamily: 'Mulish', fontSize: 12, color: muted, marginBottom: 8 }
  const p  = { fontFamily: 'Mulish', fontSize: 14, lineHeight: 1.65, color: ink, margin: '0 0 10px' }
  const li = { ...p, margin: '0 0 6px' }
  // overflowWrap sur ce paragraphe SEUL (les autres gardent le style commun) :
  // l'URL de l'autorité est un mot insécable de 52 caractères qui débordait du
  // cadre sur mobile, mesuré avant correction.
  const pUrl = { ...p, overflowWrap: 'anywhere' }

  const updated = UPDATED[lang] || UPDATED.fr

  // Contenu statique (aucun state, aucun hook) : on garde des ÉLÉMENTS JSX et
  // non des composants définis dans le render — sinon React recrée un type de
  // composant à chaque rendu et remonte l'arbre (react-hooks/static-components).
  const privacyDocs = {
    fr: (
      <>
        <h1 style={h1}>Politique de confidentialité</h1>
        <div style={dateStyle}>Dernière mise à jour : {updated}</div>

        <p style={p}>
          Padel Meet (« l'application ») met en relation des joueurs de padel. Cette politique explique
          quelles données nous collectons, pourquoi, et tes droits sur ces données.
        </p>

        <h2 style={h2}>Responsable de traitement</h2>
        <p style={p}>
          Le responsable de traitement est <b>{CONTROLLER}</b>, exploitant l'application à titre
          individuel. Contact : <b>{CONTACT_EMAIL}</b>.
        </p>

        <h2 style={h2}>Données que nous collectons</h2>
        <p style={li}>• <b>Compte</b> : adresse e-mail, nom, âge, photos de profil.</p>
        <p style={li}>• <b>Profil de jeu</b> : niveau, main forte, côté, style, motivation, région/ville, préférences de partenaire.</p>
        <p style={li}>• <b>Activité</b> : matchs enregistrés, évaluations entre joueurs, séries (streak), messages échangés dans l'app.</p>
        <p style={li}>• <b>Technique</b> : données de connexion et de diagnostic (pour la stabilité et la sécurité).</p>

        <h2 style={h2}>Pourquoi (finalités) &amp; bases légales</h2>
        <p style={p}>
          Te proposer des partenaires pertinents (niveau, région, disponibilités), permettre la messagerie,
          afficher tes statistiques, et assurer la sécurité et la modération du service.
        </p>
        <p style={li}>• <b>Exécution du contrat</b> (art. 6.1.b RGPD) : fournir le service de mise en relation, la messagerie et les statistiques.</p>
        <p style={li}>• <b>Intérêt légitime</b> (art. 6.1.f) : sécurité, prévention des abus et modération.</p>
        <p style={li}>• <b>Consentement</b> (art. 6.1.a) : photos de profil et données facultatives. Tu peux le retirer à tout moment en les supprimant de ton profil.</p>

        <h2 style={h2}>Système de confidence rate — évaluation par les pairs</h2>
        <p style={p}>
          Après chaque match, tu peux évaluer le niveau de ton partenaire ; ces évaluations, combinées aux
          résultats de matchs confirmés, calculent automatiquement un score de fiabilité
          (« confidence rate ») associé à ton profil. Ce score qualifie la cohérence entre le niveau que tu
          as déclaré et l'appréciation de tes partenaires — ce n'est pas un classement de performance
          (comme un ELO), mais un indicateur de fiabilité déclarative. Le calcul applique des garde-fous
          automatiques contre la manipulation (limite du nombre d'évaluations prises en compte par période,
          pondération selon la fiabilité de l'évaluateur). Ce traitement peut être qualifié de profilage au
          sens de la réglementation applicable : il n'a aucun effet juridique et ne sert qu'à l'expérience de
          mise en relation au sein de l'application.
        </p>

        <h2 style={h2}>Hébergement &amp; partage</h2>
        <p style={p}>
          Les données sont hébergées chez notre prestataire d'infrastructure (Supabase) sur des serveurs
          situés dans l'Union européenne. Nous utilisons un outil de suivi des erreurs (Sentry, États-Unis) pour la
          stabilité : ce transfert hors UE est encadré par les <b>clauses contractuelles types</b> de la
          Commission européenne et le Data Privacy Framework. Nous <b>ne vendons pas</b> tes données et ne
          les partageons pas à des fins publicitaires.
        </p>
        <p style={p}>
          Nous utilisons également un outil de <b>mesure d'audience</b> (PostHog, hébergé dans
          l'Union européenne) pour comprendre comment l'application est utilisée : nombre d'inscriptions,
          de questionnaires de niveau terminés, de matchs organisés. Seuls des <b>événements explicites</b>{' '}
          sont envoyés — ni capture automatique de page, ni enregistrement de session, donc aucun contenu
          de tes messages ni de ton profil. Base légale : <b>intérêt légitime</b> (art. 6.1.f RGPD),
          à savoir comprendre et améliorer le service.
        </p>

        <h2 style={h2}>Conservation</h2>
        <p style={p}>
          Tes données sont conservées tant que ton compte est actif. À la suppression du compte, elles sont
          effacées (sauf obligation légale de conservation).
        </p>

        <h2 style={h2}>Tes droits</h2>
        <p style={p}>
          Conformément au RGPD, tu disposes des droits d'<b>accès</b>, de <b>rectification</b>, de{' '}
          <b>suppression</b>, de <b>portabilité</b>, d'<b>opposition</b> et de <b>limitation</b> du
          traitement, ainsi que du droit de <b>retirer ton consentement</b> à tout moment. Tu peux
          <b> supprimer ton compte directement dans l'application</b> (Profil → Réglages), ou nous écrire à {CONTACT_EMAIL}.
        </p>
        {/* <bdi> isole le nom hébreu et l'URL. Sans lui, la parenthèse fermante
            et la virgule qui suivent sont des caractères neutres que
            l'algorithme bidi rattache au sens du texte hébreu et déplace du
            mauvais côté. */}
        <p style={pUrl}>
          Tu as également le droit d'introduire une <b>réclamation auprès de l'autorité de contrôle compétente</b> — en Israël,
          la Privacy Protection Authority (<b><bdi>הרשות להגנת הפרטיות</bdi></b>), <bdi>{AUTHORITY_URL}</bdi>.
        </p>

        <h2 style={h2}>Stockage local</h2>
        <p style={p}>
          L'application stocke certaines préférences (langue, thème, niveau) localement sur ton appareil
          pour fonctionner correctement. Aucun cookie publicitaire n'est utilisé.
        </p>

        <h2 style={h2}>Contact</h2>
        <p style={p}>Pour toute question : <b>{CONTACT_EMAIL}</b>.</p>
      </>
    ),
    en: (
      <>
        <h1 style={h1}>Privacy Policy</h1>
        <div style={dateStyle}>Last updated: {updated}</div>

        <p style={p}>
          Padel Meet (&ldquo;the application&rdquo;) connects padel players with each other. This policy
          explains what data we collect, why, and your rights over that data.
        </p>

        <h2 style={h2}>Data controller</h2>
        <p style={p}>
          The data controller is <b>{CONTROLLER}</b>, operating the application as an individual.
          Contact: <b>{CONTACT_EMAIL}</b>.
        </p>

        <h2 style={h2}>Data we collect</h2>
        <p style={li}>• <b>Account</b>: e-mail address, name, age, profile photos.</p>
        <p style={li}>• <b>Playing profile</b>: level, dominant hand, side, style, motivation, region/city, partner preferences.</p>
        <p style={li}>• <b>Activity</b>: recorded matches, player-to-player ratings, streaks, messages exchanged in the app.</p>
        <p style={li}>• <b>Technical</b>: connection and diagnostic data (for stability and security).</p>

        <h2 style={h2}>Why (purposes) &amp; legal bases</h2>
        <p style={p}>
          To suggest relevant partners to you (level, region, availability), enable messaging, display your
          statistics, and ensure the security and moderation of the service.
        </p>
        <p style={li}>• <b>Performance of the contract</b> (art. 6.1.b GDPR): providing the matchmaking service, messaging and statistics.</p>
        <p style={li}>• <b>Legitimate interest</b> (art. 6.1.f): security, abuse prevention and moderation.</p>
        <p style={li}>• <b>Consent</b> (art. 6.1.a): profile photos and optional data. You may withdraw it at any time by deleting them from your profile.</p>

        <h2 style={h2}>Confidence rate system — peer evaluation</h2>
        <p style={p}>
          After each match, you may rate your partner&rsquo;s level; these ratings, combined with confirmed
          match results, automatically compute a reliability score (&ldquo;confidence rate&rdquo;) associated
          with your profile. This score qualifies the consistency between the level you declared and your
          partners&rsquo; assessment — it is not a performance ranking (such as an ELO), but an indicator of
          declarative reliability. The calculation applies automatic safeguards against manipulation (a cap on
          the number of ratings taken into account per period, weighting according to the rater&rsquo;s
          reliability). This processing may qualify as profiling within the meaning of the applicable
          regulation: it has no legal effect and serves only the matchmaking experience within the
          application.
        </p>

        <h2 style={h2}>Hosting &amp; sharing</h2>
        <p style={p}>
          Data is hosted with our infrastructure provider (Supabase) on servers located in the European
          Union. We use an error-tracking tool (Sentry, United States) for stability: this transfer outside
          the EU is governed by the European Commission&rsquo;s <b>standard contractual clauses</b> and the
          Data Privacy Framework. We <b>do not sell</b> your data and do not share it for advertising
          purposes.
        </p>
        <p style={p}>
          We also use an <b>analytics</b> tool (PostHog, hosted in the European Union) to understand how
          the application is used: number of sign-ups, completed level questionnaires, matches arranged.
          Only <b>explicit events</b> are sent — no automatic page capture and no session recording, so
          none of your messages or profile content. Legal basis: <b>legitimate interest</b>{' '}
          (art. 6.1.f GDPR), namely understanding and improving the service.
        </p>

        <h2 style={h2}>Retention</h2>
        <p style={p}>
          Your data is kept for as long as your account is active. When the account is deleted, it is erased
          (except where a legal retention obligation applies).
        </p>

        <h2 style={h2}>Your rights</h2>
        <p style={p}>
          Under the GDPR, you have the rights of <b>access</b>, <b>rectification</b>, <b>erasure</b>,{' '}
          <b>portability</b>, <b>objection</b> and <b>restriction</b> of processing, as well as the right to{' '}
          <b>withdraw your consent</b> at any time. You can
          <b> delete your account directly in the application</b> (Profile → Settings), or write to us at {CONTACT_EMAIL}.
        </p>
        <p style={pUrl}>
          You also have the right to lodge a <b>complaint with the competent supervisory authority</b> — in
          Israel, the Privacy Protection Authority (<b><bdi>הרשות להגנת הפרטיות</bdi></b>), <bdi>{AUTHORITY_URL}</bdi>.
        </p>

        <h2 style={h2}>Local storage</h2>
        <p style={p}>
          The application stores certain preferences (language, theme, level) locally on your device in order
          to work properly. No advertising cookies are used.
        </p>

        <h2 style={h2}>Contact</h2>
        <p style={p}>For any question: <b>{CONTACT_EMAIL}</b>.</p>
      </>
    ),
    he: (
      <>
        <h1 style={h1}>מדיניות פרטיות</h1>
        <div style={dateStyle}>עדכון אחרון: {updated}</div>

        <p style={p}>
          Padel Meet ("האפליקציה") מקשרת בין שחקני פאדל. מדיניות זו מסבירה איזה מידע אנו אוספים,
          לשם מה, ומהן זכויותיך ביחס למידע זה.
        </p>

        {/* À FAIRE RELIRE : « בקר המידע » est le calque de « data controller »
            (RGPD). Le droit israélien parle plutôt de « בעל מאגר המידע ».
            Le responsable étant soumis au RGPD ici, le terme RGPD est conservé,
            mais un juriste israélien devrait trancher avant lancement public. */}
        <h2 style={h2}>בקר המידע</h2>
        <p style={p}>
          בקר המידע הוא <b>{CONTROLLER}</b>, המפעיל את האפליקציה כעצמאי.
          יצירת קשר: <b>{CONTACT_EMAIL}</b>.
        </p>

        <h2 style={h2}>המידע שאנו אוספים</h2>
        <p style={li}>• <b>חשבון</b>: כתובת דוא״ל, שם, גיל, תמונות פרופיל.</p>
        <p style={li}>• <b>פרופיל משחק</b>: רמה, יד דומיננטית, צד, סגנון, מוטיבציה, אזור/עיר, העדפות שותף.</p>
        <p style={li}>• <b>פעילות</b>: משחקים שנרשמו, הערכות בין שחקנים, רצפי ימים, הודעות שהוחלפו באפליקציה.</p>
        <p style={li}>• <b>טכני</b>: נתוני התחברות ואבחון (לצורך יציבות ואבטחה).</p>

        <h2 style={h2}>מטרות העיבוד ובסיסים חוקיים</h2>
        <p style={p}>
          להציע לך שותפים מתאימים (רמה, אזור, זמינות), לאפשר התכתבות, להציג את הסטטיסטיקות שלך, ולהבטיח את
          אבטחת השירות ואת הפיקוח על התכנים.
        </p>
        <p style={li}>• <b>ביצוע החוזה</b> (סעיף 6.1.b ל-GDPR): אספקת שירות ההתאמה, ההתכתבות והסטטיסטיקות.</p>
        <p style={li}>• <b>אינטרס לגיטימי</b> (סעיף 6.1.f): אבטחה, מניעת שימוש לרעה ופיקוח על תכנים.</p>
        <p style={li}>• <b>הסכמה</b> (סעיף 6.1.a): תמונות פרופיל ומידע אופציונלי. באפשרותך לחזור בך מההסכמה בכל עת על ידי מחיקתם מהפרופיל שלך.</p>

        {/* À FAIRE RELIRE : « פרופיילינג » est la translittération de
            « profiling », courante dans les textes israéliens sur la vie
            privée ; l'alternative « יצירת פרופיל » existe aussi. Le sens
            juridique doit être confirmé par un locuteur natif juriste. */}
        <h2 style={h2}>מערכת מדד האמינות — הערכה על ידי עמיתים</h2>
        <p style={p}>
          לאחר כל משחק באפשרותך להעריך את רמת השותף שלך; הערכות אלה, בשילוב עם תוצאות משחקים מאושרות,
          מחשבות באופן אוטומטי ציון אמינות ("confidence rate") המשויך לפרופיל שלך. ציון זה מבטא
          את מידת ההתאמה בין הרמה שהצהרת עליה לבין הערכת השותפים שלך — אין מדובר בדירוג ביצועים (כגון ELO),
          אלא במדד לאמינות ההצהרה. החישוב מיישם מנגנוני הגנה אוטומטיים מפני מניפולציה (הגבלה על מספר ההערכות
          הנלקחות בחשבון בכל תקופה, שקלול בהתאם לאמינות המעריך). עיבוד זה עשוי להיחשב כפרופיילינג כמשמעותו
          בדין החל: אין לו כל תוקף משפטי והוא משמש אך ורק לחוויית ההתאמה בתוך האפליקציה.
        </p>

        {/* À FAIRE RELIRE : « סעיפים חוזיים סטנדרטיים » traduit « clauses
            contractuelles types » (SCC). Terme technique du RGPD sans
            équivalent officiel figé en hébreu — à confirmer. */}
        <h2 style={h2}>אחסון ושיתוף</h2>
        <p style={p}>
          המידע מאוחסן אצל ספק התשתיות שלנו (Supabase) על שרתים הממוקמים באיחוד האירופי. אנו משתמשים בכלי
          למעקב אחר תקלות (Sentry, ארצות הברית) לצורך יציבות: העברה זו אל מחוץ לאיחוד האירופי מוסדרת באמצעות{' '}
          <b>סעיפים חוזיים סטנדרטיים</b> של הנציבות האירופית ובאמצעות ה-Data Privacy Framework. אנו{' '}
          <b>איננו מוכרים</b> את המידע שלך ואיננו משתפים אותו למטרות פרסום.
        </p>
        {/* À FAIRE RELIRE : « מדידת קהל » pour « mesure d'audience ». Le terme
            courant en hébreu est plutôt « אנליטיקס » (translittération) ;
            « מדידת קהל » est un calque du français. À confirmer par un
            locuteur natif, comme les trois autres termes de ce fichier. */}
        <p style={p}>
          אנו משתמשים גם בכלי <b>למדידת קהל</b> (PostHog, מאוחסן באיחוד האירופי) כדי להבין כיצד נעשה שימוש
          באפליקציה: מספר ההרשמות, שאלוני הרמה שהושלמו, והמשחקים שאורגנו. נשלחים <b>אירועים מפורשים</b>{' '}
          בלבד — ללא לכידה אוטומטית של דפים וללא הקלטת סשן, ולפיכך אין העברה של תוכן ההודעות או הפרופיל
          שלך. הבסיס החוקי: <b>אינטרס לגיטימי</b> (סעיף 6.1.f ל-GDPR), קרי הבנת השירות ושיפורו.
        </p>

        <h2 style={h2}>שמירת מידע</h2>
        <p style={p}>
          המידע שלך נשמר כל עוד חשבונך פעיל. עם מחיקת החשבון הוא נמחק (למעט חובת שמירה על פי דין).
        </p>

        <h2 style={h2}>הזכויות שלך</h2>
        <p style={p}>
          בהתאם ל-GDPR עומדות לך הזכויות ל<b>עיון</b>, ל<b>תיקון</b>, ל<b>מחיקה</b>, ל<b>ניידות</b>,
          ל<b>התנגדות</b> ול<b>הגבלת</b> העיבוד, וכן הזכות <b>לחזור בך מהסכמתך</b> בכל עת. באפשרותך
          <b> למחוק את חשבונך ישירות באפליקציה</b> (פרופיל ← הגדרות), או לכתוב לנו לכתובת {CONTACT_EMAIL}.
        </p>
        <p style={pUrl}>
          כמו כן עומדת לך הזכות להגיש <b>תלונה לרשות הפיקוח המוסמכת</b> — בישראל,{' '}
          <b>הרשות להגנת הפרטיות</b> (<bdi>Privacy Protection Authority</bdi>), <bdi>{AUTHORITY_URL}</bdi>.
        </p>

        <h2 style={h2}>אחסון מקומי</h2>
        <p style={p}>
          האפליקציה שומרת העדפות מסוימות (שפה, ערכת נושא, רמה) באופן מקומי במכשירך כדי לפעול כראוי. לא נעשה
          שימוש בעוגיות פרסום.
        </p>

        <h2 style={h2}>יצירת קשר</h2>
        <p style={p}>לכל שאלה: <b>{CONTACT_EMAIL}</b>.</p>
      </>
    ),
  }
  const privacy = privacyDocs[lang] || privacyDocs.fr

  const termsDocs = {
    fr: (
      <>
        <h1 style={h1}>Conditions Générales d'Utilisation</h1>
        <div style={dateStyle}>Dernière mise à jour : {updated}</div>

        <p style={p}>
          En créant un compte et en utilisant Padel Meet, tu acceptes les présentes conditions. Si tu ne les
          acceptes pas, n'utilise pas l'application.
        </p>

        <h2 style={h2}>Admissibilité</h2>
        <p style={p}>
          Tu dois avoir au moins <b>18 ans</b> pour utiliser l'application. En créant un compte, tu déclares
          avoir l'âge requis. Tu es responsable de l'exactitude des informations de ton profil.
        </p>

        <h2 style={h2}>Règles de conduite — tolérance zéro</h2>
        <p style={p}>
          Padel Meet applique une <b>politique de tolérance zéro</b> envers les contenus répréhensibles et les
          comportements abusifs. Il est strictement interdit de :
        </p>
        <p style={li}>• harceler, menacer, insulter ou intimider un autre utilisateur ;</p>
        <p style={li}>• publier un contenu haineux, violent, sexuellement explicite ou illégal ;</p>
        <p style={li}>• usurper une identité ou créer un faux profil ;</p>
        <p style={li}>• envoyer du spam ou solliciter à des fins commerciales non autorisées.</p>

        <h2 style={h2}>Signalement &amp; blocage</h2>
        <p style={p}>
          Tu peux <b>signaler</b> ou <b>bloquer</b> tout utilisateur depuis son profil ou depuis
          la conversation. Nous examinons chaque signalement et nous efforçons d'agir dans les
          meilleurs délais (avertissement, suppression de contenu, suspension ou suppression du compte).
          Les utilisateurs bloqués ne peuvent plus te contacter ni voir ton profil.
        </p>

        <h2 style={h2}>Contenu des utilisateurs</h2>
        <p style={p}>
          Tu restes responsable des contenus que tu publies (photos, bio, messages). Tu nous accordes le droit
          de les héberger et de les afficher dans le cadre du service. Nous pouvons retirer tout contenu
          contraire aux présentes conditions.
        </p>

        <h2 style={h2}>Suspension &amp; résiliation</h2>
        <p style={p}>
          Nous pouvons suspendre ou supprimer un compte en cas de violation de ces règles, sans préavis si la
          gravité le justifie. Tu peux supprimer ton compte à tout moment.
        </p>

        <h2 style={h2}>Données personnelles</h2>
        <p style={p}>
          Padel Meet collecte et traite tes données personnelles (email, profil, activité) dans le cadre
          du service. Tu bénéficies d'un droit d'accès, de rectification et de suppression de tes données.
          Pour toute demande, écris-nous à {CONTACT_EMAIL} ou consulte notre{' '}
          <b>Politique de confidentialité</b> (accessible depuis l'application).
        </p>

        <h2 style={h2}>Rencontres &amp; limitation de responsabilité</h2>
        <p style={p}>
          Padel Meet est un outil de <b>mise en relation</b> sportive uniquement. L'application
          n'organise pas les matchs, ne contrôle pas les installations sportives, ne vérifie pas les
          équipements des clubs et ne supervise pas les rencontres physiques.{' '}
          <b>Padel Meet ne peut être tenu responsable de tout dommage corporel, matériel ou moral</b>{' '}
          survenant lors ou à la suite d'un match organisé via la plateforme. Les rencontres se font
          sous l'entière responsabilité des joueurs concernés.
        </p>

        <h2 style={h2}>Loi applicable &amp; juridiction</h2>
        <p style={p}>
          Les présentes conditions sont régies par le <b>droit israélien</b>. En cas de litige,
          les tribunaux compétents sont ceux de <b>Tel Aviv-Jaffa (Israël)</b>.{' '}
          Padel Meet est exploité à titre individuel par son fondateur dans l'attente de la constitution
          d'une société.
        </p>

        <h2 style={h2}>Contact</h2>
        <p style={p}>Pour toute question : <b>{CONTACT_EMAIL}</b>.</p>
      </>
    ),
    en: (
      <>
        <h1 style={h1}>Terms of Use</h1>
        <div style={dateStyle}>Last updated: {updated}</div>

        <p style={p}>
          By creating an account and using Padel Meet, you accept these terms. If you do not accept them, do
          not use the application.
        </p>

        <h2 style={h2}>Eligibility</h2>
        <p style={p}>
          You must be at least <b>18 years old</b> to use the application. By creating an account, you declare
          that you meet the age requirement. You are responsible for the accuracy of the information in your
          profile.
        </p>

        <h2 style={h2}>Rules of conduct — zero tolerance</h2>
        <p style={p}>
          Padel Meet enforces a <b>zero-tolerance policy</b> towards objectionable content and abusive
          behaviour. It is strictly forbidden to:
        </p>
        <p style={li}>• harass, threaten, insult or intimidate another user;</p>
        <p style={li}>• post hateful, violent, sexually explicit or illegal content;</p>
        <p style={li}>• impersonate someone or create a fake profile;</p>
        <p style={li}>• send spam or solicit for unauthorised commercial purposes.</p>

        <h2 style={h2}>Reporting &amp; blocking</h2>
        <p style={p}>
          You can <b>report</b> or <b>block</b> any user from their profile or from the conversation. We
          review every report and endeavour to act as quickly as possible (warning, content removal,
          suspension or deletion of the account). Blocked users can no longer contact you or see your profile.
        </p>

        <h2 style={h2}>User content</h2>
        <p style={p}>
          You remain responsible for the content you post (photos, bio, messages). You grant us the right to
          host and display it as part of the service. We may remove any content that breaches these terms.
        </p>

        <h2 style={h2}>Suspension &amp; termination</h2>
        <p style={p}>
          We may suspend or delete an account in the event of a breach of these rules, without notice where
          the seriousness warrants it. You may delete your account at any time.
        </p>

        <h2 style={h2}>Personal data</h2>
        <p style={p}>
          Padel Meet collects and processes your personal data (email, profile, activity) as part of the
          service. You have a right of access, rectification and erasure of your data. For any request, write
          to us at {CONTACT_EMAIL} or consult our <b>Privacy Policy</b> (accessible from the application).
        </p>

        <h2 style={h2}>Meetings &amp; limitation of liability</h2>
        <p style={p}>
          Padel Meet is a sports <b>matchmaking</b> tool only. The application does not organise matches, does
          not inspect sports facilities, does not verify club equipment and does not supervise physical
          meetings.{' '}
          <b>Padel Meet cannot be held liable for any bodily, material or moral damage</b>{' '}
          occurring during or following a match arranged through the platform. Meetings take place under the
          sole responsibility of the players concerned.
        </p>

        <h2 style={h2}>Governing law &amp; jurisdiction</h2>
        <p style={p}>
          These terms are governed by <b>Israeli law</b>. In the event of a dispute, the competent courts are
          those of <b>Tel Aviv-Jaffa (Israel)</b>.{' '}
          Padel Meet is operated on an individual basis by its founder pending the incorporation of a company.
        </p>

        <h2 style={h2}>Contact</h2>
        <p style={p}>For any question: <b>{CONTACT_EMAIL}</b>.</p>
      </>
    ),
    he: (
      <>
        <h1 style={h1}>תנאי שימוש</h1>
        <div style={dateStyle}>עדכון אחרון: {updated}</div>

        <p style={p}>
          בעצם יצירת חשבון ושימוש ב-Padel Meet, הנך מסכים לתנאים אלה. אם אינך מסכים להם, אין להשתמש
          באפליקציה.
        </p>

        <h2 style={h2}>כשירות לשימוש</h2>
        <p style={p}>
          עליך להיות בן <b>18 לפחות</b> כדי להשתמש באפליקציה. בעצם יצירת החשבון הנך מצהיר כי הנך עומד בדרישת
          הגיל. הנך אחראי לנכונות הפרטים בפרופיל שלך.
        </p>

        {/* Clause « tolérance zéro » — exigence App Store 1.2. Traduite
            intégralement, sans atténuation ni raccourci. */}
        <h2 style={h2}>כללי התנהגות — אפס סובלנות</h2>
        <p style={p}>
          Padel Meet מיישמת <b>מדיניות של אפס סובלנות</b> כלפי תכנים פוגעניים והתנהגות מתעללת. חל איסור מוחלט:
        </p>
        <p style={li}>• להטריד, לאיים, להעליב או להפחיד משתמש אחר;</p>
        <p style={li}>• לפרסם תוכן שיש בו הסתה, אלימות, תוכן מיני מפורש או תוכן בלתי חוקי;</p>
        <p style={li}>• להתחזות לאדם אחר או ליצור פרופיל מזויף;</p>
        <p style={li}>• לשלוח דואר זבל או לפנות למטרות מסחריות בלתי מורשות.</p>

        <h2 style={h2}>דיווח וחסימה</h2>
        <p style={p}>
          באפשרותך <b>לדווח</b> על כל משתמש או <b>לחסום</b> אותו מתוך הפרופיל שלו או מתוך השיחה. אנו בוחנים כל
          דיווח ופועלים בהקדם האפשרי (אזהרה, הסרת תוכן, השעיה או מחיקת החשבון). משתמשים חסומים אינם יכולים
          עוד ליצור איתך קשר או לצפות בפרופיל שלך.
        </p>

        <h2 style={h2}>תוכן משתמשים</h2>
        <p style={p}>
          הנך נושא באחריות לתכנים שהנך מפרסם (תמונות, תיאור אישי, הודעות). הנך מעניק לנו את הזכות לאחסן אותם
          ולהציגם במסגרת השירות. אנו רשאים להסיר כל תוכן הנוגד תנאים אלה.
        </p>

        <h2 style={h2}>השעיה וסיום ההתקשרות</h2>
        <p style={p}>
          אנו רשאים להשעות או למחוק חשבון במקרה של הפרת כללים אלה, ללא הודעה מוקדמת אם חומרת ההפרה מצדיקה
          זאת. באפשרותך למחוק את חשבונך בכל עת.
        </p>

        <h2 style={h2}>מידע אישי</h2>
        <p style={p}>
          Padel Meet אוספת ומעבדת את המידע האישי שלך (דוא״ל, פרופיל, פעילות) במסגרת השירות. עומדת לך
          הזכות לעיין במידע שלך, לתקנו ולמוחקו. לכל בקשה, כתוב לנו לכתובת {CONTACT_EMAIL} או עיין{' '}
          <b>במדיניות הפרטיות</b> שלנו (זמינה מתוך האפליקציה).
        </p>

        <h2 style={h2}>מפגשים והגבלת אחריות</h2>
        <p style={p}>
          Padel Meet היא כלי <b>לקישור</b> בין שחקנים בלבד. האפליקציה אינה מארגנת את המשחקים, אינה בודקת את
          מתקני הספורט, אינה מוודאת את ציוד המועדונים ואינה מפקחת על המפגשים הפיזיים.{' '}
          <b>Padel Meet לא תישא באחריות לכל נזק גוף, נזק רכוש או נזק לא ממוני</b>{' '}
          שייגרם במהלך משחק שאורגן באמצעות הפלטפורמה או בעקבותיו. המפגשים מתקיימים באחריותם המלאה של השחקנים
          הנוגעים בדבר.
        </p>

        <h2 style={h2}>הדין החל וסמכות השיפוט</h2>
        <p style={p}>
          תנאים אלה כפופים <b>לדין הישראלי</b>. בכל מחלוקת, בתי המשפט המוסמכים הם אלה של{' '}
          <b>תל אביב-יפו (ישראל)</b>. Padel Meet מופעלת כעסק של יחיד על ידי מייסדה, עד להקמת חברה.
        </p>

        <h2 style={h2}>יצירת קשר</h2>
        <p style={p}>לכל שאלה: <b>{CONTACT_EMAIL}</b>.</p>
      </>
    ),
  }
  const terms = termsDocs[lang] || termsDocs.fr

  const headerLabel = doc === 'terms'
    ? (lang === 'he' ? 'תנאי שימוש' : lang === 'en' ? 'Terms' : 'CGU')
    : (lang === 'he' ? 'פרטיות' : lang === 'en' ? 'Privacy' : 'Confidentialité')

  return (
    <div dir={rtl ? 'rtl' : 'ltr'} style={{ position: 'absolute', inset: 0, background: bg, display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '16px 18px', borderBottom: `0.5px solid ${border}`, flexShrink: 0,
      }}>
        <button onClick={() => navigate(-1)} style={{
          width: 38, height: 38, borderRadius: 10, border: `0.5px solid ${border}`,
          background: 'transparent', color: ink, cursor: 'pointer', fontSize: 18,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          // La flèche est un glyphe directionnel : en RTL elle doit pointer
          // vers la droite, sens du « retour » dans un contexte droite-à-gauche.
          transform: rtl ? 'scaleX(-1)' : 'none',
        }} aria-label={lang === 'he' ? 'חזור' : lang === 'en' ? 'Back' : 'Retour'}>←</button>
        <div style={{ fontFamily: ffTitle, fontSize: 17, fontWeight: 700, color: ink }}>
          {headerLabel}
        </div>
      </div>

      {/* Content */}
      <div style={{
        flex: 1, overflowY: 'auto', padding: '20px 20px 40px',
        WebkitOverflowScrolling: 'touch',
      }}>
        {doc === 'terms' ? terms : privacy}
      </div>
    </div>
  )
}
