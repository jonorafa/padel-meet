-- ============================================================================
-- ⚠️ LEGACY / OBSOLÈTE — NE PAS APPLIQUER.
-- Remplacé par supabase/migrations/014_backend_coherence.sql (modèle 50/50
-- monotone : peer + play, ne baisse jamais). Conservé pour historique seulement.
-- La source de vérité est désormais `supabase/migrations/`.
-- ============================================================================
-- CHANTIER 14 — Restaurer la logique gap pour confidence_rate
-- ============================================================================
--
-- Contexte :
--   chantier13 a remplacé la formule gap par un boost fixe +8.
--   Le comportement voulu est : si l'évaluateur propose un niveau proche
--   du niveau déclaré → l'indice monte ; s'il propose un niveau très
--   différent → l'indice baisse (signalant une incohérence).
--
-- Cette migration restaure la formule gap (chantier8) tout en conservant
-- la meilleure vérification de match de chantier13 (les DEUX joueurs
-- doivent être présents dans le match, pas seulement l'évaluateur).
--
-- Formule :
--   gap = |proposed_level − current_level|
--
--   gap ≤ 0.25  →  base_delta = +3   (accord parfait)
--   gap ≤ 0.50  →  base_delta = +1   (bon accord)
--   gap ≤ 1.00  →  base_delta = −2   (désaccord modéré)
--   gap >  1.00 →  base_delta = −5   (fort désaccord)
--
--   weight      = GREATEST(0.5, LEAST(2.0, evaluator_confidence / 50.0))
--   delta_final = ROUND(base_delta × weight, 2)
--
--   Exemple : évaluateur à 80% de confiance, gap = 0.0
--             weight = 1.6 → delta = +3 × 1.6 = +4.8
--   Exemple : évaluateur à 50% (neutre), gap = 0.5
--             weight = 1.0 → delta = +1 × 1.0 = +1.0
--   Exemple : évaluateur à 50%, gap = 1.5
--             weight = 1.0 → delta = −5 × 1.0 = −5.0
--
-- Idempotent — ré-exécutable sans casser l'existant.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.submit_peer_evaluation(
  p_match_id       UUID,
  p_evaluated_id   UUID,
  p_proposed_level NUMERIC   -- niveau proposé (1.0 à 7.0)
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_evaluator_id   UUID    := auth.uid();
  v_current_level  NUMERIC(3,1);
  v_evaluator_cr   NUMERIC(5,2);
  v_evaluator_name TEXT;
  v_gap            NUMERIC(4,2);
  v_base_delta     NUMERIC(5,2);
  v_weight         NUMERIC(4,2);
  v_delta_final    NUMERIC(5,2);
BEGIN

  -- ── Garde-fous ────────────────────────────────────────────────────────────

  IF p_proposed_level < 1.0 OR p_proposed_level > 7.0 THEN
    RAISE EXCEPTION 'invalid_level_range';
  END IF;

  IF v_evaluator_id IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  IF v_evaluator_id = p_evaluated_id THEN
    RAISE EXCEPTION 'cannot_evaluate_yourself';
  END IF;

  -- ── Vérifie que les deux joueurs étaient dans ce match ────────────────────
  -- (vérification renforcée de chantier13 : les deux doivent être présents)

  IF NOT EXISTS (
    SELECT 1 FROM matches
    WHERE id = p_match_id
      AND (player1_id = v_evaluator_id OR player2_id = v_evaluator_id)
      AND (player1_id = p_evaluated_id  OR player2_id = p_evaluated_id)
  ) THEN
    RAISE EXCEPTION 'evaluator_not_in_match';
  END IF;

  -- ── Anti-doublon : 1 évaluation par paire par 7 jours ─────────────────────

  IF EXISTS (
    SELECT 1 FROM peer_evaluations
    WHERE evaluator_id = v_evaluator_id
      AND evaluated_id  = p_evaluated_id
      AND created_at   > NOW() - INTERVAL '7 days'
  ) THEN
    RAISE EXCEPTION 'already_evaluated_recently';
  END IF;

  -- ── Données nécessaires ───────────────────────────────────────────────────

  SELECT COALESCE(level, 3.5)
  INTO v_current_level
  FROM profiles
  WHERE id = p_evaluated_id;

  SELECT
    COALESCE(confidence_rate, 50.0),
    COALESCE(name, 'Un joueur')
  INTO v_evaluator_cr, v_evaluator_name
  FROM profiles
  WHERE id = v_evaluator_id;

  -- ── Calcul du delta (logique gap) ─────────────────────────────────────────
  --
  -- Synchronisé avec confidenceRules.js côté client.

  v_gap := ABS(p_proposed_level - v_current_level);

  IF    v_gap <= 0.25 THEN v_base_delta :=  3.0;
  ELSIF v_gap <= 0.50 THEN v_base_delta :=  1.0;
  ELSIF v_gap <= 1.00 THEN v_base_delta := -2.0;
  ELSE                     v_base_delta := -5.0;
  END IF;

  -- Pondération par la crédibilité de l'évaluateur
  -- (0.5× si confiance ≤ 25%, 2.0× si confiance ≥ 100%)
  v_weight      := GREATEST(0.5, LEAST(2.0, v_evaluator_cr / 50.0));
  v_delta_final := ROUND(v_base_delta * v_weight, 2);

  -- ── Mise à jour du confidence_rate de l'évalué ────────────────────────────

  UPDATE profiles
  SET
    confidence_rate = GREATEST(0, LEAST(100, COALESCE(confidence_rate, 50) + v_delta_final)),
    updated_at      = NOW()
  WHERE id = p_evaluated_id;

  -- ── Enregistrement de l'évaluation ───────────────────────────────────────

  INSERT INTO peer_evaluations (match_id, evaluator_id, evaluated_id, proposed_level, created_at)
  VALUES (p_match_id, v_evaluator_id, p_evaluated_id, p_proposed_level, NOW())
  ON CONFLICT (match_id, evaluator_id, evaluated_id)
  DO NOTHING;

  -- ── Notification à l'évalué ───────────────────────────────────────────────

  INSERT INTO notifications (user_id, type, from_id, text_fr, text_en, text_he)
  VALUES (
    p_evaluated_id,
    'eval',
    v_evaluator_id,
    v_evaluator_name || ' a évalué votre niveau',
    v_evaluator_name || ' evaluated your level',
    v_evaluator_name || ' העריך את הרמה שלך'
  );

END;
$$;


-- ============================================================================
-- FIN
--
-- À exécuter dans Supabase Dashboard → SQL Editor
--   https://supabase.com/dashboard → ton projet → SQL Editor
--
-- Vérification post-exécution :
--   -- Le delta est-il bien calculé selon le gap ?
--   SELECT confidence_rate FROM profiles WHERE id = '<uuid_évalué>';
--   -- Doit monter de +1 à +4.8 si accord, baisser de -2 à -10 si désaccord fort.
-- ============================================================================
