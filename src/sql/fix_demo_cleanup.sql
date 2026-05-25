-- ============================================================================
-- FIX — Nettoyer les données indésirables créées par seed_demo_data_for_me()
-- ============================================================================
-- Problème : la fonction seed_demo_data_for_me() créait des matches mutuels,
-- des swipes dans les 2 sens et des messages fictifs entre vrais users et bots.
-- Ce script supprime tout ça et corrige les deux bugs :
--   1. Les bots apparaissaient dans l'onglet Messages avec de vraies conversations
--   2. Les profils bots n'apparaissaient plus dans la liste Partenaires car
--      les swipes user→bot avaient été insérés par le seeding
--
-- Idempotent — ré-exécutable sans effet secondaire.
-- ============================================================================

-- ── 1. Supprimer les messages dans les matches impliquant un démo ────────────
DELETE FROM public.messages
WHERE match_id IN (
  SELECT m.id FROM public.matches m
  WHERE m.player1_id IN (SELECT id FROM public.profiles WHERE is_demo = TRUE)
     OR m.player2_id IN (SELECT id FROM public.profiles WHERE is_demo = TRUE)
);

-- ── 2. Supprimer les matches impliquant un démo ──────────────────────────────
DELETE FROM public.matches
WHERE player1_id IN (SELECT id FROM public.profiles WHERE is_demo = TRUE)
   OR player2_id IN (SELECT id FROM public.profiles WHERE is_demo = TRUE);

-- ── 3. Supprimer les swipes impliquant un démo (dans les 2 sens) ─────────────
DELETE FROM public.swipes
WHERE swiper_id IN (SELECT id FROM public.profiles WHERE is_demo = TRUE)
   OR target_id IN (SELECT id FROM public.profiles WHERE is_demo = TRUE);

-- ── 4. Supprimer les notifications liées aux démos ───────────────────────────
DELETE FROM public.notifications
WHERE from_id IN (SELECT id FROM public.profiles WHERE is_demo = TRUE);

-- ── 5. Supprimer le match_history lié aux démos ──────────────────────────────
DELETE FROM public.match_history
WHERE opponent_id IN (SELECT id FROM public.profiles WHERE is_demo = TRUE);

-- ── 6. Supprimer la fonction seed_demo_data_for_me() — elle ne doit plus exister
DROP FUNCTION IF EXISTS public.seed_demo_data_for_me();

-- ── 7. Vérification finale ───────────────────────────────────────────────────
SELECT
  (SELECT COUNT(*) FROM public.matches m
   WHERE m.player1_id IN (SELECT id FROM public.profiles WHERE is_demo = TRUE)
      OR m.player2_id IN (SELECT id FROM public.profiles WHERE is_demo = TRUE)
  ) AS matches_with_demos,   -- doit être 0

  (SELECT COUNT(*) FROM public.swipes s
   WHERE s.swiper_id IN (SELECT id FROM public.profiles WHERE is_demo = TRUE)
      OR s.target_id IN (SELECT id FROM public.profiles WHERE is_demo = TRUE)
  ) AS swipes_with_demos,    -- doit être 0

  (SELECT COUNT(*) FROM public.profiles WHERE is_demo = TRUE
  ) AS total_demos;           -- doit être 50
