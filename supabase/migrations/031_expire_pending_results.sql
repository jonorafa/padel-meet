-- ============================================================================
-- Migration 031 : un score périmé ne peut plus être « refusé »
-- ============================================================================
-- expire_old_pending_results() existe depuis la migration 001 mais n'a JAMAIS
-- été appelée : ni par le client, ni par un workflow, et pg_cron n'était pas
-- installé. Les résultats en attente restaient donc `pending` indéfiniment,
-- bien après leur fenêtre de 72 h (expires_at = now() + 72h).
--
-- Deux des trois chemins d'action se protégeaient déjà tout seuls :
--   • submit_match_result expire les pending dépassés de la paire concernée
--     avant de vérifier qu'aucun n'est en cours (donc l'index unique partiel
--     de la migration 027 ne bloque personne durablement) ;
--   • confirm_match_result passe la ligne à 'expired' puis lève une erreur.
--
-- reject_match_result, lui, ne regardait pas expires_at. Sur une ligne
-- périmée — toujours affichée dans PendingMatchesPanel, où le compte à
-- rebours indique « expiré » mais où les deux boutons restent actifs :
--   • « Confirmer » échoue correctement ;
--   • « Refuser » RÉUSSIT, incrémente matches.score_attempts, notifie
--     l'auteur « a rejeté votre score », et au 3e passe score_locked = TRUE.
--
-- Le match devient alors définitivement non enregistrable, et l'auteur du
-- score est pénalisé parce que son adversaire n'a pas répondu dans les
-- délais. L'expiration doit être neutre : elle ne doit pas coûter une des
-- trois tentatives ni compter comme un désaccord.
--
-- Correctif : même garde que confirm_match_result (auto-réparation de la
-- ligne, puis erreur), et on fait enfin tourner le balayage pour que les
-- lignes mortes cessent d'encombrer le panneau des deux joueurs.
-- ============================================================================

-- ── 1. Garde d'expiration, strictement symétrique à confirm_match_result ───
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

  -- AJOUT (031) : un score dépassé n'est plus refusable. Sans ce bloc, un
  -- refus tardif consommait une des 3 tentatives et pouvait verrouiller le
  -- match pour toujours. On répare la ligne au passage, comme le fait
  -- confirm_match_result, pour qu'elle disparaisse du panneau.
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

-- CREATE OR REPLACE réinitialise les droits : on referme sur PUBLIC comme en
-- migration 030, en laissant authenticated appeler la fonction (c'est bien le
-- client qui refuse un score).
REVOKE EXECUTE ON FUNCTION public.reject_match_result(uuid) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.reject_match_result(uuid) TO authenticated;

-- ── 2. Le balayage tourne enfin ────────────────────────────────────────────
-- Sans lui, les lignes périmées restent visibles dans le panneau des deux
-- joueurs jusqu'à ce que quelqu'un tente une action dessus. Toutes les heures
-- suffit largement pour une fenêtre de 72 h.
CREATE EXTENSION IF NOT EXISTS pg_cron;

SELECT cron.schedule(
  'expire-pending-match-results',
  '0 * * * *',
  $$SELECT public.expire_old_pending_results()$$
);
