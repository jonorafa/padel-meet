-- ============================================================================
-- PADEL MEET — Migration 013 : Inject pre-4.8 level point for Jonathan
-- ============================================================================
-- Before migration 012 there was no level history tracking. Jonathan's real
-- progression was 4.9 → 4.8. Migration 012 only captured the current 4.8
-- (seed). This migration restores the missing 4.9 data point.
--
-- Safe to run multiple times (NOT EXISTS guard).
-- ============================================================================

INSERT INTO public.level_history (user_id, level, source, created_at)
SELECT u.id, 4.9, 'seed-recover', '2026-05-01 10:00:00+00'
FROM auth.users u
WHERE u.email = 'jonathanbens10@gmail.com'
  AND NOT EXISTS (
    SELECT 1 FROM public.level_history lh
    WHERE lh.user_id = u.id AND lh.level = 4.9
  );
