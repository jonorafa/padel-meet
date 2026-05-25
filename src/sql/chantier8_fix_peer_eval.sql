-- ============================================================================
-- CHANTIER 8 — Réparer le différenciateur central : peer evaluation
-- ============================================================================
-- Problème : chantier6 a écrasé submit_peer_evaluation avec une version
-- qui prend p_rating (1-5 étoiles) et n'impacte JAMAIS confidence_rate.
-- Ce fichier restaure la logique correcte basée sur proposed_level.
--
-- Idempotent — ré-exécutable sans casser l'existant.
-- ============================================================================


-- ── 1. S'assurer que proposed_level existe dans peer_evaluations ─────────────
-- (chantier1 l'a créé, chantier6 a pu le laisser inutilisé)
ALTER TABLE public.peer_evaluations
  ADD COLUMN IF NOT EXISTS proposed_level NUMERIC(3,1)
    CHECK (proposed_level >= 1.0 AND proposed_level <= 7.0);


-- ── 2. Fonction finale submit_peer_evaluation ────────────────────────────────
-- Remplace définitivement la version étoiles de chantier6.
CREATE OR REPLACE FUNCTION public.submit_peer_evaluation(
  p_match_id       UUID,
  p_evaluated_id   UUID,
  p_proposed_level NUMERIC   -- niveau proposé par l'évaluateur (1.0 à 7.0)
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

  -- ── Garde-fous basiques ───────────────────────────────────────────────────

  IF p_proposed_level < 1.0 OR p_proposed_level > 7.0 THEN
    RAISE EXCEPTION 'invalid_level_range';
  END IF;

  IF v_evaluator_id IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  IF v_evaluator_id = p_evaluated_id THEN
    RAISE EXCEPTION 'cannot_evaluate_yourself';
  END IF;

  -- ── Vérifier que l'évaluateur était bien dans le match ───────────────────

  IF NOT EXISTS (
    SELECT 1 FROM matches
    WHERE id = p_match_id
      AND (player1_id = v_evaluator_id OR player2_id = v_evaluator_id)
  ) THEN
    RAISE EXCEPTION 'evaluator_not_in_match';
  END IF;

  -- ── Anti-doublon : 1 évaluation par paire par 7 jours ────────────────────

  IF EXISTS (
    SELECT 1 FROM peer_evaluations
    WHERE evaluator_id = v_evaluator_id
      AND evaluated_id = p_evaluated_id
      AND created_at > NOW() - INTERVAL '7 days'
  ) THEN
    RAISE EXCEPTION 'already_evaluated_recently';
  END IF;

  -- ── Récupérer les données nécessaires ─────────────────────────────────────

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

  -- ── Calcul du delta de confidence_rate ────────────────────────────────────
  --
  -- Règles (issues de confidenceRules.js) :
  --   gap ≤ 0.25 → +3   (accord parfait)
  --   gap ≤ 0.50 → +1   (bon accord)
  --   gap ≤ 1.00 → -2   (désaccord modéré)
  --   gap >  1.00 → -5  (fort désaccord)
  --
  -- Pondération par la crédibilité de l'évaluateur :
  --   weight = GREATEST(0.5, LEAST(2.0, evaluator_confidence_rate / 50.0))
  --   Un évaluateur à 80 de confiance pèse 1.6×, un à 25 pèse 0.5×.

  v_gap := ABS(p_proposed_level - v_current_level);

  IF    v_gap <= 0.25 THEN v_base_delta :=  3.0;
  ELSIF v_gap <= 0.50 THEN v_base_delta :=  1.0;
  ELSIF v_gap <= 1.00 THEN v_base_delta := -2.0;
  ELSE                     v_base_delta := -5.0;
  END IF;

  v_weight      := GREATEST(0.5, LEAST(2.0, v_evaluator_cr / 50.0));
  v_delta_final := ROUND(v_base_delta * v_weight, 2);

  -- ── Mise à jour du confidence_rate de l'évalué ───────────────────────────

  UPDATE profiles
  SET
    confidence_rate = GREATEST(0, LEAST(100, confidence_rate + v_delta_final)),
    updated_at      = NOW()
  WHERE id = p_evaluated_id;

  -- ── Enregistrement de l'évaluation ───────────────────────────────────────

  INSERT INTO peer_evaluations (match_id, evaluator_id, evaluated_id, proposed_level, created_at)
  VALUES (p_match_id, v_evaluator_id, p_evaluated_id, p_proposed_level, NOW())
  ON CONFLICT (match_id, evaluator_id, evaluated_id)
  DO NOTHING;  -- le 7-day check ci-dessus gère déjà les doublons

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


-- ── 3. Supprimer l'ancienne surcharge étoiles si elle existe ─────────────────
-- PostgreSQL distingue les fonctions par leur signature (nom + types des params).
-- La version chantier6 prend (UUID, UUID, INTEGER) — on la supprime proprement.
DROP FUNCTION IF EXISTS public.submit_peer_evaluation(UUID, UUID, INTEGER);


-- ============================================================================
-- FIN
--
-- Vérification après exécution :
--   SELECT routine_name, specific_name
--   FROM information_schema.routines
--   WHERE routine_schema = 'public'
--     AND routine_name = 'submit_peer_evaluation';
--   → doit retourner 1 seule ligne (la version NUMERIC)
--
--   SELECT column_name, data_type, is_nullable
--   FROM information_schema.columns
--   WHERE table_name = 'peer_evaluations'
--     AND column_name = 'proposed_level';
--   → doit retourner 1 ligne
-- ============================================================================
