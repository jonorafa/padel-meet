-- ============================================================================
-- CHANTIER 7 — 50 Profils Démo
-- ============================================================================
-- Crée 50 profils fictifs dans la table profiles pour remplir l'app au début.
-- - Noms israéliens / français / américains mixtes
-- - Pas de photo de profil (photo_url = NULL)
-- - Levels variés 1.0 à 7.0
-- - Cities israéliennes
-- - partner_prefs JSONB variés
-- - Flag is_demo = TRUE pour pouvoir les supprimer facilement plus tard
--
-- Important : ces profils n'ont PAS de auth.users associé. Ils existent
-- uniquement dans la table profiles. Ils ne peuvent pas se connecter.
-- Quand un vrai user swipe droite sur eux, le match est créé mais ils
-- ne répondent jamais aux messages (ce sont juste des profils statiques).
--
-- À exécuter dans Supabase SQL Editor (postgres role bypass RLS).
-- Idempotent : ré-exécutable sans casser l'existant.
-- ============================================================================


-- ── 1. Ajouter la colonne is_demo si elle n'existe pas ─────────────────────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_demo BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_profiles_is_demo ON public.profiles(is_demo)
  WHERE is_demo = TRUE;

COMMENT ON COLUMN public.profiles.is_demo IS
  'TRUE pour les profils démo (pas de auth.users associé). À supprimer pour le launch public.';


-- ── 2. Supprimer les anciens démos avant de re-seed (idempotence) ──────────
DELETE FROM public.profiles WHERE is_demo = TRUE;


-- ── 3. Insertion des 50 profils démo ───────────────────────────────────────
-- Les UUIDs sont fixes pour reproducibilité (mêmes IDs à chaque exécution)

INSERT INTO public.profiles (
  id, name, age, city, region, level, confidence_rate,
  dominant_hand, preferred_side, play_style, motivation, frequency,
  bio_fr, bio_en, bio_he, photo_url,
  online, last_seen, matches_played, wins,
  partner_prefs, is_demo, created_at
) VALUES

-- ─── Tel Aviv ───────────────────────────────────────────────────────────────
('11111111-1111-1111-1111-000000000001', 'Or Levy',          28, 'Tel Aviv',  'Centre', 5.5, 72,
 'right', 'forehand', 'aggressive',  'compete',  4,
 'Joueur compétitif depuis 6 ans. Tournois locaux le weekend.',
 'Competitive player for 6 years. Local tournaments on weekends.',
 'שחקן תחרותי כבר 6 שנים. טורנירים מקומיים בסופי שבוע.',
 NULL, TRUE, NOW() - INTERVAL '2 minutes', 42, 27,
 '{"side":"any","hand":"right","style":"aggressive","region":"Centre","levelMin":5,"levelMax":7}'::jsonb,
 TRUE, NOW() - INTERVAL '15 days'),

('11111111-1111-1111-1111-000000000002', 'Dan Bensimon',     31, 'Tel Aviv',  'Centre', 4.5, 68,
 'right', 'backhand', 'all-court',  'improve',  3,
 'Padel après le boulot, 3 fois par semaine. Niveau moyen, motivé.',
 'Padel after work, 3x a week. Mid level, motivated.',
 'פאדל אחרי העבודה, 3 פעמים בשבוע. רמה בינונית, מוטיבציה.',
 NULL, TRUE, NOW() - INTERVAL '1 hour', 18, 11,
 '{"side":"any","hand":"any","style":"all-court","region":"Centre","levelMin":4,"levelMax":5}'::jsonb,
 TRUE, NOW() - INTERVAL '12 days'),

('11111111-1111-1111-1111-000000000003', 'Sarah Cohen',      26, 'Tel Aviv',  'Centre', 6.0, 81,
 'right', 'forehand', 'aggressive', 'compete',  5,
 'Ancienne tenniswoman reconvertie. Cherche un niveau 6+ stable.',
 'Former tennis player. Looking for stable 6+ level.',
 'שחקנית טניס לשעבר. מחפשת שותפ/ה ברמה 6+.',
 NULL, FALSE, NOW() - INTERVAL '3 hours', 65, 44,
 '{"side":"any","hand":"any","style":"any","region":"Centre","levelMin":6,"levelMax":7}'::jsonb,
 TRUE, NOW() - INTERVAL '20 days'),

('11111111-1111-1111-1111-000000000004', 'Michael Levi',     34, 'Tel Aviv',  'Centre', 3.5, 55,
 'left',  'backhand', 'defensive',  'fun',      2,
 'Padel pour le plaisir, le dimanche matin. Pas trop sérieux.',
 'Padel for fun, Sunday mornings. Not too serious.',
 'פאדל בשביל הכיף, ראשון בבוקר. לא רציני מדי.',
 NULL, FALSE, NOW() - INTERVAL '1 day', 8, 3,
 '{"side":"any","hand":"any","style":"any","region":"Centre","levelMin":2,"levelMax":5}'::jsonb,
 TRUE, NOW() - INTERVAL '8 days'),

('11111111-1111-1111-1111-000000000005', 'Yael Mizrahi',     29, 'Tel Aviv',  'Centre', 5.0, 70,
 'right', 'forehand', 'all-court',  'improve',  4,
 'Padel 4 fois par semaine. Coup droit solide, revers à travailler.',
 'Padel 4x a week. Solid forehand, working on backhand.',
 'פאדל 4 פעמים בשבוע. ימני חזק, שמאלי בתהליך.',
 NULL, TRUE, NOW() - INTERVAL '5 minutes', 32, 19,
 '{"side":"forehand","hand":"right","style":"all-court","region":"Centre","levelMin":4,"levelMax":6}'::jsonb,
 TRUE, NOW() - INTERVAL '18 days'),

-- ─── Herzliya ──────────────────────────────────────────────────────────────
('11111111-1111-1111-1111-000000000006', 'David Azoulay',    37, 'Herzliya',  'Centre', 6.5, 85,
 'right', 'forehand', 'aggressive', 'compete',  5,
 'Joueur 6.5, compétitions régionales. Cherche partenaire de double sérieux.',
 'Player 6.5, regional comps. Looking for serious doubles partner.',
 'שחקן 6.5, תחרויות אזוריות. מחפש שותף רציני.',
 NULL, TRUE, NOW() - INTERVAL '8 minutes', 88, 62,
 '{"side":"any","hand":"any","style":"aggressive","region":"Centre","levelMin":6,"levelMax":7}'::jsonb,
 TRUE, NOW() - INTERVAL '25 days'),

('11111111-1111-1111-1111-000000000007', 'Maya Edery',       24, 'Herzliya',  'Centre', 3.0, 50,
 'right', 'backhand', 'defensive',  'improve',  2,
 'Débutante depuis 8 mois. Très motivée pour progresser.',
 'Beginner since 8 months. Very motivated to improve.',
 'מתחילה 8 חודשים. מאוד מוטיבציה להתקדם.',
 NULL, FALSE, NOW() - INTERVAL '6 hours', 6, 2,
 '{"side":"any","hand":"any","style":"any","region":"Centre","levelMin":2,"levelMax":4}'::jsonb,
 TRUE, NOW() - INTERVAL '5 days'),

('11111111-1111-1111-1111-000000000008', 'Tom Cohen',        32, 'Herzliya',  'Centre', 4.0, 60,
 'right', 'forehand', 'all-court',  'fun',      3,
 'Padel le weekend, ambiance détendue avant tout.',
 'Padel on weekends, relaxed vibe above all.',
 'פאדל בסופ"ש, אווירה רגועה.',
 NULL, FALSE, NOW() - INTERVAL '4 days', 22, 12,
 '{"side":"any","hand":"any","style":"any","region":"any","levelMin":3,"levelMax":5}'::jsonb,
 TRUE, NOW() - INTERVAL '10 days'),

('11111111-1111-1111-1111-000000000009', 'Noa Benhamou',     30, 'Herzliya',  'Centre', 5.5, 73,
 'left',  'forehand', 'aggressive', 'compete',  4,
 'Gauchère, jeu offensif. Cherche un droitier complémentaire.',
 'Lefty, offensive game. Looking for a complementary righty.',
 'שמאלית, משחק התקפי. מחפשת ימני משלים.',
 NULL, TRUE, NOW() - INTERVAL '20 minutes', 51, 34,
 '{"side":"forehand","hand":"right","style":"all-court","region":"Centre","levelMin":5,"levelMax":7}'::jsonb,
 TRUE, NOW() - INTERVAL '22 days'),

('11111111-1111-1111-1111-000000000010', 'Itai Mizrahi',     27, 'Herzliya',  'Centre', 4.5, 65,
 'right', 'backhand', 'defensive',  'improve',  3,
 'Revers solide, je cherche à équilibrer mon jeu côté droit.',
 'Strong backhand, want to balance my forehand side.',
 'שמאלי חזק, רוצה לאזן את הימני.',
 NULL, FALSE, NOW() - INTERVAL '2 days', 19, 9,
 '{"side":"forehand","hand":"any","style":"all-court","region":"Centre","levelMin":4,"levelMax":5}'::jsonb,
 TRUE, NOW() - INTERVAL '14 days'),

-- ─── Ramat Gan / Givatayim ─────────────────────────────────────────────────
('11111111-1111-1111-1111-000000000011', 'Ella Sebbag',      33, 'Ramat Gan', 'Centre', 5.0, 71,
 'right', 'forehand', 'all-court',  'improve',  4,
 'Padel 4 fois/semaine. Recherche entrainement structuré.',
 'Padel 4x a week. Looking for structured training.',
 'פאדל 4 פעמים בשבוע. מחפשת אימון מובנה.',
 NULL, TRUE, NOW() - INTERVAL '30 minutes', 38, 24,
 '{"side":"any","hand":"any","style":"all-court","region":"Centre","levelMin":4,"levelMax":6}'::jsonb,
 TRUE, NOW() - INTERVAL '16 days'),

('11111111-1111-1111-1111-000000000012', 'Adam Cohen',       38, 'Ramat Gan', 'Centre', 6.0, 78,
 'right', 'forehand', 'aggressive', 'compete',  4,
 'Niveau 6, technique solide. Préfère le filet.',
 'Level 6, solid technique. Prefer the net.',
 'רמה 6, טכניקה טובה. מעדיף את הרשת.',
 NULL, FALSE, NOW() - INTERVAL '12 hours', 73, 51,
 '{"side":"any","hand":"any","style":"aggressive","region":"Centre","levelMin":5,"levelMax":7}'::jsonb,
 TRUE, NOW() - INTERVAL '28 days'),

('11111111-1111-1111-1111-000000000013', 'Léa Touitou',      25, 'Ramat Gan', 'Centre', 3.5, 58,
 'right', 'backhand', 'defensive',  'fun',      2,
 'Je joue depuis un an, ambiance fun, pas de stress.',
 'Playing for a year, fun vibe, no stress.',
 'משחקת שנה, אווירה כייפית.',
 NULL, FALSE, NOW() - INTERVAL '3 days', 11, 5,
 '{"side":"any","hand":"any","style":"any","region":"Centre","levelMin":3,"levelMax":4}'::jsonb,
 TRUE, NOW() - INTERVAL '7 days'),

('11111111-1111-1111-1111-000000000014', 'Roy Hadad',        29, 'Ramat Gan', 'Centre', 5.5, 75,
 'right', 'forehand', 'aggressive', 'compete',  5,
 'Ex-tennis, padel 5x/sem. Sérieux mais convivial.',
 'Ex-tennis, padel 5x/week. Serious but friendly.',
 'לשעבר טניס, פאדל 5/שבוע. רציני אך ידידותי.',
 NULL, TRUE, NOW() - INTERVAL '1 minute', 47, 33,
 '{"side":"any","hand":"any","style":"any","region":"Centre","levelMin":5,"levelMax":7}'::jsonb,
 TRUE, NOW() - INTERVAL '19 days'),

('11111111-1111-1111-1111-000000000015', 'Lior Amar',        31, 'Ramat Gan', 'Centre', 4.5, 64,
 'left',  'forehand', 'all-court',  'fun',      3,
 'Gaucher, je m''adapte à tous les styles.',
 'Lefty, I adapt to all styles.',
 'שמאלי, מתאים לכל סגנון.',
 NULL, FALSE, NOW() - INTERVAL '5 days', 24, 13,
 '{"side":"any","hand":"any","style":"any","region":"any","levelMin":3,"levelMax":6}'::jsonb,
 TRUE, NOW() - INTERVAL '13 days'),

-- ─── Kfar Saba ─────────────────────────────────────────────────────────────
('11111111-1111-1111-1111-000000000016', 'Talia Sebag',      35, 'Kfar Saba', 'Centre', 4.0, 62,
 'right', 'backhand', 'defensive',  'improve',  3,
 'Maman padel, séances matinales. Cherche partenaires patientes.',
 'Padel mom, morning sessions. Looking for patient partners.',
 'אמא פאדל, אימוני בוקר.',
 NULL, FALSE, NOW() - INTERVAL '8 hours', 16, 8,
 '{"side":"any","hand":"any","style":"defensive","region":"Centre","levelMin":3,"levelMax":5}'::jsonb,
 TRUE, NOW() - INTERVAL '11 days'),

('11111111-1111-1111-1111-000000000017', 'Ben Asraf',        28, 'Kfar Saba', 'Centre', 5.0, 69,
 'right', 'forehand', 'all-court',  'improve',  4,
 'Niveau 5 progression rapide. Cherche partenaires plus forts.',
 'Level 5 fast progress. Looking for stronger partners.',
 'רמה 5 מתקדם מהר. מחפש שותפים חזקים יותר.',
 NULL, TRUE, NOW() - INTERVAL '12 minutes', 29, 17,
 '{"side":"any","hand":"any","style":"any","region":"Centre","levelMin":5,"levelMax":7}'::jsonb,
 TRUE, NOW() - INTERVAL '15 days'),

('11111111-1111-1111-1111-000000000018', 'Mia Levin',        26, 'Kfar Saba', 'Centre', 3.0, 52,
 'right', 'forehand', 'defensive',  'fun',      2,
 'Je découvre le padel, j''adore ! Ouverte à tous niveaux.',
 'Discovering padel, I love it! Open to all levels.',
 'מגלה את הפאדל, אני אוהבת!',
 NULL, FALSE, NOW() - INTERVAL '2 days', 7, 2,
 '{"side":"any","hand":"any","style":"any","region":"any","levelMin":1,"levelMax":4}'::jsonb,
 TRUE, NOW() - INTERVAL '4 days'),

('11111111-1111-1111-1111-000000000019', 'Nathan Ohayon',    40, 'Kfar Saba', 'Centre', 5.5, 76,
 'right', 'backhand', 'aggressive', 'compete',  4,
 '40 ans, niveau 5.5, joue en tournoi vétéran.',
 '40yo, level 5.5, plays in veteran tournaments.',
 'בן 40, רמה 5.5, טורנירים ותיקים.',
 NULL, TRUE, NOW() - INTERVAL '45 minutes', 96, 67,
 '{"side":"any","hand":"any","style":"any","region":"Centre","levelMin":5,"levelMax":7}'::jsonb,
 TRUE, NOW() - INTERVAL '30 days'),

('11111111-1111-1111-1111-000000000020', 'Eden Maman',       23, 'Kfar Saba', 'Centre', 4.0, 60,
 'left',  'forehand', 'all-court',  'improve',  3,
 'Étudiante, padel le soir. Gauchère qui aime jouer au filet.',
 'Student, padel in evenings. Lefty who loves the net.',
 'סטודנטית, פאדל בערב.',
 NULL, FALSE, NOW() - INTERVAL '1 day', 14, 7,
 '{"side":"any","hand":"any","style":"all-court","region":"any","levelMin":3,"levelMax":5}'::jsonb,
 TRUE, NOW() - INTERVAL '9 days'),

-- ─── Netanya ───────────────────────────────────────────────────────────────
('11111111-1111-1111-1111-000000000021', 'Yoni Lévi',        33, 'Netanya',   'Centre', 5.0, 68,
 'right', 'forehand', 'all-court',  'fun',      3,
 'Padel weekend en famille. Ambiance avant tout.',
 'Family padel weekends. Vibe first.',
 'פאדל משפחתי בסופ"ש.',
 NULL, FALSE, NOW() - INTERVAL '6 hours', 33, 18,
 '{"side":"any","hand":"any","style":"any","region":"any","levelMin":3,"levelMax":6}'::jsonb,
 TRUE, NOW() - INTERVAL '17 days'),

('11111111-1111-1111-1111-000000000022', 'Chloe Knafo',      27, 'Netanya',   'Centre', 4.5, 66,
 'right', 'backhand', 'defensive',  'improve',  4,
 'Padel 4x/sem, gros travail sur la régularité.',
 'Padel 4x/week, working on consistency.',
 'פאדל 4 בשבוע, עובדת על עקביות.',
 NULL, TRUE, NOW() - INTERVAL '4 minutes', 28, 15,
 '{"side":"any","hand":"any","style":"all-court","region":"Centre","levelMin":4,"levelMax":6}'::jsonb,
 TRUE, NOW() - INTERVAL '12 days'),

('11111111-1111-1111-1111-000000000023', 'Yair Ben-David',   36, 'Netanya',   'Centre', 6.0, 80,
 'right', 'forehand', 'aggressive', 'compete',  5,
 'Niveau 6, joueur de filet agressif. Smashs et volées.',
 'Level 6, aggressive net player. Smashes and volleys.',
 'רמה 6, רשתי אגרסיבי.',
 NULL, FALSE, NOW() - INTERVAL '2 hours', 81, 56,
 '{"side":"backhand","hand":"right","style":"all-court","region":"Centre","levelMin":5,"levelMax":7}'::jsonb,
 TRUE, NOW() - INTERVAL '26 days'),

('11111111-1111-1111-1111-000000000024', 'Romy Aflalo',      29, 'Netanya',   'Centre', 4.0, 61,
 'right', 'forehand', 'all-court',  'fun',      2,
 'Padel détente, 2 fois par semaine.',
 'Relaxed padel, 2x a week.',
 'פאדל מרגיע, 2 פעמים בשבוע.',
 NULL, FALSE, NOW() - INTERVAL '3 days', 13, 6,
 '{"side":"any","hand":"any","style":"any","region":"any","levelMin":3,"levelMax":5}'::jsonb,
 TRUE, NOW() - INTERVAL '8 days'),

('11111111-1111-1111-1111-000000000025', 'Avi Sasson',       42, 'Netanya',   'Centre', 5.5, 74,
 'left',  'backhand', 'defensive',  'compete',  4,
 'Gaucher vétéran. Stratégie et placement.',
 'Veteran lefty. Strategy and placement.',
 'שמאלי ותיק. אסטרטגיה ומיקום.',
 NULL, TRUE, NOW() - INTERVAL '25 minutes', 102, 71,
 '{"side":"forehand","hand":"right","style":"all-court","region":"Centre","levelMin":5,"levelMax":7}'::jsonb,
 TRUE, NOW() - INTERVAL '32 days'),

-- ─── Haifa (Nord) ──────────────────────────────────────────────────────────
('11111111-1111-1111-1111-000000000026', 'Jade Pinto',       28, 'Haifa',     'Nord',   4.5, 67,
 'right', 'forehand', 'all-court',  'improve',  3,
 'Padel sur Haifa, cherche du monde dans le Nord !',
 'Padel in Haifa, looking for players in the North!',
 'פאדל בחיפה, מחפשת שחקנים בצפון!',
 NULL, FALSE, NOW() - INTERVAL '4 hours', 21, 12,
 '{"side":"any","hand":"any","style":"any","region":"Nord","levelMin":3,"levelMax":6}'::jsonb,
 TRUE, NOW() - INTERVAL '15 days'),

('11111111-1111-1111-1111-000000000027', 'Eyal Shaked',      30, 'Haifa',     'Nord',   5.0, 70,
 'right', 'backhand', 'aggressive', 'compete',  4,
 'Niveau 5, beaucoup d''énergie. Compétitions locales.',
 'Level 5, lots of energy. Local comps.',
 'רמה 5, הרבה אנרגיה.',
 NULL, TRUE, NOW() - INTERVAL '15 minutes', 41, 26,
 '{"side":"any","hand":"any","style":"all-court","region":"Nord","levelMin":4,"levelMax":6}'::jsonb,
 TRUE, NOW() - INTERVAL '20 days'),

('11111111-1111-1111-1111-000000000028', 'Sasha Dahan',      25, 'Haifa',     'Nord',   3.5, 56,
 'right', 'forehand', 'defensive',  'fun',      2,
 'Début padel, j''apprends. Tolérante avec les autres débutants.',
 'New to padel, learning. Patient with other beginners.',
 'התחלתי פאדל, סבלנית.',
 NULL, FALSE, NOW() - INTERVAL '2 days', 9, 4,
 '{"side":"any","hand":"any","style":"any","region":"Nord","levelMin":2,"levelMax":4}'::jsonb,
 TRUE, NOW() - INTERVAL '6 days'),

('11111111-1111-1111-1111-000000000029', 'Idan Buzaglo',     34, 'Haifa',     'Nord',   5.5, 73,
 'right', 'forehand', 'aggressive', 'improve',  4,
 'Joueur sérieux 5.5, technique et tactique.',
 'Serious 5.5 player, technique and tactics.',
 'שחקן רציני 5.5.',
 NULL, FALSE, NOW() - INTERVAL '7 hours', 56, 38,
 '{"side":"any","hand":"any","style":"aggressive","region":"Nord","levelMin":5,"levelMax":7}'::jsonb,
 TRUE, NOW() - INTERVAL '23 days'),

('11111111-1111-1111-1111-000000000030', 'Léna Saada',       31, 'Haifa',     'Nord',   4.0, 60,
 'right', 'backhand', 'all-court',  'fun',      3,
 'Padel régulier, ambiance détendue.',
 'Regular padel, chilled vibe.',
 'פאדל קבוע, אווירה רגועה.',
 NULL, FALSE, NOW() - INTERVAL '1 day', 17, 9,
 '{"side":"any","hand":"any","style":"any","region":"Nord","levelMin":3,"levelMax":5}'::jsonb,
 TRUE, NOW() - INTERVAL '11 days'),

-- ─── Jerusalem (Sud) ───────────────────────────────────────────────────────
('11111111-1111-1111-1111-000000000031', 'Omer Peretz',      29, 'Jerusalem', 'Sud',    4.5, 65,
 'right', 'forehand', 'all-court',  'improve',  3,
 'Padel à Jerusalem, on est peu — cherche des partenaires !',
 'Padel in Jerusalem, few of us — looking for partners!',
 'פאדל בירושלים, מעטים אנחנו.',
 NULL, TRUE, NOW() - INTERVAL '6 minutes', 22, 12,
 '{"side":"any","hand":"any","style":"any","region":"Sud","levelMin":3,"levelMax":6}'::jsonb,
 TRUE, NOW() - INTERVAL '14 days'),

('11111111-1111-1111-1111-000000000032', 'Tamar Biton',      27, 'Jerusalem', 'Sud',    3.5, 55,
 'right', 'backhand', 'defensive',  'fun',      2,
 'Padel le shabbat soir, niveau intermédiaire débutant.',
 'Padel on shabbat evenings, beginner-intermediate.',
 'פאדל במוצ"ש.',
 NULL, FALSE, NOW() - INTERVAL '3 days', 11, 5,
 '{"side":"any","hand":"any","style":"any","region":"Sud","levelMin":2,"levelMax":4}'::jsonb,
 TRUE, NOW() - INTERVAL '7 days'),

('11111111-1111-1111-1111-000000000033', 'Liam Ben-Hamou',   35, 'Jerusalem', 'Sud',    5.0, 68,
 'left',  'forehand', 'aggressive', 'compete',  4,
 'Gaucher offensif. Préfère le filet et les coups droits puissants.',
 'Offensive lefty. Prefer net and powerful forehands.',
 'שמאלי התקפי.',
 NULL, TRUE, NOW() - INTERVAL '18 minutes', 44, 29,
 '{"side":"backhand","hand":"right","style":"defensive","region":"Sud","levelMin":4,"levelMax":6}'::jsonb,
 TRUE, NOW() - INTERVAL '21 days'),

('11111111-1111-1111-1111-000000000034', 'Shira Elbaz',      32, 'Jerusalem', 'Sud',    4.0, 62,
 'right', 'forehand', 'all-court',  'improve',  3,
 'Padel régulier, technique en progression.',
 'Regular padel, technique improving.',
 'פאדל קבוע, טכניקה משתפרת.',
 NULL, FALSE, NOW() - INTERVAL '8 hours', 18, 10,
 '{"side":"any","hand":"any","style":"all-court","region":"Sud","levelMin":3,"levelMax":5}'::jsonb,
 TRUE, NOW() - INTERVAL '10 days'),

('11111111-1111-1111-1111-000000000035', 'Gabriel Lemaire',  39, 'Jerusalem', 'Sud',    6.0, 79,
 'right', 'forehand', 'aggressive', 'compete',  4,
 'Joueur 6.0, fort en stratégie de double.',
 'Player 6.0, strong in doubles strategy.',
 'שחקן 6.0, חזק באסטרטגיה.',
 NULL, FALSE, NOW() - INTERVAL '5 hours', 79, 54,
 '{"side":"any","hand":"any","style":"any","region":"Sud","levelMin":5,"levelMax":7}'::jsonb,
 TRUE, NOW() - INTERVAL '27 days'),

-- ─── Ashdod (Sud) ──────────────────────────────────────────────────────────
('11111111-1111-1111-1111-000000000036', 'Inbar Yosef',      28, 'Ashdod',    'Sud',    4.5, 63,
 'right', 'backhand', 'all-court',  'improve',  3,
 'Padel à Ashdod 3x/sem. Cherche du Sud surtout.',
 'Padel in Ashdod 3x/week. Looking for South mostly.',
 'פאדל באשדוד.',
 NULL, TRUE, NOW() - INTERVAL '3 minutes', 26, 14,
 '{"side":"any","hand":"any","style":"any","region":"Sud","levelMin":4,"levelMax":6}'::jsonb,
 TRUE, NOW() - INTERVAL '13 days'),

('11111111-1111-1111-1111-000000000037', 'Maxime Cohen',     30, 'Ashdod',    'Sud',    5.0, 70,
 'right', 'forehand', 'aggressive', 'compete',  4,
 'Niveau 5, j''ai du jus et de l''envie.',
 'Level 5, energy and motivation.',
 'רמה 5, אנרגיה ורצון.',
 NULL, FALSE, NOW() - INTERVAL '2 days', 37, 22,
 '{"side":"any","hand":"any","style":"any","region":"Sud","levelMin":4,"levelMax":6}'::jsonb,
 TRUE, NOW() - INTERVAL '18 days'),

('11111111-1111-1111-1111-000000000038', 'Hila Eliyahu',     26, 'Ashdod',    'Sud',    3.0, 50,
 'right', 'forehand', 'defensive',  'fun',      2,
 'Padel pour s''amuser, je débute mais j''apprends vite.',
 'Padel for fun, beginner but learning fast.',
 'פאדל בשביל הכיף.',
 NULL, FALSE, NOW() - INTERVAL '4 days', 5, 1,
 '{"side":"any","hand":"any","style":"any","region":"any","levelMin":1,"levelMax":4}'::jsonb,
 TRUE, NOW() - INTERVAL '5 days'),

('11111111-1111-1111-1111-000000000039', 'Eden Tordjman',    34, 'Ashdod',    'Sud',    5.5, 74,
 'left',  'backhand', 'all-court',  'compete',  4,
 'Gauchère, revers solide. Cherche niveau égal ou supérieur.',
 'Lefty, solid backhand. Looking for equal or better.',
 'שמאלית, שמאל חזק.',
 NULL, TRUE, NOW() - INTERVAL '12 minutes', 48, 32,
 '{"side":"any","hand":"any","style":"any","region":"Sud","levelMin":5,"levelMax":7}'::jsonb,
 TRUE, NOW() - INTERVAL '19 days'),

('11111111-1111-1111-1111-000000000040', 'Sofia Allali',     31, 'Ashdod',    'Sud',    4.0, 60,
 'right', 'forehand', 'all-court',  'improve',  3,
 'Padel après le boulot, niveau 4. Cherche partenaire régulière.',
 'Padel after work, level 4. Looking for regular partner.',
 'פאדל אחרי העבודה.',
 NULL, FALSE, NOW() - INTERVAL '1 day', 19, 10,
 '{"side":"any","hand":"any","style":"any","region":"Sud","levelMin":3,"levelMax":5}'::jsonb,
 TRUE, NOW() - INTERVAL '12 days'),

-- ─── Eilat ─────────────────────────────────────────────────────────────────
('11111111-1111-1111-1111-000000000041', 'Bar Shoshan',      29, 'Eilat',     'Eilat',  4.5, 66,
 'right', 'forehand', 'all-court',  'fun',      4,
 'Padel à Eilat, soleil et matchs ! Niveau 4.5.',
 'Padel in Eilat, sun and matches! Level 4.5.',
 'פאדל באילת, שמש ומשחקים.',
 NULL, TRUE, NOW() - INTERVAL '8 minutes', 24, 13,
 '{"side":"any","hand":"any","style":"any","region":"any","levelMin":3,"levelMax":6}'::jsonb,
 TRUE, NOW() - INTERVAL '16 days'),

('11111111-1111-1111-1111-000000000042', 'Naomi Tordjman',   27, 'Eilat',     'Eilat',  3.5, 57,
 'right', 'backhand', 'defensive',  'fun',      3,
 'Padel à Eilat, ambiance vacances même en plein boulot.',
 'Padel in Eilat, holiday vibe even on workdays.',
 'פאדל באילת.',
 NULL, FALSE, NOW() - INTERVAL '6 hours', 12, 6,
 '{"side":"any","hand":"any","style":"any","region":"any","levelMin":2,"levelMax":4}'::jsonb,
 TRUE, NOW() - INTERVAL '9 days'),

('11111111-1111-1111-1111-000000000043', 'Joshua Benarroch', 36, 'Eilat',     'Eilat',  5.0, 71,
 'right', 'forehand', 'aggressive', 'compete',  4,
 'Niveau 5, tournois sur Eilat et Beersheba.',
 'Level 5, tournaments in Eilat and Beersheba.',
 'רמה 5, טורנירים.',
 NULL, FALSE, NOW() - INTERVAL '3 days', 52, 35,
 '{"side":"any","hand":"any","style":"all-court","region":"any","levelMin":4,"levelMax":6}'::jsonb,
 TRUE, NOW() - INTERVAL '22 days'),

('11111111-1111-1111-1111-000000000044', 'Roni Bouhnik',     24, 'Eilat',     'Eilat',  3.0, 52,
 'right', 'forehand', 'defensive',  'fun',      2,
 'Étudiante, padel le matin pour démarrer la journée.',
 'Student, padel in the morning to start the day.',
 'סטודנטית.',
 NULL, FALSE, NOW() - INTERVAL '5 days', 6, 2,
 '{"side":"any","hand":"any","style":"any","region":"any","levelMin":2,"levelMax":4}'::jsonb,
 TRUE, NOW() - INTERVAL '6 days'),

('11111111-1111-1111-1111-000000000045', 'Théo Sabban',      32, 'Eilat',     'Eilat',  4.5, 64,
 'left',  'backhand', 'all-court',  'improve',  3,
 'Gaucher patient et stratégique.',
 'Patient and strategic lefty.',
 'שמאלי סבלני.',
 NULL, TRUE, NOW() - INTERVAL '22 minutes', 31, 17,
 '{"side":"any","hand":"any","style":"any","region":"any","levelMin":4,"levelMax":6}'::jsonb,
 TRUE, NOW() - INTERVAL '14 days'),

-- ─── Mix Centre + variantes ────────────────────────────────────────────────
('11111111-1111-1111-1111-000000000046', 'Inès Levi',        25, 'Tel Aviv',  'Centre', 5.0, 72,
 'right', 'forehand', 'aggressive', 'compete',  5,
 'Coup droit puissant, jeu rapide. Niveau 5 stable.',
 'Powerful forehand, fast play. Stable level 5.',
 'ימני חזק, משחק מהיר.',
 NULL, TRUE, NOW() - INTERVAL '1 minute', 39, 27,
 '{"side":"any","hand":"any","style":"any","region":"Centre","levelMin":5,"levelMax":7}'::jsonb,
 TRUE, NOW() - INTERVAL '20 days'),

('11111111-1111-1111-1111-000000000047', 'Eitan Dadon',      37, 'Herzliya',  'Centre', 6.5, 84,
 'right', 'forehand', 'aggressive', 'compete',  5,
 '6.5 stable, je joue partout. Disponible WE et soirs.',
 '6.5 stable, play everywhere. Available WE and evenings.',
 'רמה 6.5 יציבה.',
 NULL, FALSE, NOW() - INTERVAL '4 hours', 94, 67,
 '{"side":"any","hand":"any","style":"aggressive","region":"Centre","levelMin":6,"levelMax":7}'::jsonb,
 TRUE, NOW() - INTERVAL '29 days'),

('11111111-1111-1111-1111-000000000048', 'Lily Cohen',       28, 'Tel Aviv',  'Centre', 4.0, 61,
 'right', 'backhand', 'defensive',  'fun',      3,
 'Revers fiable, défense solide. Ambiance fun avant tout.',
 'Reliable backhand, solid defense. Fun vibe first.',
 'שמאלי אמין.',
 NULL, FALSE, NOW() - INTERVAL '2 days', 20, 11,
 '{"side":"any","hand":"any","style":"any","region":"Centre","levelMin":3,"levelMax":5}'::jsonb,
 TRUE, NOW() - INTERVAL '11 days'),

('11111111-1111-1111-1111-000000000049', 'Yotam Suissa',     33, 'Ramat Gan', 'Centre', 5.5, 75,
 'right', 'forehand', 'all-court',  'improve',  4,
 'Niveau 5.5, je travaille mon revers. Cherche partenaire technique.',
 'Level 5.5, working on my backhand. Looking for technical partner.',
 'רמה 5.5, עובד על השמאל.',
 NULL, TRUE, NOW() - INTERVAL '7 minutes', 50, 33,
 '{"side":"any","hand":"any","style":"all-court","region":"Centre","levelMin":5,"levelMax":7}'::jsonb,
 TRUE, NOW() - INTERVAL '24 days'),

('11111111-1111-1111-1111-000000000050', 'Yasmine Atias',    30, 'Netanya',   'Centre', 4.5, 65,
 'left',  'forehand', 'all-court',  'fun',      3,
 'Gauchère, j''aime les matchs longs et tactiques.',
 'Lefty, I love long tactical matches.',
 'שמאלית, אוהבת משחקים טקטיים.',
 NULL, FALSE, NOW() - INTERVAL '3 hours', 27, 15,
 '{"side":"forehand","hand":"right","style":"any","region":"Centre","levelMin":4,"levelMax":6}'::jsonb,
 TRUE, NOW() - INTERVAL '15 days');


-- ── 4. Fonction utilitaire pour remplir l'app du user courant ──────────────
-- Crée des matches + messages + match_history entre l'utilisateur courant
-- et quelques démos, pour voir toutes les UIs remplies.
-- À appeler depuis l'app : supabase.rpc('seed_demo_data_for_me')
-- ─────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.seed_demo_data_for_me()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_demo_ids UUID[] := ARRAY[
    '11111111-1111-1111-1111-000000000001'::uuid, -- Or Levy
    '11111111-1111-1111-1111-000000000003'::uuid, -- Sarah Cohen
    '11111111-1111-1111-1111-000000000006'::uuid, -- David Azoulay
    '11111111-1111-1111-1111-000000000009'::uuid, -- Noa Benhamou
    '11111111-1111-1111-1111-000000000014'::uuid  -- Roy Hadad
  ];
  v_match_id UUID;
  v_demo UUID;
  v_count INT := 0;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  FOREACH v_demo IN ARRAY v_demo_ids LOOP
    -- Skip si déjà matché
    IF EXISTS (
      SELECT 1 FROM matches
      WHERE (player1_id = v_user_id AND player2_id = v_demo)
         OR (player1_id = v_demo AND player2_id = v_user_id)
    ) THEN
      CONTINUE;
    END IF;

    -- Crée le match
    INSERT INTO matches (player1_id, player2_id)
    VALUES (LEAST(v_user_id, v_demo), GREATEST(v_user_id, v_demo))
    RETURNING id INTO v_match_id;

    -- Swipes droit dans les 2 sens (pour cohérence)
    INSERT INTO swipes (swiper_id, target_id, direction)
    VALUES (v_user_id, v_demo, 'right'),
           (v_demo, v_user_id, 'right')
    ON CONFLICT DO NOTHING;

    -- 2 messages démo (un dans chaque sens)
    INSERT INTO messages (match_id, sender_id, content, created_at) VALUES
      (v_match_id, v_demo,    'Hey ! Partant pour jouer ?',          NOW() - INTERVAL '2 days'),
      (v_match_id, v_user_id, 'Salut ! Oui pourquoi pas, dispo WE ?', NOW() - INTERVAL '1 day');

    v_count := v_count + 1;
  END LOOP;

  -- Quelques match_history (résultats déjà joués)
  INSERT INTO match_history (player_id, opponent_id, result, score, elo_delta, played_at)
  VALUES
    (v_user_id, '11111111-1111-1111-1111-000000000001', 'win',  '6-4 6-3', 12,  NOW() - INTERVAL '15 days'),
    (v_user_id, '11111111-1111-1111-1111-000000000006', 'loss', '4-6 5-7', -10, NOW() - INTERVAL '10 days'),
    (v_user_id, '11111111-1111-1111-1111-000000000009', 'win',  '7-5 6-4',  9,  NOW() - INTERVAL '5 days')
  ON CONFLICT DO NOTHING;

  -- Notification d'évaluation
  INSERT INTO notifications (user_id, type, from_id, text_fr, text_en, text_he)
  VALUES (
    v_user_id, 'eval', '11111111-1111-1111-1111-000000000001',
    'Or Levy vous a donné 4 étoiles ⭐',
    'Or Levy rated you 4 stars ⭐',
    'אור לוי נתן לך 4 כוכבים ⭐'
  );

  RETURN jsonb_build_object('success', true, 'matches_created', v_count);
END;
$$;


-- ============================================================================
-- FIN
--
-- À faire après exécution :
--   1. Vérifier que les profils s'affichent : SELECT COUNT(*) FROM profiles WHERE is_demo = TRUE;
--      → doit retourner 50
--   2. Depuis l'app, l'utilisateur peut appeler seed_demo_data_for_me() pour
--      remplir matches/messages/history avec quelques démos.
-- ============================================================================
