-- ============================================================================
-- CHANTIER 13 — Réparer confidence_rate + confirm_match_result
-- ============================================================================
--
-- Problèmes corrigés :
--
--   1. confirm_match_result (chantier6) ne remplissait plus match_history.
--      Résultat : sendEval() côté JS trouvait null et ne soumettait jamais
--      submit_peer_evaluation. Confidence_rate restait bloqué à 50.
--
--   2. submit_peer_evaluation utilisait une formule "gap" (accord/désaccord
--      entre niveau proposé et niveau actuel) qui donnait +3 / -5.
--      Comportement souhaité : chaque évaluation apporte un petit boost fixe.
--      Cible : 3-4 évaluateurs pour passer de 50% à ~82%.
--
--   3. sendEval() côté JS passait match_history.id comme p_match_id, mais
--      la fonction attendait matches.id (FK différente). Corrigé côté JS.
--
-- Idempotent — ré-exécutable sans casser l'existant.
-- ============================================================================


-- ── 1. confirm_match_result — restaure l'INSERT match_history ────────────────
--
-- Fusionne chantier3 (match_history + ELO) et chantier6 (notification).
-- SECURITY DEFINER indispensable pour contourner le RLS sur match_history.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.confirm_match_result(p_pending_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pending          pending_match_results%ROWTYPE;
  v_submitter_level  NUMERIC(3,1);
  v_opponent_level   NUMERIC(3,1);
  v_submitter_delta  INT;
  v_opponent_delta   INT;
  v_submitter_result TEXT;   -- converti : 'teammate' → 'win'
  v_opponent_result  TEXT;
  v_opponent_name    TEXT;
BEGIN
  -- Récupère le pending (seul l'adversaire peut confirmer)
  SELECT * INTO v_pending
  FROM pending_match_results
  WHERE id    = p_pending_id
    AND opponent_id = auth.uid()
    AND status      = 'pending';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'pending_result_not_found';
  END IF;

  -- Normalise 'teammate' en 'win' pour match_history (colonne CHECK win/loss/draw)
  v_submitter_result := CASE v_pending.submitter_result
    WHEN 'teammate' THEN 'win'
    WHEN 'win'      THEN 'win'
    WHEN 'loss'     THEN 'loss'
    ELSE 'draw'
  END;

  v_opponent_result := CASE v_submitter_result
    WHEN 'win'  THEN 'loss'
    WHEN 'loss' THEN 'win'
    ELSE 'draw'
  END;

  -- Niveaux pour calcul ELO
  SELECT COALESCE(level, 3.5) INTO v_submitter_level FROM profiles WHERE id = v_pending.submitter_id;
  SELECT COALESCE(level, 3.5), COALESCE(name, 'Votre adversaire')
    INTO v_opponent_level, v_opponent_name
  FROM profiles WHERE id = v_pending.opponent_id;

  -- Calcul delta ELO (±20 de base, modulé par différence de niveau)
  IF v_submitter_result = 'win' THEN
    v_submitter_delta := GREATEST(5, LEAST(40, ROUND(20 + (v_opponent_level - v_submitter_level) * 5)));
    v_opponent_delta  := -v_submitter_delta;
  ELSIF v_submitter_result = 'loss' THEN
    v_opponent_delta  := GREATEST(5, LEAST(40, ROUND(20 + (v_submitter_level - v_opponent_level) * 5)));
    v_submitter_delta := -v_opponent_delta;
  ELSE
    v_submitter_delta := 0;
    v_opponent_delta  := 0;
  END IF;

  -- Insère 2 rows dans match_history (perspective de chaque joueur)
  INSERT INTO match_history(player_id, opponent_id, result, score, elo_delta, played_at)
  VALUES
    (v_pending.submitter_id, v_pending.opponent_id,
     v_submitter_result, v_pending.score, v_submitter_delta, v_pending.played_at),
    (v_pending.opponent_id,  v_pending.submitter_id,
     v_opponent_result,  v_pending.score, v_opponent_delta,  v_pending.played_at);

  -- Met à jour matches_played et wins sur les profils
  UPDATE profiles SET
    matches_played = COALESCE(matches_played, 0) + 1,
    wins = COALESCE(wins, 0) + CASE WHEN v_submitter_result = 'win' THEN 1 ELSE 0 END
  WHERE id = v_pending.submitter_id;

  UPDATE profiles SET
    matches_played = COALESCE(matches_played, 0) + 1,
    wins = COALESCE(wins, 0) + CASE WHEN v_opponent_result = 'win' THEN 1 ELSE 0 END
  WHERE id = v_pending.opponent_id;

  -- Marque comme confirmé
  UPDATE pending_match_results
  SET status = 'confirmed', confirmed_at = NOW()
  WHERE id = p_pending_id;

  -- Notifie le soumetteur
  INSERT INTO notifications (user_id, type, from_id, text_fr, text_en, text_he)
  VALUES (
    v_pending.submitter_id,
    'match',
    v_pending.opponent_id,
    v_opponent_name || ' a confirmé le score ' || v_pending.score || ' ✓',
    v_opponent_name || ' confirmed the score '  || v_pending.score || ' ✓',
    v_opponent_name || ' אישר את התוצאה '        || v_pending.score || ' ✓'
  );
END;
$$;


-- ── 2. submit_peer_evaluation — boost fixe +8 par évaluation ─────────────────
--
-- Objectif UX : 3-4 évaluateurs pour passer de 50% à ~82% de fiabilité.
-- Formule :
--   50 + 8×1 = 58   (1 éval)
--   50 + 8×2 = 66   (2 évals)
--   50 + 8×3 = 74   (3 évals)
--   50 + 8×4 = 82   (4 évals)
--   50 + 8×6 = 98   (6 évals — plateau)
--
-- p_match_id doit être un UUID de la table `matches` (chat match),
-- pas de match_history. Le JS sendEval() passe désormais matchId (matches.id).
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.submit_peer_evaluation(
  p_match_id       UUID,
  p_evaluated_id   UUID,
  p_proposed_level NUMERIC    -- niveau calculé par le quiz (1.0 à 7.0)
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_evaluator_id     UUID    := auth.uid();
  v_evaluator_name   TEXT;
  v_confidence_boost NUMERIC := 8.0;   -- points ajoutés par évaluation
BEGIN
  -- ── Gardes fous ────────────────────────────────────────────────────────────
  IF p_proposed_level < 1.0 OR p_proposed_level > 7.0 THEN
    RAISE EXCEPTION 'invalid_level_range';
  END IF;

  IF v_evaluator_id IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  IF v_evaluator_id = p_evaluated_id THEN
    RAISE EXCEPTION 'cannot_evaluate_yourself';
  END IF;

  -- ── Vérifie que l'évaluateur et l'évalué ont bien un match en commun ───────
  IF NOT EXISTS (
    SELECT 1 FROM matches
    WHERE id = p_match_id
      AND (player1_id = v_evaluator_id OR player2_id = v_evaluator_id)
      AND (player1_id = p_evaluated_id  OR player2_id = p_evaluated_id)
  ) THEN
    RAISE EXCEPTION 'evaluator_not_in_match';
  END IF;

  -- ── Anti-doublon : 1 évaluation par paire par 7 jours ──────────────────────
  IF EXISTS (
    SELECT 1 FROM peer_evaluations
    WHERE evaluator_id = v_evaluator_id
      AND evaluated_id  = p_evaluated_id
      AND created_at   > NOW() - INTERVAL '7 days'
  ) THEN
    RAISE EXCEPTION 'already_evaluated_recently';
  END IF;

  -- ── Récupère le nom de l'évaluateur ────────────────────────────────────────
  SELECT COALESCE(name, 'Un joueur')
  INTO v_evaluator_name
  FROM profiles
  WHERE id = v_evaluator_id;

  -- ── Boost confidence_rate (+8, plafonné à 100) ─────────────────────────────
  UPDATE profiles
  SET
    confidence_rate = GREATEST(0, LEAST(100, COALESCE(confidence_rate, 50) + v_confidence_boost)),
    updated_at      = NOW()
  WHERE id = p_evaluated_id;

  -- ── Enregistrement de l'évaluation ─────────────────────────────────────────
  INSERT INTO peer_evaluations (match_id, evaluator_id, evaluated_id, proposed_level, created_at)
  VALUES (p_match_id, v_evaluator_id, p_evaluated_id, p_proposed_level, NOW())
  ON CONFLICT (match_id, evaluator_id, evaluated_id)
  DO NOTHING;

  -- ── Notification à l'évalué ────────────────────────────────────────────────
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
-- À exécuter dans Supabase Dashboard → SQL Editor.
--
-- Vérification post-exécution :
--   -- 1. confirm_match_result insère bien dans match_history ?
--   SELECT COUNT(*) FROM match_history;  -- doit augmenter après une confirmation
--
--   -- 2. confidence_rate augmente de +8 après une évaluation ?
--   SELECT confidence_rate FROM profiles WHERE id = '<uuid_évalué>';
-- ============================================================================
