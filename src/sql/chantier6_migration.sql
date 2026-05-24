-- ============================================================================
-- CHANTIER 6 — Notifications automatiques post-match
-- ============================================================================
-- Ajoute des notifications dans les fonctions confirm_match_result et
-- reject_match_result pour que l'autre joueur soit informé en temps réel.
--
-- Idempotent : ré-exécutable sans casser l'existant.
-- ============================================================================

-- ── 1. confirm_match_result ────────────────────────────────────────────────
-- Remplace la fonction existante pour y ajouter un INSERT notifications.
CREATE OR REPLACE FUNCTION public.confirm_match_result(p_pending_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pending   pending_match_results%ROWTYPE;
  v_submitter profiles%ROWTYPE;
  v_opponent  profiles%ROWTYPE;
BEGIN
  -- Récupère le pending result
  SELECT * INTO v_pending
  FROM pending_match_results
  WHERE id = p_pending_id
    AND opponent_id = auth.uid()
    AND status = 'pending';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'pending_result_not_found';
  END IF;

  -- Met à jour le statut
  UPDATE pending_match_results
  SET status = 'confirmed', confirmed_at = now()
  WHERE id = p_pending_id;

  -- Récupère les profils pour les noms
  SELECT * INTO v_submitter FROM profiles WHERE id = v_pending.submitter_id;
  SELECT * INTO v_opponent  FROM profiles WHERE id = v_pending.opponent_id;

  -- Notifie le soumetteur que son score a été confirmé
  INSERT INTO notifications (user_id, type, from_id, text_fr, text_en, text_he)
  VALUES (
    v_pending.submitter_id,
    'match',
    v_pending.opponent_id,
    COALESCE(v_opponent.name, 'Votre adversaire') || ' a confirmé le score ' || v_pending.score || ' ✓',
    COALESCE(v_opponent.name, 'Your opponent') || ' confirmed the score ' || v_pending.score || ' ✓',
    COALESCE(v_opponent.name, 'היריב שלך') || ' אישר את התוצאה ' || v_pending.score || ' ✓'
  );
END;
$$;

-- ── 2. reject_match_result ─────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.reject_match_result(p_pending_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pending   pending_match_results%ROWTYPE;
  v_opponent  profiles%ROWTYPE;
BEGIN
  -- Récupère le pending result
  SELECT * INTO v_pending
  FROM pending_match_results
  WHERE id = p_pending_id
    AND opponent_id = auth.uid()
    AND status = 'pending';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'pending_result_not_found';
  END IF;

  -- Met à jour le statut
  UPDATE pending_match_results
  SET status = 'rejected', confirmed_at = now()
  WHERE id = p_pending_id;

  -- Récupère le profil de l'adversaire
  SELECT * INTO v_opponent FROM profiles WHERE id = v_pending.opponent_id;

  -- Notifie le soumetteur que son score a été refusé
  INSERT INTO notifications (user_id, type, from_id, text_fr, text_en, text_he)
  VALUES (
    v_pending.submitter_id,
    'match',
    v_pending.opponent_id,
    COALESCE(v_opponent.name, 'Votre adversaire') || ' a contesté le score ' || v_pending.score || ' ✗',
    COALESCE(v_opponent.name, 'Your opponent') || ' disputed the score ' || v_pending.score || ' ✗',
    COALESCE(v_opponent.name, 'היריב שלך') || ' ערער על התוצאה ' || v_pending.score || ' ✗'
  );
END;
$$;

-- ── 3. submit_peer_evaluation (si elle n'existe pas encore) ────────────────
CREATE OR REPLACE FUNCTION public.submit_peer_evaluation(
  p_match_id     UUID,
  p_evaluated_id UUID,
  p_rating       INTEGER  -- 1 à 5 étoiles
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_evaluator profiles%ROWTYPE;
BEGIN
  IF p_rating < 1 OR p_rating > 5 THEN
    RAISE EXCEPTION 'invalid_rating';
  END IF;

  SELECT * INTO v_evaluator FROM profiles WHERE id = auth.uid();

  -- Insère ou met à jour l'évaluation
  INSERT INTO peer_evaluations (evaluator_id, evaluated_id, match_id, rating, created_at)
  VALUES (auth.uid(), p_evaluated_id, p_match_id, p_rating, now())
  ON CONFLICT (evaluator_id, evaluated_id, match_id)
  DO UPDATE SET rating = EXCLUDED.rating, created_at = now();

  -- Notifie l'évalué
  INSERT INTO notifications (user_id, type, from_id, text_fr, text_en, text_he)
  VALUES (
    p_evaluated_id,
    'eval',
    auth.uid(),
    COALESCE(v_evaluator.name, 'Un joueur') || ' vous a donné ' || p_rating || ' étoile' || CASE WHEN p_rating > 1 THEN 's' ELSE '' END,
    COALESCE(v_evaluator.name, 'A player') || ' rated you ' || p_rating || ' star' || CASE WHEN p_rating > 1 THEN 's' ELSE '' END,
    COALESCE(v_evaluator.name, 'שחקן') || ' נתן לך ' || p_rating || ' כוכב' || CASE WHEN p_rating > 1 THEN 'ים' ELSE '' END
  );
END;
$$;

-- ============================================================================
-- FIN
--
-- À vérifier dans Supabase Dashboard :
--   • Database → Functions → confirm_match_result, reject_match_result, submit_peer_evaluation
--   • Tester : confirmer un score → vérifier que notifications contient 1 ligne
-- ============================================================================
