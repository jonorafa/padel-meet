-- ============================================================
-- PADEL MEET — Chantier 3 : Anti-Fraude & Validation
-- ============================================================
-- À exécuter dans Supabase SQL Editor (onglet + → New query)
--
-- Ce chantier sécurise:
--   1. L'écriture dans match_history (validation à 2 joueurs)
--   2. Le système de peer evaluation (vérification présence + pondération)
--   3. Le confidence_rate (cap de vélocité)
-- ============================================================


-- ============================================================
-- PARTIE 1 : Table pending_match_results (scores en attente)
-- ============================================================

CREATE TABLE IF NOT EXISTS pending_match_results (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submitter_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  opponent_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  match_id        UUID REFERENCES matches(id) ON DELETE CASCADE, -- le like-match
  submitter_result TEXT NOT NULL CHECK (submitter_result IN ('win', 'loss', 'draw')),
  score           TEXT NOT NULL,
  played_at       TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  status          TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'confirmed', 'rejected', 'expired')),
  created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW() + INTERVAL '72 hours',
  -- Empêche les doublons : 1 seul pending par paire de joueurs à la fois
  CONSTRAINT unique_pending_per_pair UNIQUE (submitter_id, opponent_id, status)
);

CREATE INDEX IF NOT EXISTS idx_pending_opponent ON pending_match_results(opponent_id, status);
CREATE INDEX IF NOT EXISTS idx_pending_submitter ON pending_match_results(submitter_id, status);
CREATE INDEX IF NOT EXISTS idx_pending_expires ON pending_match_results(expires_at) WHERE status = 'pending';

ALTER TABLE pending_match_results ENABLE ROW LEVEL SECURITY;

-- RLS : un joueur voit les pending qui le concernent (en tant que soumetteur OU adversaire)
CREATE POLICY "Users can read pending results involving them"
  ON pending_match_results FOR SELECT
  USING (auth.uid() = submitter_id OR auth.uid() = opponent_id);

-- Note : aucune INSERT/UPDATE/DELETE directe — tout passe par les fonctions SECURITY DEFINER


-- ============================================================
-- PARTIE 2 : Table confidence_log (suivi de vélocité)
-- ============================================================

CREATE TABLE IF NOT EXISTS confidence_log (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  evaluator_id    UUID REFERENCES profiles(id) ON DELETE SET NULL,
  delta           NUMERIC(5,2) NOT NULL,
  evaluator_weight NUMERIC(3,2) NOT NULL DEFAULT 1.00,
  reason          TEXT,
  created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_confidence_log_user_date
  ON confidence_log(user_id, created_at);

ALTER TABLE confidence_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read their own confidence log"
  ON confidence_log FOR SELECT
  USING (auth.uid() = user_id);


-- ============================================================
-- PARTIE 3 : Sécurisation de match_history (RLS strict)
-- ============================================================

-- Supprime toutes les anciennes policies permissives
ALTER TABLE match_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow insert match_history" ON match_history;
DROP POLICY IF EXISTS "Users can insert their own matches" ON match_history;
DROP POLICY IF EXISTS "Anyone can insert match_history" ON match_history;

-- Lecture : un joueur voit ses propres matchs
DROP POLICY IF EXISTS "Users can read their matches" ON match_history;
CREATE POLICY "Users can read their matches"
  ON match_history FOR SELECT
  USING (auth.uid() = player_id OR auth.uid() = opponent_id);

-- INSERT bloqué côté client — uniquement via SECURITY DEFINER functions
-- (Pas de policy INSERT = personne ne peut INSERT directement)

-- UPDATE/DELETE bloqués
-- (Pas de policy = bloqué)


-- ============================================================
-- PARTIE 4 : Function submit_match_result
-- ============================================================
-- Crée un pending_match_result et notifie l'adversaire
-- Le résultat n'est PAS encore dans match_history → ELO inchangé
-- ============================================================

CREATE OR REPLACE FUNCTION submit_match_result(
  p_opponent_id    UUID,
  p_result         TEXT,    -- 'win' | 'loss' | 'draw' du point de vue du soumetteur
  p_score          TEXT,    -- ex: "6-4 6-2"
  p_played_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_submitter_id  UUID := auth.uid();
  v_match_id      UUID;
  v_pending_id    UUID;
BEGIN
  -- 1. Validation : pas s'auto-soumettre
  IF v_submitter_id = p_opponent_id THEN
    RAISE EXCEPTION 'Cannot submit a match against yourself';
  END IF;

  -- 2. Validation : result doit être valide
  IF p_result NOT IN ('win', 'loss', 'draw') THEN
    RAISE EXCEPTION 'Invalid result: must be win, loss, or draw';
  END IF;

  -- 3. Vérifie qu'il existe un like-match entre les 2 joueurs
  SELECT id INTO v_match_id
  FROM matches
  WHERE (player1_id = v_submitter_id AND player2_id = p_opponent_id)
     OR (player1_id = p_opponent_id AND player2_id = v_submitter_id)
  LIMIT 1;

  IF v_match_id IS NULL THEN
    RAISE EXCEPTION 'You must be matched with this player before submitting a result';
  END IF;

  -- 4. Supprime les éventuels pending expirés entre ces joueurs
  UPDATE pending_match_results
  SET status = 'expired'
  WHERE status = 'pending'
    AND expires_at < NOW()
    AND (
      (submitter_id = v_submitter_id AND opponent_id = p_opponent_id) OR
      (submitter_id = p_opponent_id AND opponent_id = v_submitter_id)
    );

  -- 5. Vérifie qu'il n'y a pas déjà un pending entre eux
  IF EXISTS (
    SELECT 1 FROM pending_match_results
    WHERE status = 'pending'
      AND (
        (submitter_id = v_submitter_id AND opponent_id = p_opponent_id) OR
        (submitter_id = p_opponent_id AND opponent_id = v_submitter_id)
      )
  ) THEN
    RAISE EXCEPTION 'A pending match result already exists between you and this player';
  END IF;

  -- 6. Crée le pending result
  INSERT INTO pending_match_results(
    submitter_id, opponent_id, match_id,
    submitter_result, score, played_at
  )
  VALUES (
    v_submitter_id, p_opponent_id, v_match_id,
    p_result, p_score, p_played_at
  )
  RETURNING id INTO v_pending_id;

  -- 7. Crée une notification pour l'adversaire
  INSERT INTO notifications(user_id, from_id, type, text_fr, text_en, text_he, read)
  VALUES (
    p_opponent_id, v_submitter_id, 'match_result_pending',
    'a soumis un score à confirmer',
    'submitted a score to confirm',
    'הגיש תוצאה לאישור',
    false
  );

  RETURN v_pending_id;
END;
$$;


-- ============================================================
-- PARTIE 5 : Function confirm_match_result
-- ============================================================
-- L'adversaire confirme le score → écriture dans match_history
-- Calcule l'ELO delta de manière déterministe côté serveur
-- ============================================================

CREATE OR REPLACE FUNCTION confirm_match_result(p_pending_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_caller_id        UUID := auth.uid();
  v_pending          pending_match_results%ROWTYPE;
  v_submitter_level  NUMERIC(3,1);
  v_opponent_level   NUMERIC(3,1);
  v_submitter_delta  INT;
  v_opponent_delta   INT;
  v_opponent_result  TEXT;
BEGIN
  -- 1. Récupère le pending
  SELECT * INTO v_pending
  FROM pending_match_results
  WHERE id = p_pending_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pending match result not found';
  END IF;

  -- 2. Vérifie : seul l'adversaire (pas le soumetteur) peut confirmer
  IF v_caller_id != v_pending.opponent_id THEN
    RAISE EXCEPTION 'Only the opponent can confirm this match result';
  END IF;

  -- 3. Vérifie le statut
  IF v_pending.status != 'pending' THEN
    RAISE EXCEPTION 'This match result is not pending (current status: %)', v_pending.status;
  END IF;

  -- 4. Vérifie qu'il n'est pas expiré
  IF v_pending.expires_at < NOW() THEN
    UPDATE pending_match_results SET status = 'expired' WHERE id = p_pending_id;
    RAISE EXCEPTION 'This match result has expired';
  END IF;

  -- 5. Calcule le résultat inverse pour l'adversaire
  v_opponent_result := CASE v_pending.submitter_result
    WHEN 'win'  THEN 'loss'
    WHEN 'loss' THEN 'win'
    ELSE 'draw'
  END;

  -- 6. Récupère les niveaux pour calculer l'ELO
  SELECT COALESCE(level, 3.5) INTO v_submitter_level FROM profiles WHERE id = v_pending.submitter_id;
  SELECT COALESCE(level, 3.5) INTO v_opponent_level  FROM profiles WHERE id = v_pending.opponent_id;

  -- 7. Calcule les deltas ELO simplifiés (déterministe)
  -- Base : ±20 si win/loss, +5/-5 si draw, modulé par différence de niveau
  IF v_pending.submitter_result = 'win' THEN
    v_submitter_delta := GREATEST(5, LEAST(40, ROUND(20 + (v_opponent_level - v_submitter_level) * 5)));
    v_opponent_delta  := -v_submitter_delta;
  ELSIF v_pending.submitter_result = 'loss' THEN
    v_opponent_delta  := GREATEST(5, LEAST(40, ROUND(20 + (v_submitter_level - v_opponent_level) * 5)));
    v_submitter_delta := -v_opponent_delta;
  ELSE -- draw
    v_submitter_delta := 0;
    v_opponent_delta  := 0;
  END IF;

  -- 8. Insère DEUX rows dans match_history (perspective de chaque joueur)
  INSERT INTO match_history(player_id, opponent_id, result, score, elo_delta, played_at)
  VALUES
    (v_pending.submitter_id, v_pending.opponent_id, v_pending.submitter_result,
     v_pending.score, v_submitter_delta, v_pending.played_at),
    (v_pending.opponent_id,  v_pending.submitter_id, v_opponent_result,
     v_pending.score, v_opponent_delta,  v_pending.played_at);

  -- 9. Marque le pending comme confirmé
  UPDATE pending_match_results
  SET status = 'confirmed'
  WHERE id = p_pending_id;

  -- 10. Notifie le soumetteur que le score est confirmé
  INSERT INTO notifications(user_id, from_id, type, text_fr, text_en, text_he, read)
  VALUES (
    v_pending.submitter_id, v_caller_id, 'match_result_confirmed',
    'a confirmé votre score',
    'confirmed your score',
    'אישר את התוצאה שלך',
    false
  );
END;
$$;


-- ============================================================
-- PARTIE 6 : Function reject_match_result
-- ============================================================
-- L'adversaire rejette le score → suppression simple, aucun ELO touché
-- ============================================================

CREATE OR REPLACE FUNCTION reject_match_result(p_pending_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_caller_id  UUID := auth.uid();
  v_pending    pending_match_results%ROWTYPE;
BEGIN
  SELECT * INTO v_pending
  FROM pending_match_results
  WHERE id = p_pending_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pending match result not found';
  END IF;

  IF v_caller_id != v_pending.opponent_id THEN
    RAISE EXCEPTION 'Only the opponent can reject this match result';
  END IF;

  IF v_pending.status != 'pending' THEN
    RAISE EXCEPTION 'This match result is not pending';
  END IF;

  -- Marque comme rejected
  UPDATE pending_match_results
  SET status = 'rejected'
  WHERE id = p_pending_id;

  -- Notifie le soumetteur
  INSERT INTO notifications(user_id, from_id, type, text_fr, text_en, text_he, read)
  VALUES (
    v_pending.submitter_id, v_caller_id, 'match_result_rejected',
    'a rejeté votre score',
    'rejected your score',
    'דחה את התוצאה שלך',
    false
  );
END;
$$;


-- ============================================================
-- PARTIE 7 : Function expire_old_pending_results (CRON)
-- ============================================================
-- À appeler périodiquement (ex: pg_cron toutes les heures)
-- Marque les pending > 72h comme 'expired'
-- ============================================================

CREATE OR REPLACE FUNCTION expire_old_pending_results()
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_count INT;
BEGIN
  UPDATE pending_match_results
  SET status = 'expired'
  WHERE status = 'pending'
    AND expires_at < NOW();
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;


-- ============================================================
-- PARTIE 8 : Update submit_peer_evaluation (anti-fraude)
-- ============================================================
-- Améliorations :
--   1. Vérifie que l'évaluateur était bien dans le match
--   2. Pondère le delta par le confidence_rate de l'évaluateur
--   3. Cap de vélocité : max +10% par mois
-- ============================================================

CREATE OR REPLACE FUNCTION submit_peer_evaluation(
  p_match_id       UUID,
  p_evaluated_id   UUID,
  p_proposed_level NUMERIC
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_evaluator_id        UUID := auth.uid();
  v_current_level       NUMERIC(3,1);
  v_gap                 NUMERIC(3,2);
  v_base_delta          NUMERIC(5,2);
  v_weight              NUMERIC(3,2);
  v_final_delta         NUMERIC(5,2);
  v_evaluator_confidence NUMERIC(5,2);
  v_monthly_gain        NUMERIC(5,2);
  v_was_in_match        BOOLEAN;
BEGIN
  -- 1. Sécurité de base : pas s'auto-évaluer
  IF v_evaluator_id = p_evaluated_id THEN
    RAISE EXCEPTION 'Cannot evaluate yourself';
  END IF;

  -- 2. NOUVEAU : Vérifie que l'évaluateur ET l'évalué étaient dans le match
  SELECT EXISTS (
    SELECT 1 FROM matches
    WHERE id = p_match_id
      AND (
        (player1_id = v_evaluator_id AND player2_id = p_evaluated_id) OR
        (player1_id = p_evaluated_id AND player2_id = v_evaluator_id)
      )
  ) INTO v_was_in_match;

  IF NOT v_was_in_match THEN
    RAISE EXCEPTION 'You were not in this match — cannot evaluate this player';
  END IF;

  -- 3. Cooldown : 1 seule évaluation par paire par 7 jours
  IF EXISTS (
    SELECT 1 FROM peer_evaluations
    WHERE evaluator_id = v_evaluator_id
      AND evaluated_id = p_evaluated_id
      AND created_at > NOW() - INTERVAL '7 days'
  ) THEN
    RAISE EXCEPTION 'Already evaluated this player in the last 7 days';
  END IF;

  -- 4. Récupère le niveau actuel et confidence de l'évaluateur
  SELECT COALESCE(level, 3.5)
  INTO v_current_level
  FROM profiles
  WHERE id = p_evaluated_id;

  SELECT COALESCE(confidence_rate, 50)
  INTO v_evaluator_confidence
  FROM profiles
  WHERE id = v_evaluator_id;

  -- 5. Calcule le delta de base selon l'écart
  v_gap := ABS(p_proposed_level - v_current_level);

  IF    v_gap <= 0.25 THEN v_base_delta :=  3.00;
  ELSIF v_gap <= 0.50 THEN v_base_delta :=  1.00;
  ELSIF v_gap <= 1.00 THEN v_base_delta := -2.00;
  ELSE                     v_base_delta := -5.00;
  END IF;

  -- 6. NOUVEAU : Pondère par le confidence_rate de l'évaluateur
  -- 20% confiance → poids 0.4x | 50% → 1.0x | 80% → 1.6x | 100% → 2.0x
  v_weight := v_evaluator_confidence / 50.0;
  v_final_delta := v_base_delta * v_weight;

  -- 7. NOUVEAU : Cap de vélocité — max +10% gagné dans les 30 derniers jours
  IF v_final_delta > 0 THEN
    SELECT COALESCE(SUM(delta), 0)
    INTO v_monthly_gain
    FROM confidence_log
    WHERE user_id = p_evaluated_id
      AND delta > 0
      AND created_at > NOW() - INTERVAL '30 days';

    -- Si déjà +10 ce mois → bloquer les gains supplémentaires
    IF v_monthly_gain >= 10 THEN
      v_final_delta := 0;
    ELSIF v_monthly_gain + v_final_delta > 10 THEN
      -- Plafonner au reste disponible
      v_final_delta := 10 - v_monthly_gain;
    END IF;
  END IF;

  -- 8. Enregistre l'évaluation
  INSERT INTO peer_evaluations(match_id, evaluator_id, evaluated_id, proposed_level)
  VALUES (p_match_id, v_evaluator_id, p_evaluated_id, p_proposed_level);

  -- 9. Log dans confidence_log (pour traçabilité + cap mensuel)
  INSERT INTO confidence_log(user_id, evaluator_id, delta, evaluator_weight, reason)
  VALUES (p_evaluated_id, v_evaluator_id, v_final_delta, v_weight,
          'peer_evaluation gap=' || v_gap::TEXT);

  -- 10. Met à jour le confidence_rate (borné 0–100)
  UPDATE profiles
  SET
    confidence_rate = GREATEST(0, LEAST(100, confidence_rate + v_final_delta)),
    updated_at      = NOW()
  WHERE id = p_evaluated_id;
END;
$$;


-- ============================================================
-- PARTIE 9 : Realtime exposure
-- ============================================================

ALTER PUBLICATION supabase_realtime ADD TABLE pending_match_results;


-- ============================================================
-- ✅ MIGRATION CHANTIER 3 TERMINÉE
-- ============================================================
-- Récap des sécurités installées :
--   ✓ match_history : INSERT bloqué côté client (RLS strict)
--   ✓ submit_match_result() : vérifie le like-match existe
--   ✓ confirm_match_result() : seul l'adversaire peut confirmer
--   ✓ reject_match_result() : seul l'adversaire peut rejeter
--   ✓ Expiration auto 72h
--   ✓ peer_evaluation : vérifie présence dans le match
--   ✓ peer_evaluation : pondère par confidence de l'évaluateur
--   ✓ peer_evaluation : cap +10%/mois
-- ============================================================
