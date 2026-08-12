-- ============================================================================
-- Migration 033 : taille du joueur (cm), champ optionnel
-- ============================================================================
-- Demandé pour être affiché sur la carte de swipe à côté de l'âge. Purement
-- informatif — ne rentre dans aucun calcul de niveau/confiance/compatibilité.
-- Contrainte large (100–250 cm) : filtre les valeurs absurdes sans jamais
-- gêner un usage légitime.
-- ============================================================================

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS height smallint;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_height_range
  CHECK (height IS NULL OR (height BETWEEN 100 AND 250));

COMMENT ON COLUMN public.profiles.height IS 'Taille en cm, optionnelle — purement informative (aucun effet sur level/confidence_rate).';
