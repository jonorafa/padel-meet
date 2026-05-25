-- ============================================================================
-- FIX — Rendre les profils démo vraiment fantômes
-- ============================================================================
-- Problème : chantier7 avait online = TRUE sur ~20 profils démo.
-- Ces profils n'ont pas de session auth, ils ne peuvent jamais aller en ligne.
-- Ce script corrige les valeurs existantes en DB.
--
-- Idempotent — ré-exécutable sans casser l'existant.
-- ============================================================================

-- ── 1. Mettre tous les démos hors ligne, last_seen ancienne ─────────────────
UPDATE public.profiles
SET
  online    = FALSE,
  last_seen = NOW() - INTERVAL '30 days',
  updated_at = NOW()
WHERE is_demo = TRUE;

-- ── 2. Vérification ─────────────────────────────────────────────────────────
SELECT
  COUNT(*)                                   AS total_demos,
  COUNT(*) FILTER (WHERE online = TRUE)      AS demos_online,   -- doit être 0
  COUNT(*) FILTER (WHERE photo_url IS NULL)  AS demos_no_photo  -- doit être 50
FROM public.profiles
WHERE is_demo = TRUE;

-- Résultat attendu :
-- total_demos | demos_online | demos_no_photo
-- ────────────┼──────────────┼───────────────
--          50 |            0 |             50
