-- ============================================================================
-- PADEL MEET — Migration 005 : Mode coéquipier + planification de match
-- ============================================================================
-- 1. Autorise 'teammate' comme résultat dans pending_match_results
-- 2. submit_match_result accepte 'teammate'
-- 3. confirm_match_result : teammate → les deux joueurs reçoivent 'win', delta ELO = 0
-- ============================================================================


-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Mettre à jour la contrainte CHECK sur pending_match_results
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.pending_match_results
  DROP CONSTRAINT IF EXISTS pending_match_results_submitter_result_check;

ALTER TABLE public.pending_match_results
  ADD CONSTRAINT pending_match_results_submitter_result_check
    CHECK (submitter_result IN ('win', 'loss', 'draw', 'teammate'));


-- ─────────────────────────────────────────────────────────────────────────────
-- 2. submit_match_result — accepte 'teammate'
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.submit_match_result(
  p_opponent_id UUID,
  p_result      TEXT,
  p_score       TEXT,
  p_played_at   TIMESTAMP WITH TIME ZONE DEFAULT NOW()
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_submitter_id UUID := auth.uid();
  v_match_id     UUID;
  v_pending_id   UUID;
  v_locked       BOOLEAN;
  v_attempts     INT;
BEGIN
  IF v_submitter_id = p_opponent_id THEN
    RAISE EXCEPTION 'Cannot submit a match against yourself';
  END IF;
  IF p_result NOT IN ('win', 'loss', 'draw', 'teammate') THEN
    RAISE EXCEPTION 'Invalid result: must be win, loss, draw, or teammate';
  END IF;

  SELECT id, score_locked, score_attempts
  INTO v_match_id, v_locked, v_attempts
  FROM matches
  WHERE (player1_id = v_submitter_id AND player2_id = p_opponent_id)
     OR (player1_id = p_opponent_id  AND player2_id = v_submitter_id)
  LIMIT 1;

  IF v_match_id IS NULL THEN
    RAISE EXCEPTION 'You must be matched with this player before submitting a result';
  END IF;
  IF v_locked THEN
    RAISE EXCEPTION 'score_locked: after 3 rejections this match cannot be recorded';
  END IF;

  -- Expire les anciens pending entre eux
  UPDATE pending_match_results
  SET status = 'expired'
  WHERE status = 'pending' AND expires_at < NOW()
    AND (
      (submitter_id = v_submitter_id AND opponent_id = p_opponent_id) OR
      (submitter_id = p_opponent_id  AND opponent_id = v_submitter_id)
    );

  IF EXISTS (
    SELECT 1 FROM pending_match_results
    WHERE status = 'pending'
      AND (
        (submitter_id = v_submitter_id AND opponent_id = p_opponent_id) OR
        (submitter_id = p_opponent_id  AND opponent_id = v_submitter_id)
      )
  ) THEN
    RAISE EXCEPTION 'A pending match result already exists between you and this player';
  END IF;

  INSERT INTO pending_match_results(
    submitter_id, opponent_id, match_id, submitter_result, score, played_at
  )
  VALUES (v_submitter_id, p_opponent_id, v_match_id, p_result, p_score, p_played_at)
  RETURNING id INTO v_pending_id;

  INSERT INTO notifications(user_id, from_id, type, text_fr, text_en, text_he, read)
  VALUES (
    p_opponent_id, v_submitter_id, 'match_result_pending',
    format('a soumis un score à confirmer (tentative %s/3)', v_attempts + 1),
    format('submitted a score to confirm (attempt %s/3)',    v_attempts + 1),
    format('הגיש תוצאה לאישור (ניסיון %s/3)',              v_attempts + 1),
    false
  );

  RETURN v_pending_id;
END;
$$;


-- ─────────────────────────────────────────────────────────────────────────────
-- 3. confirm_match_result — gère 'teammate' (les deux gagnent, ELO delta = 0)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.confirm_match_result(p_pending_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id           UUID := auth.uid();
  v_pending             pending_match_results%ROWTYPE;
  v_submitter_level     NUMERIC(3,1);
  v_opponent_level      NUMERIC(3,1);
  v_submitter_delta     INT;
  v_opponent_delta      INT;
  v_submitter_stored    TEXT;   -- résultat enregistré pour le soumetteur dans match_history
  v_opponent_result     TEXT;   -- résultat enregistré pour l'adversaire/coéquipier
  v_opponent_name       TEXT;
BEGIN
  SELECT * INTO v_pending
  FROM pending_match_results
  WHERE id = p_pending_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pending match result not found';
  END IF;
  IF v_caller_id != v_pending.opponent_id THEN
    RAISE EXCEPTION 'Only the opponent can confirm this match result';
  END IF;
  IF v_pending.status != 'pending' THEN
    RAISE EXCEPTION 'This match result is not pending (status: %)', v_pending.status;
  END IF;
  IF v_pending.expires_at < NOW() THEN
    UPDATE pending_match_results SET status = 'expired' WHERE id = p_pending_id;
    RAISE EXCEPTION 'This match result has expired';
  END IF;

  SELECT COALESCE(name, 'Votre adversaire') INTO v_opponent_name FROM profiles WHERE id = v_caller_id;

  IF v_pending.submitter_result = 'teammate' THEN
    -- Mode coéquipier : les deux joueurs ont gagné ensemble, pas d'ELO
    v_submitter_stored := 'win';
    v_opponent_result  := 'win';
    v_submitter_delta  := 0;
    v_opponent_delta   := 0;
  ELSE
    -- Mode adversaire classique
    v_submitter_stored := v_pending.submitter_result;
    v_opponent_result := CASE v_pending.submitter_result
      WHEN 'win'  THEN 'loss'
      WHEN 'loss' THEN 'win'
      ELSE 'draw'
    END;

    SELECT COALESCE(level, 3.5) INTO v_submitter_level FROM profiles WHERE id = v_pending.submitter_id;
    SELECT COALESCE(level, 3.5) INTO v_opponent_level  FROM profiles WHERE id = v_pending.opponent_id;

    IF v_pending.submitter_result = 'win' THEN
      v_submitter_delta := GREATEST(5, LEAST(40, ROUND(20 + (v_opponent_level - v_submitter_level) * 5)));
      v_opponent_delta  := -v_submitter_delta;
    ELSIF v_pending.submitter_result = 'loss' THEN
      v_opponent_delta  := GREATEST(5, LEAST(40, ROUND(20 + (v_submitter_level - v_opponent_level) * 5)));
      v_submitter_delta := -v_opponent_delta;
    ELSE
      v_submitter_delta := 0;
      v_opponent_delta  := 0;
    END IF;
  END IF;

  -- Insère dans match_history (perspective des 2 joueurs)
  INSERT INTO match_history(player_id, opponent_id, result, score, elo_delta, played_at)
  VALUES
    (v_pending.submitter_id, v_pending.opponent_id, v_submitter_stored,
     v_pending.score, v_submitter_delta, v_pending.played_at),
    (v_pending.opponent_id, v_pending.submitter_id, v_opponent_result,
     v_pending.score, v_opponent_delta, v_pending.played_at);

  UPDATE pending_match_results
  SET status = 'confirmed', confirmed_at = NOW()
  WHERE id = p_pending_id;

  -- Notification au soumetteur
  INSERT INTO notifications(user_id, from_id, type, text_fr, text_en, text_he, read)
  VALUES (
    v_pending.submitter_id, v_caller_id, 'match_result_confirmed',
    v_opponent_name || ' a confirmé le score ' || v_pending.score || ' ✓',
    v_opponent_name || ' confirmed the score ' || v_pending.score || ' ✓',
    v_opponent_name || ' אישר את התוצאה ' || v_pending.score || ' ✓',
    false
  );
END;
$$;
