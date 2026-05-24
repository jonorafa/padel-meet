-- ============================================================================
-- CHANTIER 4 — Préférences partenaire (looking for)
-- ============================================================================
-- Ajoute un champ JSONB `partner_prefs` sur profiles pour stocker ce que
-- le joueur cherche chez un partenaire (main, côté, style, région, niveau).
-- ============================================================================

-- 1. Colonne partner_prefs (JSONB pour flexibilité future)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS partner_prefs JSONB DEFAULT '{}'::jsonb;

-- 2. Index GIN pour filtrage futur efficace
CREATE INDEX IF NOT EXISTS idx_profiles_partner_prefs
  ON public.profiles USING GIN (partner_prefs);

-- 3. Commentaire de doc
COMMENT ON COLUMN public.profiles.partner_prefs IS
  'Préférences pour le partenaire idéal : {hand, side, style, region, levelMin, levelMax}. Tout champ absent = "indifférent".';

-- ============================================================================
-- FIN
-- ============================================================================
