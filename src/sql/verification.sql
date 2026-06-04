-- ============================================================================
-- PADEL MEET — Vérification complète de la base de données
-- ============================================================================
-- Exécuter dans Supabase → SQL Editor
-- Vérifie : tables, colonnes, fonctions, policies RLS, données démo
-- ============================================================================


-- ── 1. TABLES EXISTANTES ────────────────────────────────────────────────────
SELECT '══ 1. TABLES ══' AS section, '' AS detail, '' AS statut;

SELECT
  table_name                                        AS "Table",
  CASE
    WHEN table_name IN (
      'profiles','swipes','matches','messages',
      'notifications','match_history',
      'pending_match_results','peer_evaluations'
    ) THEN '✅ attendue'
    ELSE '⚠️ inattendue'
  END                                               AS "Statut"
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_type = 'BASE TABLE'
ORDER BY table_name;


-- ── 2. COLONNES CLÉS DE PROFILES ────────────────────────────────────────────
SELECT '══ 2. COLONNES profiles ══' AS section, '' AS detail, '' AS statut;

SELECT
  column_name                                       AS "Colonne",
  data_type                                         AS "Type",
  is_nullable                                       AS "Nullable",
  column_default                                    AS "Défaut",
  CASE
    WHEN column_name IN (
      'id','name','age','city','region','level','confidence_rate',
      'dominant_hand','preferred_side','play_style','motivation','frequency',
      'bio_fr','bio_en','bio_he','photo_url','online','last_seen',
      'matches_played','wins','partner_prefs','is_demo',
      'created_at','updated_at'
    ) THEN '✅'
    ELSE '➕ extra'
  END                                               AS "Statut"
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name   = 'profiles'
ORDER BY ordinal_position;


-- ── 3. COMPTAGES DES DONNÉES ─────────────────────────────────────────────────
SELECT '══ 3. COMPTAGES ══' AS section, '' AS detail, '' AS statut;

SELECT 'profiles total'        AS "Table",       COUNT(*)::text AS "Lignes" FROM profiles
UNION ALL
SELECT 'profiles réels',                         COUNT(*)::text FROM profiles WHERE is_demo = FALSE OR is_demo IS NULL
UNION ALL
SELECT 'profiles démo (is_demo=TRUE)',            COUNT(*)::text FROM profiles WHERE is_demo = TRUE
UNION ALL
SELECT 'swipes',                                  COUNT(*)::text FROM swipes
UNION ALL
SELECT 'matches',                                 COUNT(*)::text FROM matches
UNION ALL
SELECT 'messages',                                COUNT(*)::text FROM messages
UNION ALL
SELECT 'notifications',                           COUNT(*)::text FROM notifications
UNION ALL
SELECT 'match_history',                           COUNT(*)::text FROM match_history
UNION ALL
SELECT 'pending_match_results',                   COUNT(*)::text FROM pending_match_results
UNION ALL
SELECT 'peer_evaluations',                        COUNT(*)::text FROM peer_evaluations;


-- ── 4. PROFILS DÉMO — aperçu ─────────────────────────────────────────────────
SELECT '══ 4. PROFILS DÉMO (10 premiers) ══' AS section, '' AS detail, '' AS statut;

SELECT
  name       AS "Nom",
  age        AS "Âge",
  city       AS "Ville",
  level      AS "Niveau",
  online     AS "En ligne",
  matches_played AS "Matchs"
FROM profiles
WHERE is_demo = TRUE
ORDER BY name
LIMIT 10;


-- ── 5. FONCTIONS SQL ─────────────────────────────────────────────────────────
SELECT '══ 5. FONCTIONS ══' AS section, '' AS detail, '' AS statut;

SELECT
  routine_name                                      AS "Fonction",
  CASE
    WHEN routine_name IN (
      'submit_match_result','confirm_match_result','reject_match_result',
      'submit_peer_evaluation','get_player_stats',
      'sync_profile_stats','seed_demo_data_for_me'
    ) THEN '✅ présente'
    ELSE '➕ extra'
  END                                               AS "Statut"
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_type   = 'FUNCTION'
ORDER BY routine_name;


-- ── 6. POLICIES RLS ──────────────────────────────────────────────────────────
SELECT '══ 6. RLS POLICIES ══' AS section, '' AS detail, '' AS statut;

SELECT
  tablename   AS "Table",
  policyname  AS "Policy",
  cmd         AS "Action"
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, cmd;


-- ── 7. REALTIME (tables exposées) ────────────────────────────────────────────
SELECT '══ 7. REALTIME ══' AS section, '' AS detail, '' AS statut;

SELECT
  schemaname  AS "Schéma",
  tablename   AS "Table",
  '✅ Realtime activé' AS "Statut"
FROM pg_publication_tables
WHERE pubname = 'supabase_realtime'
ORDER BY tablename;


-- ── 8. CONTRAINTES (FK critiques) ───────────────────────────────────────────
SELECT '══ 8. FOREIGN KEYS ══' AS section, '' AS detail, '' AS statut;

SELECT
  tc.table_name        AS "Table",
  kcu.column_name      AS "Colonne",
  ccu.table_name       AS "→ Table référencée",
  ccu.column_name      AS "→ Colonne",
  tc.constraint_name   AS "Contrainte"
FROM information_schema.table_constraints    tc
JOIN information_schema.key_column_usage     kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema   = kcu.table_schema
JOIN information_schema.constraint_column_usage ccu
  ON ccu.constraint_name = tc.constraint_name
  AND ccu.table_schema   = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_schema    = 'public'
ORDER BY tc.table_name;


-- ── 9. RÉSUMÉ FINAL ──────────────────────────────────────────────────────────
SELECT '══ 9. RÉSUMÉ ══' AS section, '' AS detail, '' AS statut;

SELECT
  CASE
    WHEN (SELECT COUNT(*) FROM profiles WHERE is_demo = TRUE) = 50
    THEN '✅ 50 profils démo présents'
    ELSE '❌ Profils démo manquants : ' ||
         (SELECT COUNT(*) FROM profiles WHERE is_demo = TRUE)::text || '/50'
  END AS "Démo",

  CASE
    WHEN EXISTS (SELECT 1 FROM information_schema.routines
                 WHERE routine_schema = 'public'
                   AND routine_name   = 'submit_match_result')
    THEN '✅ submit_match_result OK'
    ELSE '❌ submit_match_result manquante'
  END AS "Anti-fraude",

  CASE
    WHEN EXISTS (SELECT 1 FROM information_schema.routines
                 WHERE routine_schema = 'public'
                   AND routine_name   = 'seed_demo_data_for_me')
    THEN '✅ seed_demo_data_for_me OK'
    ELSE '❌ seed_demo_data_for_me manquante'
  END AS "Seed",

  CASE
    WHEN EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema  = 'public'
                   AND table_name    = 'profiles'
                   AND column_name   = 'is_demo')
    THEN '✅ colonne is_demo OK'
    ELSE '❌ colonne is_demo manquante'
  END AS "is_demo",

  CASE
    WHEN EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema  = 'public'
                   AND table_name    = 'profiles'
                   AND column_name   = 'partner_prefs')
    THEN '✅ partner_prefs OK'
    ELSE '❌ partner_prefs manquante'
  END AS "partner_prefs";

-- ============================================================================
-- FIN DE LA VÉRIFICATION
-- ============================================================================
