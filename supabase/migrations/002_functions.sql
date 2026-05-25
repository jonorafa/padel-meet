-- ============================================================================
-- PADEL MEET — Migration 002 : Fonctions & Triggers
-- ============================================================================
-- Toutes les fonctions SECURITY DEFINER dans leur version finale.
-- ORDER IMPORTANT :
--   1. sync_profile_stats + trigger (utilisé par confirm_match_result)
--   2. get_player_stats
--   3. submit_peer_evaluation (version finale avec pondération)
--   4. submit_match_result (version finale avec score_locked check)
--   5. confirm_match_result (version finale avec notifications)
--   6. reject_match_result (version finale avec lock à 3 rejets)
--   7. expire_old_pending_results
--   8. Triggers profile_photos
-- ============================================================================


-- ─────────────────────────────────────────────────────────────────────────────
-- 1. sync_profile_stats — Trigger sur match_history
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.sync_profile_stats()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE public.profiles
  SET
    matches_played = (
      SELECT COUNT(*) FROM public.match_history WHERE player_id = NEW.player_id
    ),
    wins = (
      SELECT COUNT(*) FROM public.match_history
      WHERE player_id = NEW.player_id AND result = 'win'
    ),
    updated_at = NOW()
  WHERE id = NEW.player_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_profile_stats ON public.match_history;
CREATE TRIGGER trg_sync_profile_stats
  AFTER INSERT OR UPDATE ON public.match_history
  FOR EACH ROW EXECUTE FUNCTION public.sync_profile_stats();


-- ─────────────────────────────────────────────────────────────────────────────
-- 2. get_player_stats
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_player_stats(p_player_id UUID)
RETURNS TABLE(matches_played INT, wins INT, streak INT)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_streak INT := 0;
  rec      RECORD;
BEGIN
  SELECT
    COUNT(*)::INT,
    COUNT(*) FILTER (WHERE result = 'win')::INT
  INTO matches_played, wins
  FROM public.match_history
  WHERE player_id = p_player_id;

  FOR rec IN
    SELECT result
    FROM public.match_history
    WHERE player_id = p_player_id
    ORDER BY played_at DESC
  LOOP
    IF rec.result = 'win' THEN v_streak := v_streak + 1;
    ELSE EXIT;
    END IF;
  END LOOP;

  streak := v_streak;
  RETURN NEXT;
END;
$$;


-- ─────────────────────────────────────────────────────────────────────────────
-- 3. submit_peer_evaluation — version finale (chantier 8)
--    • Vérifie que l'évaluateur était dans le match
--    • Pondère le delta par le confidence_rate de l'évaluateur
--    • Cap de vélocité (+10 max / 30 jours)
-- ─────────────────────────────────────────────────────────────────────────────
DROP FUNCTION IF EXISTS public.submit_peer_evaluation(UUID, UUID, INTEGER);  -- ancienne version étoiles

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

  -- Anti-doublon : 1 évaluation par paire / 7 jours
  IF EXISTS (
    SELECT 1 FROM peer_evaluations
    WHERE evaluator_id = v_evaluator_id
      AND evaluated_id = p_evaluated_id
      AND created_at > NOW() - INTERVAL '7 days'
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


-- ─────────────────────────────────────────────────────────────────────────────
-- 4. submit_match_result — version finale (chantier 10)
--    • Vérifie score_locked avant de créer
--    • Inclut numéro de tentative dans la notif
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
  IF p_result NOT IN ('win', 'loss', 'draw') THEN
    RAISE EXCEPTION 'Invalid result: must be win, loss, or draw';
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
-- 5. confirm_match_result — version finale (chantier 6 + 3)
--    • Insère dans match_history (les 2 perspectives)
--    • Calcule l'ELO delta
--    • Envoie une notification au soumetteur
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.confirm_match_result(p_pending_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id       UUID := auth.uid();
  v_pending         pending_match_results%ROWTYPE;
  v_submitter_level NUMERIC(3,1);
  v_opponent_level  NUMERIC(3,1);
  v_submitter_delta INT;
  v_opponent_delta  INT;
  v_opponent_result TEXT;
  v_opponent_name   TEXT;
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

  -- Résultat inverse pour l'adversaire
  v_opponent_result := CASE v_pending.submitter_result
    WHEN 'win'  THEN 'loss'
    WHEN 'loss' THEN 'win'
    ELSE 'draw'
  END;

  SELECT COALESCE(level, 3.5) INTO v_submitter_level FROM profiles WHERE id = v_pending.submitter_id;
  SELECT COALESCE(level, 3.5) INTO v_opponent_level  FROM profiles WHERE id = v_pending.opponent_id;
  SELECT COALESCE(name, 'Votre adversaire') INTO v_opponent_name FROM profiles WHERE id = v_caller_id;

  -- Delta ELO simplifié (déterministe, ±5 à ±40)
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

  -- Insère dans match_history (perspective des 2 joueurs)
  INSERT INTO match_history(player_id, opponent_id, result, score, elo_delta, played_at)
  VALUES
    (v_pending.submitter_id, v_pending.opponent_id, v_pending.submitter_result,
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


-- ─────────────────────────────────────────────────────────────────────────────
-- 6. reject_match_result — version finale (chantier 10)
--    • Incrémente score_attempts
--    • Verrouille le match à 3 rejets
--    • Notifie les 2 joueurs du lock ou du rejet simple
-- Note : DROP requis car le type de retour a changé VOID → JSONB
-- ─────────────────────────────────────────────────────────────────────────────
DROP FUNCTION IF EXISTS public.reject_match_result(UUID);
CREATE OR REPLACE FUNCTION public.reject_match_result(p_pending_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id   UUID := auth.uid();
  v_pending     pending_match_results%ROWTYPE;
  v_new_attempts INT;
  v_now_locked  BOOLEAN;
BEGIN
  SELECT * INTO v_pending FROM pending_match_results WHERE id = p_pending_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pending match result not found';
  END IF;
  IF v_caller_id != v_pending.opponent_id THEN
    RAISE EXCEPTION 'Only the opponent can reject this match result';
  END IF;
  IF v_pending.status != 'pending' THEN
    RAISE EXCEPTION 'This match result is not pending';
  END IF;

  UPDATE pending_match_results SET status = 'rejected' WHERE id = p_pending_id;

  UPDATE matches
  SET score_attempts = score_attempts + 1
  WHERE id = v_pending.match_id
  RETURNING score_attempts INTO v_new_attempts;

  v_now_locked := (v_new_attempts >= 3);

  IF v_now_locked THEN
    UPDATE matches SET score_locked = TRUE WHERE id = v_pending.match_id;

    -- Notifie les 2 joueurs : match inenregistrable
    INSERT INTO notifications(user_id, from_id, type, text_fr, text_en, text_he, read)
    VALUES
      (v_pending.submitter_id, v_caller_id, 'score_locked',
       '3 désaccords — ce score ne peut plus être enregistré.',
       '3 rejections — this match score can no longer be recorded.',
       '3 דחיות — לא ניתן עוד להגיש תוצאה.',
       false),
      (v_pending.opponent_id, v_pending.submitter_id, 'score_locked',
       '3 désaccords — ce score ne peut plus être enregistré.',
       '3 rejections — this match score can no longer be recorded.',
       '3 דחיות — לא ניתן עוד להגיש תוצאה.',
       false);
  ELSE
    INSERT INTO notifications(user_id, from_id, type, text_fr, text_en, text_he, read)
    VALUES (
      v_pending.submitter_id, v_caller_id, 'match_result_rejected',
      format('a rejeté votre score. Il vous reste %s tentative(s).', 3 - v_new_attempts),
      format('rejected your score. %s attempt(s) remaining.',        3 - v_new_attempts),
      format('דחה את התוצאה שלך. נותרו %s ניסיון/ות.',             3 - v_new_attempts),
      false
    );
  END IF;

  RETURN jsonb_build_object(
    'attempts',  v_new_attempts,
    'remaining', 3 - v_new_attempts,
    'locked',    v_now_locked
  );
END;
$$;


-- ─────────────────────────────────────────────────────────────────────────────
-- 7. expire_old_pending_results — à appeler périodiquement (CRON)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.expire_old_pending_results()
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE v_count INT;
BEGIN
  UPDATE public.pending_match_results
  SET status = 'expired'
  WHERE status = 'pending' AND expires_at < NOW();
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;


-- ─────────────────────────────────────────────────────────────────────────────
-- 8. Triggers profile_photos
-- ─────────────────────────────────────────────────────────────────────────────

-- Garantit 1 seule photo principale par user
CREATE OR REPLACE FUNCTION public.ensure_single_primary_photo()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_primary = TRUE THEN
    UPDATE public.profile_photos
    SET is_primary = FALSE
    WHERE user_id = NEW.user_id AND id != NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_ensure_single_primary_photo ON public.profile_photos;
CREATE TRIGGER trigger_ensure_single_primary_photo
  BEFORE INSERT OR UPDATE ON public.profile_photos
  FOR EACH ROW EXECUTE FUNCTION public.ensure_single_primary_photo();

-- Première photo = principale automatiquement
CREATE OR REPLACE FUNCTION public.auto_primary_first_photo()
RETURNS TRIGGER AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.profile_photos
    WHERE user_id = NEW.user_id AND is_primary = TRUE
  ) THEN
    NEW.is_primary := TRUE;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_auto_primary_first_photo ON public.profile_photos;
CREATE TRIGGER trigger_auto_primary_first_photo
  BEFORE INSERT ON public.profile_photos
  FOR EACH ROW EXECUTE FUNCTION public.auto_primary_first_photo();


-- ============================================================================
-- ✅ Migration 002 terminée
-- ============================================================================
