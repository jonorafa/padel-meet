-- ============================================================================
-- PADEL MEET — Migration 017 : Réparation du mode "Coéquipier" (teammate)
-- ============================================================================
-- BUG (régression introduite par la migration 014) :
--   La 005 gérait explicitement le résultat 'teammate' → les DEUX joueurs étaient
--   stockés 'win' ("on a tous les deux gagné", cf. le bouton dans l'UI).
--   La réécriture 014 a SUPPRIMÉ ce cas : elle insérait `result = submitter_result`
--   ( = 'teammate' ) côté soumetteur, et 'draw' côté adversaire.
--
--   Or `match_history.result` a une contrainte CHECK qui n'autorise QUE
--   ('win','loss','draw'). Insérer 'teammate' VIOLE la contrainte → l'INSERT
--   lève une exception → toute la confirmation échoue. Conséquence live :
--   **confirmer un match entre coéquipiers était devenu impossible** (erreur).
--
-- CORRECTIF :
--   On restaure le mode coéquipier (les deux 'win'), en CONSERVANT les acquis de
--   014/016 : ELO neutralisé (elo_delta = 0), stats via le SEUL trigger
--   trg_sync_profile_stats (pas de +1 explicite), et crédit de confiance "play"
--   (+5 aux deux si niveaux proches ≤ 0.5) — qui a tout son sens pour des
--   coéquipiers de même niveau.
--
-- Idempotent — ré-exécutable.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.confirm_match_result(p_pending_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id        UUID := auth.uid();
  v_pending          pending_match_results%ROWTYPE;
  v_submitter_level  NUMERIC(3,1);
  v_opponent_level   NUMERIC(3,1);
  v_submitter_stored TEXT;
  v_opponent_result  TEXT;
  v_opponent_name    TEXT;
  v_level_gap        NUMERIC(4,2);
  v_play_amount      NUMERIC(5,2);
BEGIN
  SELECT * INTO v_pending FROM pending_match_results WHERE id = p_pending_id;

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

  -- ── Résultats stockés selon le mode ──────────────────────────────────────
  IF v_pending.submitter_result = 'teammate' THEN
    -- Mode coéquipier : on a joué ENSEMBLE et gagné → les deux 'win'.
    v_submitter_stored := 'win';
    v_opponent_result  := 'win';
  ELSE
    -- Mode adversaire classique.
    v_submitter_stored := v_pending.submitter_result;            -- 'win' | 'loss' | 'draw'
    v_opponent_result  := CASE v_pending.submitter_result
      WHEN 'win'  THEN 'loss'
      WHEN 'loss' THEN 'win'
      ELSE 'draw'
    END;
  END IF;

  SELECT COALESCE(level, 3.5) INTO v_submitter_level FROM profiles WHERE id = v_pending.submitter_id;
  SELECT COALESCE(level, 3.5) INTO v_opponent_level  FROM profiles WHERE id = v_pending.opponent_id;
  SELECT COALESCE(name, 'Votre adversaire') INTO v_opponent_name FROM profiles WHERE id = v_caller_id;

  -- ELO neutralisé (décision produit 1) : le niveau ne bouge pas par match.
  -- Stats (matches_played / wins) gérées par le SEUL trigger trg_sync_profile_stats.
  INSERT INTO match_history(player_id, opponent_id, result, score, elo_delta, played_at)
  VALUES
    (v_pending.submitter_id, v_pending.opponent_id, v_submitter_stored,
     v_pending.score, 0, v_pending.played_at),
    (v_pending.opponent_id, v_pending.submitter_id, v_opponent_result,
     v_pending.score, 0, v_pending.played_at);

  UPDATE pending_match_results
  SET status = 'confirmed', confirmed_at = NOW()
  WHERE id = p_pending_id;

  -- CANAL "play" : niveaux proches (≤ 0.5) → +5 chacun (borné, recalcule l'indice).
  -- S'applique aussi en mode coéquipier (jouer avec quelqu'un de son niveau).
  v_level_gap   := ABS(v_submitter_level - v_opponent_level);
  v_play_amount := CASE WHEN v_level_gap <= 0.5 THEN 5.0 ELSE 0.0 END;

  PERFORM public.add_confidence_credit(
    v_pending.submitter_id, v_pending.opponent_id, 'play', v_play_amount,
    'play gap=' || v_level_gap::TEXT
  );
  PERFORM public.add_confidence_credit(
    v_pending.opponent_id, v_pending.submitter_id, 'play', v_play_amount,
    'play gap=' || v_level_gap::TEXT
  );

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

-- ============================================================================
-- ✅ Migration 017 terminée
-- ============================================================================
