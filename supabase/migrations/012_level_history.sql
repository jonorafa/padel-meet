-- ============================================================================
-- PADEL MEET — Migration 012 : Historique de niveau (level_history)
-- ============================================================================
-- Trace l'évolution réelle du niveau dans le temps. Chaque (ré)évaluation, et
-- plus tard chaque ajustement par match, ajoute une ligne. La courbe de
-- progression lit ces vrais points au lieu d'une courbe fabriquée.
--
-- Mécanisme : 100% côté serveur via triggers sur `profiles`. Aucune confiance
-- requise dans le client — toute modification de profiles.level est enregistrée.
-- ============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Table
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.level_history (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  level      NUMERIC(3,1) NOT NULL CHECK (level >= 0.5 AND level <= 7.0),
  source     TEXT NOT NULL DEFAULT 'eval',   -- 'quiz' | 'reeval' | 'match' | 'seed'
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_level_history_user
  ON public.level_history(user_id, created_at);

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. RLS — chacun lit son propre historique ; les écritures passent par triggers
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.level_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS level_history_select_own ON public.level_history;
CREATE POLICY level_history_select_own ON public.level_history
  FOR SELECT USING (auth.uid() = user_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Trigger — enregistre un point à chaque changement de niveau
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.record_level_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Ne consigne que les vrais changements (évite les doublons sur un upsert
  -- de profil qui ré-écrit le même niveau).
  IF NEW.level IS NOT NULL AND (OLD.level IS DISTINCT FROM NEW.level) THEN
    INSERT INTO public.level_history(user_id, level, source)
    VALUES (NEW.id, NEW.level, 'eval');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_record_level_change ON public.profiles;
CREATE TRIGGER trg_record_level_change
  AFTER UPDATE OF level ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.record_level_change();

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Trigger — enregistre le tout premier niveau (création de profil avec level)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.record_initial_level()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.level IS NOT NULL THEN
    INSERT INTO public.level_history(user_id, level, source)
    VALUES (NEW.id, NEW.level, 'quiz');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_record_initial_level ON public.profiles;
CREATE TRIGGER trg_record_initial_level
  AFTER INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.record_initial_level();

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. Backfill — amorce le niveau actuel pour les profils existants sans historique
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO public.level_history(user_id, level, source, created_at)
SELECT p.id, p.level, 'seed', COALESCE(p.updated_at, NOW())
FROM public.profiles p
WHERE p.level IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.level_history lh WHERE lh.user_id = p.id
  );
