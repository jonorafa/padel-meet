-- ============================================================================
-- PADEL MEET — Migration 004 : Accept/Decline pour les propositions de match
-- ============================================================================
-- Quand un joueur envoie une "match_proposal" dans le chat, l'adversaire
-- peut maintenant Accepter ou Refuser. La réponse est enregistrée dans le
-- metadata du message original (status + respondedAt).
--
-- Cette fonction est SECURITY DEFINER car elle UPDATE un message qui n'a
-- pas été envoyé par l'appelant (sinon bloqué par RLS).
-- Elle vérifie strictement que :
--   1. Le message est bien de type 'match_proposal'
--   2. L'appelant est l'AUTRE joueur du match (pas l'auteur de la proposition)
--   3. La proposition n'a pas déjà reçu de réponse
-- ============================================================================

CREATE OR REPLACE FUNCTION public.respond_to_match_proposal(
  p_message_id UUID,
  p_accepted   BOOLEAN
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id     UUID := auth.uid();
  v_message       messages%ROWTYPE;
  v_match         matches%ROWTYPE;
  v_caller_name   TEXT;
  v_new_metadata  JSONB;
  v_status        TEXT;
BEGIN
  -- Authentifié
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  -- Récupère le message
  SELECT * INTO v_message FROM messages WHERE id = p_message_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'message_not_found';
  END IF;

  -- Doit être une proposition
  IF v_message.msg_type <> 'match_proposal' THEN
    RAISE EXCEPTION 'not_a_match_proposal';
  END IF;

  -- Ne pas répondre à sa propre proposition
  IF v_message.sender_id = v_caller_id THEN
    RAISE EXCEPTION 'cannot_respond_to_own_proposal';
  END IF;

  -- Récupère le match et vérifie que l'appelant en fait partie
  SELECT * INTO v_match FROM matches WHERE id = v_message.match_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'match_not_found';
  END IF;

  IF v_caller_id <> v_match.player1_id AND v_caller_id <> v_match.player2_id THEN
    RAISE EXCEPTION 'not_in_match';
  END IF;

  -- Vérifie qu'il n'y a pas déjà une réponse
  IF v_message.metadata ? 'status'
     AND v_message.metadata->>'status' IN ('accepted', 'declined') THEN
    RAISE EXCEPTION 'already_responded';
  END IF;

  -- Met à jour le metadata avec la réponse
  v_status := CASE WHEN p_accepted THEN 'accepted' ELSE 'declined' END;
  v_new_metadata := COALESCE(v_message.metadata, '{}'::jsonb)
    || jsonb_build_object(
      'status',      v_status,
      'respondedAt', NOW(),
      'respondedBy', v_caller_id
    );

  UPDATE messages
  SET metadata = v_new_metadata
  WHERE id = p_message_id;

  -- Récupère le nom de l'appelant pour la notif
  SELECT COALESCE(name, 'L''adversaire') INTO v_caller_name
  FROM profiles WHERE id = v_caller_id;

  -- Notifie l'auteur de la proposition
  INSERT INTO notifications(user_id, from_id, type, text_fr, text_en, text_he, read)
  VALUES (
    v_message.sender_id, v_caller_id, 'match',
    v_caller_name || (CASE WHEN p_accepted THEN ' a accepté votre proposition ✓' ELSE ' a refusé votre proposition' END),
    v_caller_name || (CASE WHEN p_accepted THEN ' accepted your match proposal ✓' ELSE ' declined your match proposal' END),
    v_caller_name || (CASE WHEN p_accepted THEN ' אישר את הצעת המשחק שלך ✓' ELSE ' דחה את הצעת המשחק שלך' END),
    false
  );

  RETURN jsonb_build_object('success', true, 'status', v_status);
END;
$$;

-- ============================================================================
-- ✅ Migration 004 terminée
-- ============================================================================
