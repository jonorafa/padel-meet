-- ============================================================================
-- CHANTIER 10 — Système de score : 3 tentatives max
-- ============================================================================
-- Flow :
--   A soumet → B refuse (tentative 1) → A soumet → B refuse (tentative 2)
--   → A soumet → B refuse (tentative 3) → ❌ match verrouillé définitivement
--   À n'importe quelle tentative : B confirme → ✅ score enregistré
--
-- La colonne score_attempts sur matches compte les REJETS cumulés.
-- score_locked = TRUE bloque toute nouvelle soumission de score.
-- ============================================================================

-- ── 1. Colonnes sur la table matches ─────────────────────────────────────────
ALTER TABLE public.matches
  ADD COLUMN IF NOT EXISTS score_attempts INT     NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS score_locked   BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN public.matches.score_attempts IS
  'Nombre de scores rejetés entre ces deux joueurs (max 3 avant lock)';
COMMENT ON COLUMN public.matches.score_locked IS
  'TRUE si 3 rejets consécutifs — aucun score ne peut plus être soumis';


-- ── 2. submit_match_result — vérifie le lock avant de créer ─────────────────
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
  -- 1. Pas s'auto-soumettre
  IF v_submitter_id = p_opponent_id THEN
    RAISE EXCEPTION 'Cannot submit a match against yourself';
  END IF;

  -- 2. Résultat valide
  IF p_result NOT IN ('win', 'loss', 'draw') THEN
    RAISE EXCEPTION 'Invalid result: must be win, loss, or draw';
  END IF;

  -- 3. Match (like mutuel) doit exister
  SELECT id, score_locked, score_attempts
  INTO v_match_id, v_locked, v_attempts
  FROM matches
  WHERE (player1_id = v_submitter_id AND player2_id = p_opponent_id)
     OR (player1_id = p_opponent_id  AND player2_id = v_submitter_id)
  LIMIT 1;

  IF v_match_id IS NULL THEN
    RAISE EXCEPTION 'You must be matched with this player before submitting a result';
  END IF;

  -- 4. Vérifie que le match n'est pas verrouillé
  IF v_locked THEN
    RAISE EXCEPTION 'score_locked: after 3 rejections this match cannot be recorded';
  END IF;

  -- 5. Expire les anciens pending entre eux
  UPDATE pending_match_results
  SET status = 'expired'
  WHERE status = 'pending'
    AND expires_at < NOW()
    AND (
      (submitter_id = v_submitter_id AND opponent_id = p_opponent_id) OR
      (submitter_id = p_opponent_id  AND opponent_id = v_submitter_id)
    );

  -- 6. Vérifie qu'il n'y a pas déjà un pending actif
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

  -- 7. Crée le pending
  INSERT INTO pending_match_results(
    submitter_id, opponent_id, match_id,
    submitter_result, score, played_at
  )
  VALUES (
    v_submitter_id, p_opponent_id, v_match_id,
    p_result, p_score, p_played_at
  )
  RETURNING id INTO v_pending_id;

  -- 8. Notifie l'adversaire (inclut numéro de tentative)
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


-- ── 3. reject_match_result — incrémente le compteur, lock à 3 ────────────────
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
  -- 1. Récupère le pending
  SELECT * INTO v_pending
  FROM pending_match_results
  WHERE id = p_pending_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pending match result not found';
  END IF;

  -- 2. Seul l'adversaire peut rejeter
  IF v_caller_id != v_pending.opponent_id THEN
    RAISE EXCEPTION 'Only the opponent can reject this match result';
  END IF;

  IF v_pending.status != 'pending' THEN
    RAISE EXCEPTION 'This match result is not pending';
  END IF;

  -- 3. Marque comme rejected
  UPDATE pending_match_results
  SET status = 'rejected'
  WHERE id = p_pending_id;

  -- 4. Incrémente score_attempts sur le match
  UPDATE matches
  SET score_attempts = score_attempts + 1
  WHERE id = v_pending.match_id
  RETURNING score_attempts INTO v_new_attempts;

  -- 5. Si 3 rejets → verrouille le match
  v_now_locked := (v_new_attempts >= 3);

  IF v_now_locked THEN
    UPDATE matches
    SET score_locked = TRUE
    WHERE id = v_pending.match_id;

    -- Notifie les deux joueurs : match inenregistrable
    INSERT INTO notifications(user_id, from_id, type, text_fr, text_en, text_he, read)
    VALUES
      (v_pending.submitter_id, v_caller_id, 'score_locked',
       '3 désaccords consécutifs — le score de ce match ne peut plus être enregistré.',
       '3 consecutive rejections — this match score can no longer be recorded.',
       '3 דחיות רצופות — לא ניתן עוד להגיש תוצאה לניצחון זה.',
       false),
      (v_pending.opponent_id, v_pending.submitter_id, 'score_locked',
       '3 désaccords consécutifs — le score de ce match ne peut plus être enregistré.',
       '3 consecutive rejections — this match score can no longer be recorded.',
       '3 דחיות רצופות — לא ניתן עוד להגיש תוצאה לניצחון זה.',
       false);
  ELSE
    -- Notifie le soumetteur du rejet + tentatives restantes
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
    'attempts',   v_new_attempts,
    'remaining',  3 - v_new_attempts,
    'locked',     v_now_locked
  );
END;
$$;


-- ── 4. Vue utilitaire pour l'UI ───────────────────────────────────────────────
-- Retourne le statut de score d'un match (tentatives, lock)
-- Usage depuis le client :
--   supabase.from('match_score_status').select('*').eq('match_id', id)
CREATE OR REPLACE VIEW public.match_score_status AS
SELECT
  m.id           AS match_id,
  m.player1_id,
  m.player2_id,
  m.score_attempts,
  m.score_locked,
  3 - m.score_attempts AS remaining_attempts,
  (SELECT id FROM pending_match_results pmr
   WHERE pmr.match_id = m.id AND pmr.status = 'pending'
   LIMIT 1)      AS current_pending_id
FROM matches m;

GRANT SELECT ON public.match_score_status TO authenticated;


-- ── 5. Vérification ──────────────────────────────────────────────────────────
SELECT
  column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'matches' AND table_schema = 'public'
  AND column_name IN ('score_attempts', 'score_locked')
ORDER BY column_name;
