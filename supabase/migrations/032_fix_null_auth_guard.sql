-- ============================================================================
-- Migration 032 : un appelant sans session pouvait confirmer/refuser un score
-- ============================================================================
-- confirm_match_result et reject_match_result contrôlaient l'identité ainsi :
--
--   v_caller_id UUID := auth.uid();
--   ...
--   IF v_caller_id != v_pending.opponent_id THEN
--     RAISE EXCEPTION 'Only the opponent can ...';
--   END IF;
--
-- Sans session, auth.uid() vaut NULL. Or `NULL != <uuid>` ne vaut pas TRUE
-- mais NULL, et en PL/pgSQL un IF dont la condition est NULL ne prend PAS la
-- branche : l'exception n'était jamais levée et l'exécution continuait.
-- Vérifié sur cette base :
--   select null::uuid != gen_random_uuid()  →  NULL
--   IF NULL THEN ... END IF                 →  branche non prise
--
-- Les deux fonctions étant accordées à `anon`, le scénario était concret :
-- l'auteur d'un score lit l'id de son propre pending (la policy RLS l'y
-- autorise, il est submitter), puis rappelle /rest/v1/rpc/confirm_match_result
-- SANS jeton — la clé publishable suffit, elle est publique par conception.
-- auth.uid() = NULL, la garde ne se déclenche pas, et il confirme lui-même son
-- résultat : écriture dans match_history, crédits de confiance « play » aux
-- deux joueurs, notification. La confirmation à deux parties — le mécanisme
-- anti-triche dont dépend tout le système de niveau — était contournable.
-- Idem pour reject_match_result (score_attempts, puis score_locked à 3).
--
-- Ce n'était pas une omission de style : respond_to_match_proposal et
-- submit_peer_evaluation ont bien, elles, un `IF v_… IS NULL THEN` explicite,
-- et submit_match_result échoue de fait (un submitter NULL ne correspond à
-- aucun match). Seules ces deux-là avaient été écrites sans.
--
-- Correctif en trois couches :
--   1. garde `IS NULL` explicite, au même format que les fonctions saines ;
--   2. `IS DISTINCT FROM` au lieu de `!=` — vrai dès qu'un seul côté est NULL,
--      donc correct même si la garde 1 venait à sauter ;
--   3. retrait d'EXECUTE à anon et PUBLIC : ces deux actions supposent une
--      session. S'appuyer sur le seul GRANT serait fragile — un CREATE OR
--      REPLACE réinitialise les droits (c'est arrivé en migration 031) — d'où
--      les gardes en dur dans le corps.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.confirm_match_result(p_pending_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
  -- AJOUT (032) : sans session, auth.uid() est NULL et la comparaison plus
  -- bas renverrait NULL — donc aucune exception. On refuse d'emblée.
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT * INTO v_pending FROM pending_match_results WHERE id = p_pending_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pending match result not found';
  END IF;
  -- IS DISTINCT FROM (032) : vrai dès qu'un seul des deux côtés est NULL.
  IF v_caller_id IS DISTINCT FROM v_pending.opponent_id THEN
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
$function$;

CREATE OR REPLACE FUNCTION public.reject_match_result(p_pending_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_caller_id   UUID := auth.uid();
  v_pending     pending_match_results%ROWTYPE;
  v_new_attempts INT;
  v_now_locked  BOOLEAN;
BEGIN
  -- AJOUT (032) : voir confirm_match_result — même faille, même correctif.
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT * INTO v_pending FROM pending_match_results WHERE id = p_pending_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pending match result not found';
  END IF;
  IF v_caller_id IS DISTINCT FROM v_pending.opponent_id THEN
    RAISE EXCEPTION 'Only the opponent can reject this match result';
  END IF;
  IF v_pending.status != 'pending' THEN
    RAISE EXCEPTION 'This match result is not pending';
  END IF;

  -- Garde d'expiration ajoutée en migration 031 : un score dépassé ne doit
  -- pas coûter une des 3 tentatives ni compter comme un désaccord.
  IF v_pending.expires_at < NOW() THEN
    UPDATE pending_match_results SET status = 'expired' WHERE id = p_pending_id;
    RAISE EXCEPTION 'This match result has expired';
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
$function$;

-- Ces deux actions supposent une session : ni anon, ni PUBLIC.
REVOKE EXECUTE ON FUNCTION public.confirm_match_result(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.reject_match_result(uuid)  FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.confirm_match_result(uuid) TO authenticated;
GRANT  EXECUTE ON FUNCTION public.reject_match_result(uuid)  TO authenticated;
