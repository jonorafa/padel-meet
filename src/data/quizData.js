// ───────────────────────────────────────────────────────────────────────────
// Contenu du module « Apprendre » (quizz pédagogique style Duolingo).
//
// ⚠️ TOTALEMENT INDÉPENDANT du quiz de calibration de niveau (computeLevel) et
//    du confidence_rate. Ce module ne touche JAMAIS profiles.level ni
//    confidence_rate — c'est de l'apprentissage / engagement pur (XP + étoiles).
//
// Format d'un chapitre :
//   { id, icon (emoji), title{fr,en,he}, subtitle{fr,en,he}, questions: [...] }
// Format d'une question :
//   { id, q{fr,en,he}, options:[{ id, text{fr,en,he} }], correct:'a', explain{fr,en,he} }
// ───────────────────────────────────────────────────────────────────────────

export const QUIZ_CHAPTERS = [
  // ── 1. Les bases ─────────────────────────────────────────────────────────
  {
    id: 'basics',
    icon: '🎾',
    title:    { fr: 'Les bases', en: 'The basics', he: 'יסודות' },
    subtitle: { fr: 'Terrain & règles', en: 'Court & rules', he: 'מגרש וחוקים' },
    questions: [
      {
        id: 'b1',
        q: {
          fr: 'Combien de joueurs sur un terrain de padel lors d’un match classique ?',
          en: 'How many players are on a padel court in a standard match?',
          he: 'כמה שחקנים יש על מגרש פאדל במשחק רגיל?',
        },
        options: [
          { id: 'a', text: { fr: '4 (2 contre 2)', en: '4 (2 vs 2)', he: '4 (2 נגד 2)' } },
          { id: 'b', text: { fr: '2 (1 contre 1)', en: '2 (1 vs 1)', he: '2 (1 נגד 1)' } },
          { id: 'c', text: { fr: '6 (3 contre 3)', en: '6 (3 vs 3)', he: '6 (3 נגד 3)' } },
        ],
        correct: 'a',
        explain: {
          fr: 'Le padel se joue presque toujours en double : deux équipes de deux joueurs.',
          en: 'Padel is almost always played as doubles: two teams of two players.',
          he: 'פאדל משוחק כמעט תמיד בזוגות: שתי קבוצות של שני שחקנים.',
        },
      },
      {
        id: 'b2',
        q: {
          fr: 'Le décompte des points au padel suit le même système qu’au…',
          en: 'Padel scoring follows the same system as…',
          he: 'שיטת הניקוד בפאדל זהה ל…',
        },
        options: [
          { id: 'a', text: { fr: 'Tennis (15, 30, 40, jeu)', en: 'Tennis (15, 30, 40, game)', he: 'טניס (15, 30, 40, גיים)' } },
          { id: 'b', text: { fr: 'Ping-pong (jusqu’à 11)', en: 'Table tennis (up to 11)', he: 'טניס שולחן (עד 11)' } },
          { id: 'c', text: { fr: 'Volley (jusqu’à 25)', en: 'Volleyball (up to 25)', he: 'כדורעף (עד 25)' } },
        ],
        correct: 'a',
        explain: {
          fr: 'Comme au tennis : 15, 30, 40 puis le jeu. Il faut généralement 6 jeux pour gagner un set.',
          en: 'Just like tennis: 15, 30, 40, then game. You usually need 6 games to win a set.',
          he: 'בדיוק כמו בטניס: 15, 30, 40 ואז גיים. בדרך כלל צריך 6 גיימים כדי לזכות במערכה.',
        },
      },
      {
        id: 'b3',
        q: {
          fr: 'Quelles sont les dimensions d’un terrain de padel ?',
          en: 'What are the dimensions of a padel court?',
          he: 'מהם מידות מגרש הפאדל?',
        },
        options: [
          { id: 'a', text: { fr: '20 m × 10 m', en: '20 m × 10 m', he: '20 מ׳ × 10 מ׳' } },
          { id: 'b', text: { fr: '24 m × 11 m (tennis)', en: '24 m × 11 m (tennis)', he: '24 מ׳ × 11 מ׳ (טניס)' } },
          { id: 'c', text: { fr: '15 m × 8 m', en: '15 m × 8 m', he: '15 מ׳ × 8 מ׳' } },
        ],
        correct: 'a',
        explain: {
          fr: 'Un terrain mesure 20 m de long sur 10 m de large, entouré de vitres et de grillage.',
          en: 'A court is 20 m long by 10 m wide, enclosed by glass walls and metal mesh.',
          he: 'המגרש באורך 20 מ׳ וברוחב 10 מ׳, מוקף בקירות זכוכית ורשת מתכת.',
        },
      },
      {
        id: 'b4',
        q: {
          fr: 'Combien de formes différentes de raquette de padel existe-t-il ?',
          en: 'How many different padel racquet shapes are there?',
          he: 'כמה צורות שונות של מחבט פאדל קיימות?',
        },
        options: [
          { id: 'a', text: { fr: '3 (tête ronde, goutte d’eau, diamant)', en: '3 (round, teardrop, diamond)', he: '3 (עגול, טיפה, יהלום)' } },
          { id: 'b', text: { fr: '2 (ronde et ovale)', en: '2 (round and oval)', he: '2 (עגול ואובלי)' } },
          { id: 'c', text: { fr: '4 (ronde, ovale, carrée, triangulaire)', en: '4 (round, oval, square, triangular)', he: '4 (עגול, אובלי, מרובע, משולש)' } },
        ],
        correct: 'a',
        explain: {
          fr: 'Tête ronde : sweet spot large et bas, idéale pour le contrôle. Goutte d’eau : sweet spot centré, équilibre puissance/contrôle. Diamant : sweet spot haut, plus de puissance mais moins de contrôle — adaptée aux joueurs avancés.',
          en: 'Round head: large low sweet spot, ideal for control. Teardrop: centred sweet spot, balance of power and control. Diamond: high sweet spot, more power but less control — suited to advanced players.',
          he: 'ראש עגול: אזור מתיקה גדול ונמוך, אידאלי לשליטה. טיפה: אזור מתיקה מרכזי, איזון עוצמה/שליטה. יהלום: אזור מתיקה גבוהה, יותר עוצמה אך פחות שליטה — מתאים לשחקנים מתקדמים.',
        },
      },
      {
        id: 'b5',
        q: {
          fr: 'Qui a inventé le padel et en quelle année ?',
          en: 'Who invented padel and in what year?',
          he: 'מי המציא את הפאדל ובאיזו שנה?',
        },
        options: [
          { id: 'a', text: { fr: 'Enrique Corcuera, au Mexique en 1969', en: 'Enrique Corcuera, in Mexico in 1969', he: 'אנריקה קורקוורה, במקסיקו ב-1969' } },
          { id: 'b', text: { fr: 'Carlos Moya, en Espagne en 1982', en: 'Carlos Moya, in Spain in 1982', he: 'קרלוס מויה, בספרד ב-1982' } },
          { id: 'c', text: { fr: 'Juan Lebrón, en Argentine en 1995', en: 'Juan Lebrón, in Argentina in 1995', he: 'חואן לברון, בארגנטינה ב-1995' } },
        ],
        correct: 'a',
        explain: {
          fr: 'Le padel est né en 1969 à Acapulco, au Mexique. Enrique Corcuera n’avait pas assez de place pour un court de tennis, alors il a entouré son terrain de murs — l’origine de la « cage » en verre et grillage qu’on connaît aujourd’hui.',
          en: 'Padel was born in 1969 in Acapulco, Mexico. Enrique Corcuera didn’t have room for a tennis court, so he surrounded his court with walls — the origin of today’s glass-and-mesh cage.',
          he: 'הפאדל נולד ב-1969 באקפולקו, מקסיקו. לאנריקה קורקוורה לא היה מקום למגרש טניס, אז הוא הקיף את המגרש שלו בקירות — מקור ה“כלוב” מזכוכית ורשת שאנו מכירים היום.',
        },
      },
    ],
  },

  // ── 2. Le service ────────────────────────────────────────────────────────
  {
    id: 'serve',
    icon: '🥎',
    title:    { fr: 'Le service', en: 'The serve', he: 'הפתיחה' },
    subtitle: { fr: 'Bien démarrer le point', en: 'Start the point right', he: 'להתחיל נכון את הנקודה' },
    questions: [
      {
        id: 's1',
        q: {
          fr: 'Comment doit-on servir au padel ?',
          en: 'How must you serve in padel?',
          he: 'כיצד יש להגיש בפאדל?',
        },
        options: [
          { id: 'a', text: { fr: 'À la cuillère, balle frappée sous la taille', en: 'Underarm, ball hit below the waist', he: 'מלמטה, חבטה מתחת למותן' } },
          { id: 'b', text: { fr: 'Au-dessus de la tête, comme un smash', en: 'Overhead, like a smash', he: 'מעל הראש, כמו סמאש' } },
          { id: 'c', text: { fr: 'N’importe comment', en: 'Any way you like', he: 'בכל דרך' } },
        ],
        correct: 'a',
        explain: {
          fr: 'Le service est obligatoirement frappé par en dessous, balle sous le niveau de la taille.',
          en: 'The serve must be hit underarm, with the ball below waist height.',
          he: 'הפתיחה חייבת להיחבט מלמטה, כשהכדור מתחת לגובה המותן.',
        },
      },
      {
        id: 's2',
        q: {
          fr: 'Avant de frapper son service, le serveur doit…',
          en: 'Before hitting the serve, the server must…',
          he: 'לפני ביצוע הפתיחה, המגיש חייב…',
        },
        options: [
          { id: 'a', text: { fr: 'Faire rebondir la balle au sol une fois', en: 'Bounce the ball on the ground once', he: 'להקפיץ את הכדור על הרצפה פעם אחת' } },
          { id: 'b', text: { fr: 'Lancer la balle en l’air', en: 'Toss the ball in the air', he: 'לזרוק את הכדור לאוויר' } },
          { id: 'c', text: { fr: 'Frapper directement', en: 'Hit it directly', he: 'לחבוט ישירות' } },
        ],
        correct: 'a',
        explain: {
          fr: 'On laisse rebondir la balle au sol derrière la ligne, puis on la frappe sous la taille.',
          en: 'You let the ball bounce on the ground behind the line, then hit it below the waist.',
          he: 'מניחים לכדור להקפיץ על הרצפה מאחורי הקו, ואז חובטים אותו מתחת למותן.',
        },
      },
      {
        id: 's3',
        q: {
          fr: 'Le service doit être envoyé…',
          en: 'The serve must be sent…',
          he: 'הפתיחה צריכה להישלח…',
        },
        options: [
          { id: 'a', text: { fr: 'En diagonale, dans le carré adverse', en: 'Diagonally, into the opposite box', he: 'באלכסון, אל ריבוע היריב' } },
          { id: 'b', text: { fr: 'Tout droit devant soi', en: 'Straight ahead', he: 'ישר קדימה' } },
          { id: 'c', text: { fr: 'Contre la vitre du fond', en: 'Against the back glass', he: 'אל זכוכית הגב' } },
        ],
        correct: 'a',
        explain: {
          fr: 'Comme au tennis, le service est croisé : il doit rebondir dans le carré de service diagonalement opposé.',
          en: 'Like tennis, the serve is cross-court: it must bounce in the diagonally opposite service box.',
          he: 'כמו בטניס, הפתיחה אלכסונית: היא חייבת להקפיץ בריבוע ההגשה האלכסוני הנגדי.',
        },
      },
    ],
  },

  // ── 3. Les murs ──────────────────────────────────────────────────────────
  {
    id: 'walls',
    icon: '🧱',
    title:    { fr: 'Les murs', en: 'The walls', he: 'הקירות' },
    subtitle: { fr: 'La vitre, ton alliée', en: 'The glass is your friend', he: 'הזכוכית — בעלת בריתך' },
    questions: [
      {
        id: 'w1',
        q: {
          fr: 'Pour qu’un coup soit valide, la balle doit d’abord…',
          en: 'For a shot to be valid, the ball must first…',
          he: 'כדי שחבטה תהיה חוקית, הכדור חייב קודם…',
        },
        options: [
          { id: 'a', text: { fr: 'Rebondir au sol du camp adverse avant tout mur', en: 'Bounce on the opponents’ floor before any wall', he: 'להקפיץ על רצפת היריבים לפני כל קיר' } },
          { id: 'b', text: { fr: 'Toucher leur vitre directement', en: 'Hit their glass directly', he: 'לפגוע ישירות בזכוכית שלהם' } },
          { id: 'c', text: { fr: 'Passer par-dessus la cage', en: 'Go over the cage', he: 'לעבור מעל הכלוב' } },
        ],
        correct: 'a',
        explain: {
          fr: 'La balle doit toujours rebondir au sol adverse en premier. L’envoyer directement dans leur mur est une faute.',
          en: 'The ball must always bounce on the opponents’ floor first. Sending it straight into their wall is a fault.',
          he: 'הכדור חייב תמיד להקפיץ קודם על רצפת היריבים. שליחה ישירה לקיר שלהם היא שגיאה.',
        },
      },
      {
        id: 'w2',
        q: {
          fr: 'Dans ton camp, la balle rebondit au sol puis touche ta vitre du fond. Peux-tu la jouer ?',
          en: 'On your side, the ball bounces then hits your back glass. Can you play it?',
          he: 'בצד שלך, הכדור מקפיץ ואז פוגע בזכוכית הגב שלך. מותר לשחק אותו?',
        },
        options: [
          { id: 'a', text: { fr: 'Oui, après le mur tu peux la renvoyer', en: 'Yes, after the wall you can return it', he: 'כן, אחרי הקיר אפשר להחזיר' } },
          { id: 'b', text: { fr: 'Non, c’est perdu', en: 'No, the point is lost', he: 'לא, הנקודה אבודה' } },
          { id: 'c', text: { fr: 'Seulement si elle touche deux murs', en: 'Only if it hits two walls', he: 'רק אם היא פוגעת בשני קירות' } },
        ],
        correct: 'a',
        explain: {
          fr: 'Après un rebond au sol, tu peux laisser la balle aller sur ta propre vitre et la renvoyer : c’est tout l’art de la défense au padel.',
          en: 'After a floor bounce, you can let the ball go onto your own glass and return it — that’s the essence of padel defence.',
          he: 'אחרי הקפצה ברצפה, אפשר לתת לכדור ללכת אל הזכוכית שלך ולהחזיר — זו מהות ההגנה בפאדל.',
        },
      },
    ],
  },

  // ── 4. Les coups clés ────────────────────────────────────────────────────
  {
    id: 'shots',
    icon: '🏓',
    title:    { fr: 'Les coups clés', en: 'Key shots', he: 'חבטות מפתח' },
    subtitle: { fr: 'Volée & bandeja', en: 'Volley & bandeja', he: 'וולי ובנדחה' },
    questions: [
      {
        id: 'sh1',
        q: {
          fr: 'Qu’est-ce que la « bandeja » ?',
          en: 'What is the “bandeja”?',
          he: 'מהי ה"בנדחה"?',
        },
        options: [
          { id: 'a', text: { fr: 'Un smash contrôlé et slicé pour rester au filet', en: 'A controlled, sliced overhead to stay at the net', he: 'סמאש מבוקר וחתוך כדי להישאר ברשת' } },
          { id: 'b', text: { fr: 'Un service spécial', en: 'A special serve', he: 'הגשה מיוחדת' } },
          { id: 'c', text: { fr: 'Une faute volontaire', en: 'A deliberate fault', he: 'שגיאה מכוונת' } },
        ],
        correct: 'a',
        explain: {
          fr: 'La bandeja est un coup haut, frappé en slice, qui privilégie le placement à la puissance pour conserver le filet.',
          en: 'The bandeja is an overhead hit with slice that favours placement over power to keep the net.',
          he: 'הבנדחה היא חבטה גבוהה עם חיתוך שמעדיפה מיקום על פני עוצמה כדי לשמור על הרשת.',
        },
      },
      {
        id: 'sh2',
        q: {
          fr: 'Au padel, quelle est la position la plus avantageuse ?',
          en: 'In padel, what is the most advantageous position?',
          he: 'בפאדל, מהי העמדה המשתלמת ביותר?',
        },
        options: [
          { id: 'a', text: { fr: 'Au filet', en: 'At the net', he: 'ברשת' } },
          { id: 'b', text: { fr: 'Au fond du terrain', en: 'At the back', he: 'בעומק המגרש' } },
          { id: 'c', text: { fr: 'Collé à la vitre', en: 'Glued to the glass', he: 'צמוד לזכוכית' } },
        ],
        correct: 'a',
        explain: {
          fr: 'L’équipe qui contrôle le filet dicte le jeu. Tout l’objectif est de monter et d’y rester.',
          en: 'The team that controls the net dictates the rally. The whole goal is to move up and stay there.',
          he: 'הקבוצה ששולטת ברשת מכתיבה את המשחק. כל המטרה היא לעלות ולהישאר שם.',
        },
      },
      {
        id: 'sh3',
        q: {
          fr: 'Pourquoi préférer une bandeja à un smash très puissant ?',
          en: 'Why prefer a bandeja over a very powerful smash?',
          he: 'מדוע להעדיף בנדחה על פני סמאש עוצמתי מאוד?',
        },
        options: [
          { id: 'a', text: { fr: 'Pour garder le contrôle et sa position au filet', en: 'To keep control and your net position', he: 'כדי לשמור על שליטה ועל העמדה ברשת' } },
          { id: 'b', text: { fr: 'Parce que c’est interdit de smasher', en: 'Because smashing is forbidden', he: 'כי אסור לסמש' } },
          { id: 'c', text: { fr: 'Pour gagner plus de points directs', en: 'To win more outright points', he: 'כדי לזכות ביותר נקודות ישירות' } },
        ],
        correct: 'a',
        explain: {
          fr: 'Un smash raté te renvoie au fond. La bandeja sécurise le point et te maintient en position dominante.',
          en: 'A missed smash sends you to the back. The bandeja secures the point and keeps you dominant.',
          he: 'סמאש כושל מחזיר אותך לעומק. הבנדחה מאבטחת את הנקודה ושומרת עליך בעמדת שליטה.',
        },
      },
    ],
  },

  // ── 5. Tactique ──────────────────────────────────────────────────────────
  {
    id: 'tactics',
    icon: '🧠',
    title:    { fr: 'Tactique', en: 'Tactics', he: 'טקטיקה' },
    subtitle: { fr: 'Jouer en équipe', en: 'Play as a team', he: 'לשחק כצוות' },
    questions: [
      {
        id: 't1',
        q: {
          fr: 'À quoi sert le lob (globe) ?',
          en: 'What is the lob used for?',
          he: 'למה משמש הלוב?',
        },
        options: [
          { id: 'a', text: { fr: 'Faire reculer les adversaires et prendre le filet', en: 'Push opponents back and take the net', he: 'להרחיק את היריבים ולתפוס את הרשת' } },
          { id: 'b', text: { fr: 'Gagner du temps pour souffler', en: 'Buy time to catch your breath', he: 'להרוויח זמן לנשום' } },
          { id: 'c', text: { fr: 'Faire un point direct à coup sûr', en: 'Guarantee an outright winner', he: 'להבטיח נקודה ישירה' } },
        ],
        correct: 'a',
        explain: {
          fr: 'Un bon lob passe au-dessus des adversaires au filet, les oblige à reculer et te laisse monter à ta place.',
          en: 'A good lob goes over the netting opponents, forces them back and lets you move up.',
          he: 'לוב טוב עובר מעל היריבים ברשת, מאלץ אותם לסגת ומאפשר לך לעלות.',
        },
      },
      {
        id: 't2',
        q: {
          fr: 'Une cible efficace pour semer le doute dans l’équipe adverse ?',
          en: 'An effective target to sow doubt in the opposing team?',
          he: 'מטרה יעילה לזריעת ספק בקבוצה היריבה?',
        },
        options: [
          { id: 'a', text: { fr: 'Le centre, entre les deux joueurs', en: 'The middle, between both players', he: 'המרכז, בין שני השחקנים' } },
          { id: 'b', text: { fr: 'Toujours sur le meilleur joueur', en: 'Always at the best player', he: 'תמיד על השחקן הטוב ביותר' } },
          { id: 'c', text: { fr: 'Le plafond', en: 'The ceiling', he: 'התקרה' } },
        ],
        correct: 'a',
        explain: {
          fr: 'Viser le centre crée l’hésitation : « à toi / à moi ». C’est une arme tactique classique en double.',
          en: 'Aiming down the middle creates hesitation: “yours / mine”. It’s a classic doubles weapon.',
          he: 'כיוון למרכז יוצר היסוס: "שלך / שלי". זה נשק קלאסי במשחק זוגות.',
        },
      },
      {
        id: 't3',
        q: {
          fr: 'Dans un cas normal, comment doivent se déplacer les deux coéquipiers ?',
          en: 'In a normal situation, how should the two teammates move?',
          he: 'במצב רגיל, כיצד צריכים שני השחקנים להתנייד?',
        },
        options: [
          { id: 'a', text: { fr: 'Ensemble : monter et descendre en même temps', en: 'Together: move up and back at the same time', he: 'יחד: לעלות ולרדת בו-זמנית' } },
          { id: 'b', text: { fr: 'Chacun de son côté, indépendamment', en: 'Each independently on their side', he: 'כל אחד בצד שלו, באופן עצמאי' } },
          { id: 'c', text: { fr: 'L’un au filet, l’autre au fond', en: 'One at the net while the other defends at the back', he: 'אחד ברשת, השני בעומק' } },
        ],
        correct: 'a',
        explain: {
          fr: 'Monter ensemble au filet permet d’étouffer les adversaires : ils commettent plus de fautes et tu peux finir le point avec un smash ou un coup bien placé.',
          en: 'Moving up to the net together suffocates opponents: they make more errors and you can finish the point with a smash or a well-placed shot.',
          he: 'עלייה ביחד לרשת חונקת את היריבים: הם עושים יותר שגיאות ואפשר לסיים את הנקודה עם סמאש או חבטה ממוקמת היטב.',
        },
      },
      {
        id: 't4',
        q: {
          fr: 'Environ quel pourcentage des points est gagné au filet au padel ?',
          en: 'Roughly what percentage of points is won at the net in padel?',
          he: 'בערך איזה אחוז מהנקודות מנוצח ברשת בפאדל?',
        },
        options: [
          { id: 'a', text: { fr: '80 %', en: '80 %', he: '80%' } },
          { id: 'b', text: { fr: '50 %', en: '50 %', he: '50%' } },
          { id: 'c', text: { fr: '30 %', en: '30 %', he: '30%' } },
        ],
        correct: 'a',
        explain: {
          fr: 'Environ 80 % des points se gagnent au filet. C’est pourquoi le lob long est une arme clé : il permet de récupérer le contrôle du filet quand on est repoussé au fond.',
          en: 'Around 80 % of points are won at the net. That’s why a long lob is a key weapon: it lets you recover the net when pushed to the back.',
          he: 'כ-80% מהנקודות מנוצחות ברשת. לכן לוב ארוך הוא נשק מפתח: הוא מאפשר לך לחזור לשליטה ברשת כשנדחקת לעומק.',
        },
      },
      {
        id: 't5',
        q: {
          fr: 'Comment la majorité des points se gagnent-ils au haut niveau ?',
          en: 'How are most points won at the top level?',
          he: 'כיצד רוב הנקודות מנוצחות ברמה הגבוהה?',
        },
        options: [
          { id: 'a', text: { fr: 'Sur des fautes directes de l’adversaire (~80 %)', en: 'On the opponent\'s direct errors (~80 %)', he: 'על שגיאות ישירות של היריב (~80%)' } },
          { id: 'b', text: { fr: 'Sur des coups gagnants spectaculaires (~80 %)', en: 'On spectacular winners (~80 %)', he: 'על חבטות זוכות מרהיבות (~80%)' } },
          { id: 'c', text: { fr: 'Sur des aces de service (~80 %)', en: 'On service aces (~80 %)', he: 'על אייסים בהגשה (~80%)' } },
        ],
        correct: 'a',
        explain: {
          fr: 'Les stats montrent qu’environ 80 % des points se gagnent sur des fautes adverses, pas sur des coups extraordinaires. Remettre la balle une fois de plus que l’adversaire suffit. La patience gagne les matchs.',
          en: 'Stats show ~80 % of points are won on opponent errors, not brilliant winners. Returning the ball one more time than your opponent is enough. Patience wins matches.',
          he: 'הסטטיסטיקות מראות שכ-80% מהנקודות מנוצחות על שגיאות היריב, לא על חבטות יוצאות דופן. להחזיר את הכדור פעם אחת יותר מהיריב מספיק. סבלנות מנצחת משחקים.',
        },
      },
    ],
  },

  // ── 6. Coups avancés ─────────────────────────────────────────────────────
  {
    id: 'advanced',
    icon: '🐍',
    title:    { fr: 'Coups avancés', en: 'Advanced shots', he: 'חבטות מתקדמות' },
    subtitle: { fr: 'Vibora & point d’or', en: 'Vibora & golden point', he: 'ויברה ונקודת זהב' },
    questions: [
      {
        id: 'a1',
        q: {
          fr: 'Qu’est-ce que la « vibora » ?',
          en: 'What is the “vibora”?',
          he: 'מהי ה"ויברה"?',
        },
        options: [
          { id: 'a', text: { fr: 'Un coup haut, slicé et agressif, avec effet latéral', en: 'A high, sliced, aggressive shot with side-spin', he: 'חבטה גבוהה, חתוכה ואגרסיבית עם סיבוב צידי' } },
          { id: 'b', text: { fr: 'Un type de prise de raquette', en: 'A type of grip', he: 'סוג של אחיזה' } },
          { id: 'c', text: { fr: 'Une défense au fond', en: 'A back-court defence', he: 'הגנה בעומק' } },
        ],
        correct: 'a',
        explain: {
          fr: 'La vibora est plus agressive que la bandeja : frappée haut avec un effet coupé/latéral qui rend le rebond difficile.',
          en: 'The vibora is more aggressive than the bandeja: hit high with slice/side-spin that makes the bounce awkward.',
          he: 'הויברה אגרסיבית יותר מהבנדחה: נחבטת גבוה עם חיתוך/סיבוב צידי שמקשה על ההקפצה.',
        },
      },
      {
        id: 'a2',
        q: {
          fr: 'Le « point d’or » (punto de oro) se joue…',
          en: 'The “golden point” (punto de oro) is played…',
          he: 'נקודת הזהב (punto de oro) משוחקת…',
        },
        options: [
          { id: 'a', text: { fr: 'À égalité (40-40) : un seul point décisif', en: 'At deuce (40-40): one single deciding point', he: 'בשוויון (40-40): נקודה מכרעת אחת' } },
          { id: 'b', text: { fr: 'Au début de chaque set', en: 'At the start of each set', he: 'בתחילת כל מערכה' } },
          { id: 'c', text: { fr: 'Seulement en finale', en: 'Only in the final', he: 'רק בגמר' } },
        ],
        correct: 'a',
        explain: {
          fr: 'À 40-40, au lieu des avantages, on joue UN point décisif. L’équipe qui reçoit choisit le côté. Très courant en compétition.',
          en: 'At 40-40, instead of advantages, ONE deciding point is played. The receiving team picks the side. Very common in competition.',
          he: 'ב-40-40, במקום יתרונות, משחקים נקודה מכרעת אחת. הקבוצה המקבלת בוחרת צד. נפוץ מאוד בתחרויות.',
        },
      },
      {
        id: 'a3',
        q: {
          fr: 'Pour un joueur côté gauche, quel coup prioriser si la balle adverse atterrit au milieu du terrain ?',
          en: 'For a left-side player, which shot to prioritise if the ball lands in the middle of the court?',
          he: 'לשחקן בצד שמאל, איזו חבטה לתעדף אם הכדור נוחת במרכז המגרש?',
        },
        options: [
          { id: 'a', text: { fr: 'La vibora', en: 'The vibora', he: 'הויברה' } },
          { id: 'b', text: { fr: 'La bandeja', en: 'The bandeja', he: 'הבנדחה' } },
          { id: 'c', text: { fr: 'Le lob défensif', en: 'The defensive lob', he: 'לוב הגנתי' } },
        ],
        correct: 'a',
        explain: {
          fr: 'Balle au centre côté gauche → vibora : plus d’angle et d’agressivité. Si la balle tombe plus à gauche (côté revers), on préférera la bandeja, plus contrôlée et qui permet de rester au filet.',
          en: 'Ball in the centre on the left side → vibora: more angle and aggression. If the ball falls further left (backhand side), the bandeja is preferred: more control and keeps you at the net.',
          he: 'כדור במרכז בצד שמאל → ויברה: יותר זווית ואגרסיביות. אם הכדור נופל יותר שמאלה (צד בקהנד), מועדפת הבנדחה: יותר שליטה ושמירה על הרשת.',
        },
      },
      {
        id: 'a4',
        q: {
          fr: 'Qu’est-ce que la « chiquita » ?',
          en: 'What is the "chiquita"?',
          he: 'מהי ה“צ’יקיטה”?',
        },
        options: [
          { id: 'a', text: { fr: 'Une balle lente qui plonge dans les pieds des adversaires au filet', en: 'A slow ball that dips at the opponents’ feet when they’re at the net', he: 'כדור איטי שצולל לכפות הרגליים של היריבים ברשת' } },
          { id: 'b', text: { fr: 'Un smash très court vers le filet adverse', en: 'A very short smash towards the opponents’ net', he: 'סמאש קצר מאוד לכיוון רשת היריב' } },
          { id: 'c', text: { fr: 'Un lob très haut joué depuis le fond', en: 'A very high lob played from the back', he: 'לוב גבוה מאוד שמשוחק מהעומק' } },
        ],
        correct: 'a',
        explain: {
          fr: 'La chiquita est un coup tactique : balle lente qui plonge dans les pieds des adversaires au filet. Ils sont obligés de frapper de bas en haut, ce qui t’offre une volée agressive pour conclure le point.',
          en: 'The chiquita is a tactical shot: a slow ball that dips at the opponents’ feet at the net. They’re forced to hit upward, giving you an easy aggressive volley to finish the point.',
          he: 'הצ’יקיטה היא חבטה טקטית: כדור איטי שצולל לכפות הרגליים של היריבים ברשת. הם מאולצים לחבוט מלמטה למעלה, מה שמעניק לך וולי אגרסיבי קל לסיים את הנקודה.',
        },
      },
    ],
  },
]

/** Nombre total de questions (utile pour les stats globales). */
export const TOTAL_QUESTIONS = QUIZ_CHAPTERS.reduce((n, c) => n + c.questions.length, 0)
