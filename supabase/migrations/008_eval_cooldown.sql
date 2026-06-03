-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 008 — Évaluation niveau : cooldown 7 jours → 30 jours
-- ─────────────────────────────────────────────────────────────────────────────
-- Remplace submit_peer_evaluation pour porter l'anti-doublon à 30 jours.
-- Le reste de la logique (delta, pondération, cap mensuel, notif) est inchangé.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.submit_peer_evaluation(
  p_match_id       UUID,
  p_evaluated_id   UUID,
  p_proposed_level NUMERIC   -- 1.0 à 7.0
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_evaluator_id     UUID    := auth.uid();
  v_current_level    NUMERIC(3,1);
  v_evaluator_cr     NUMERIC(5,2);
  v_evaluator_name   TEXT;
  v_gap              NUMERIC(4,2);
  v_base_delta       NUMERIC(5,2);
  v_weight           NUMERIC(4,2);
  v_delta_final      NUMERIC(5,2);
  v_monthly_gain     NUMERIC(5,2);
BEGIN
  -- Garde-fous
  IF p_proposed_level < 1.0 OR p_proposed_level > 7.0 THEN
    RAISE EXCEPTION 'invalid_level_range';
  END IF;
  IF v_evaluator_id IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;
  IF v_evaluator_id = p_evaluated_id THEN
    RAISE EXCEPTION 'cannot_evaluate_yourself';
  END IF;

  -- L'évaluateur doit avoir été dans le match
  IF NOT EXISTS (
    SELECT 1 FROM matches
    WHERE id = p_match_id
      AND (player1_id = v_evaluator_id OR player2_id = v_evaluator_id)
  ) THEN
    RAISE EXCEPTION 'evaluator_not_in_match';
  END IF;

  -- Anti-doublon : 1 évaluation par paire / 30 jours
  IF EXISTS (
    SELECT 1 FROM peer_evaluations
    WHERE evaluator_id = v_evaluator_id
      AND evaluated_id = p_evaluated_id
      AND created_at > NOW() - INTERVAL '30 days'
  ) THEN
    RAISE EXCEPTION 'already_evaluated_recently';
  END IF;

  -- Données de l'évalué et de l'évaluateur
  SELECT COALESCE(level, 3.5)
  INTO v_current_level
  FROM profiles WHERE id = p_evaluated_id;

  SELECT
    COALESCE(confidence_rate, 50.0),
    COALESCE(name, 'Un joueur')
  INTO v_evaluator_cr, v_evaluator_name
  FROM profiles WHERE id = v_evaluator_id;

  -- Delta de base selon l'écart
  v_gap := ABS(p_proposed_level - v_current_level);
  IF    v_gap <= 0.25 THEN v_base_delta :=  3.0;
  ELSIF v_gap <= 0.50 THEN v_base_delta :=  1.0;
  ELSIF v_gap <= 1.00 THEN v_base_delta := -2.0;
  ELSE                     v_base_delta := -5.0;
  END IF;

  -- Pondération par crédibilité de l'évaluateur
  -- 25 CR → poids 0.5x | 50 CR → 1.0x | 100 CR → 2.0x
  v_weight      := GREATEST(0.5, LEAST(2.0, v_evaluator_cr / 50.0));
  v_delta_final := ROUND(v_base_delta * v_weight, 2);

  -- Cap de vélocité : max +10 gagné dans les 30 derniers jours
  IF v_delta_final > 0 THEN
    SELECT COALESCE(SUM(delta), 0)
    INTO v_monthly_gain
    FROM confidence_log
    WHERE user_id = p_evaluated_id
      AND delta > 0
      AND created_at > NOW() - INTERVAL '30 days';

    IF v_monthly_gain >= 10 THEN
      v_delta_final := 0;
    ELSIF v_monthly_gain + v_delta_final > 10 THEN
      v_delta_final := 10 - v_monthly_gain;
    END IF;
  END IF;

  -- Enregistre l'évaluation
  INSERT INTO peer_evaluations(match_id, evaluator_id, evaluated_id, proposed_level)
  VALUES (p_match_id, v_evaluator_id, p_evaluated_id, p_proposed_level)
  ON CONFLICT (match_id, evaluator_id, evaluated_id) DO NOTHING;

  -- Log dans confidence_log (traçabilité + cap mensuel)
  INSERT INTO confidence_log(user_id, evaluator_id, delta, evaluator_weight, reason)
  VALUES (p_evaluated_id, v_evaluator_id, v_delta_final, v_weight,
          'peer_eval gap=' || v_gap::TEXT);

  -- Mise à jour du confidence_rate (borné 0–100)
  UPDATE profiles
  SET
    confidence_rate = GREATEST(0, LEAST(100, confidence_rate + v_delta_final)),
    updated_at = NOW()
  WHERE id = p_evaluated_id;

  -- Notification à l'évalué
  INSERT INTO notifications(user_id, type, from_id, text_fr, text_en, text_he)
  VALUES (
    p_evaluated_id, 'eval', v_evaluator_id,
    v_evaluator_name || ' a évalué votre niveau',
    v_evaluator_name || ' evaluated your level',
    v_evaluator_name || ' העריך את הרמה שלך'
  );
END;
$$;
