-- ============================================================================
-- PADEL MEET — Migration 014 : Cohérence backend (niveau / confiance / stats)
-- ============================================================================
-- Consolide en UNE migration officielle l'état INTENTIONNEL des fonctions, qui
-- avait dérivé via des patchs manuels (src/sql/chantier13/14). À partir d'ici,
-- `supabase/migrations/` est de nouveau LA source de vérité (plus de db query
-- manuel hors migration).
--
-- Décisions produit :
--   1. NIVEAU = quiz + ré-évaluation mensuelle uniquement. L'ELO n'est jamais
--      appliqué au niveau → neutralisé (elo_delta = 0).
--   2. INDICE DE CONFIANCE = modèle 50/50, MONOTONE (ne baisse jamais) :
--        • Canal "peer" (max +25) : accord des évaluations de pairs avec le
--          niveau déclaré. Proche → monte, loin → stagne (jamais négatif).
--        • Canal "play" (max +25) : matchs confirmés contre un adversaire de
--          niveau similaire.
--      confidence_rate = 50 + min(25, Σpeer) + min(25, Σplay), borné [50,100].
--
-- Corrections de bugs :
--   • Double comptage matches_played/wins (confirm_match_result faisait +1 alors
--     que le trigger sync_profile_stats recalcule déjà COUNT(*)). → on retire le
--     +1 explicite, le trigger reste la seule source.
--   • confidence_log redevient le registre (ledger) des deux canaux.
--
-- Idempotent — ré-exécutable.
-- ============================================================================


-- ─────────────────────────────────────────────────────────────────────────────
-- 1. recompute_confidence_rate — recalcule depuis le ledger (déterministe)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.recompute_confidence_rate(p_user UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_peer NUMERIC;
  v_play NUMERIC;
BEGIN
  SELECT
    GREATEST(0, LEAST(25, COALESCE(SUM(delta) FILTER (WHERE reason LIKE 'peer%'), 0))),
    GREATEST(0, LEAST(25, COALESCE(SUM(delta) FILTER (WHERE reason LIKE 'play%'), 0)))
  INTO v_peer, v_play
  FROM confidence_log
  WHERE user_id = p_user;

  UPDATE profiles
  SET confidence_rate = LEAST(100, 50 + v_peer + v_play),
      updated_at      = NOW()
  WHERE id = p_user;
END;
$$;


-- ─────────────────────────────────────────────────────────────────────────────
-- 2. add_confidence_credit — ajoute un crédit (≥0) borné au plafond du canal
--    Puis recalcule confidence_rate. Garantit la monotonie.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.add_confidence_credit(
  p_user      UUID,
  p_evaluator UUID,
  p_channel   TEXT,    -- 'peer' | 'play'
  p_amount    NUMERIC,
  p_reason    TEXT
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sum    NUMERIC;
  v_logged NUMERIC;
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RETURN;  -- "stagne" : aucun crédit, aucune ligne
  END IF;

  SELECT COALESCE(SUM(delta), 0)
  INTO v_sum
  FROM confidence_log
  WHERE user_id = p_user AND reason LIKE p_channel || '%';

  -- Borne au plafond du canal (25)
  v_logged := LEAST(p_amount, GREATEST(0, 25 - v_sum));

  IF v_logged > 0 THEN
    INSERT INTO confidence_log(user_id, evaluator_id, delta, evaluator_weight, reason)
    VALUES (p_user, p_evaluator, v_logged, 1.00, p_reason);
  END IF;

  PERFORM public.recompute_confidence_rate(p_user);
END;
$$;


-- ─────────────────────────────────────────────────────────────────────────────
-- 3. submit_peer_evaluation — CANAL "peer" (accord des pairs, jamais négatif)
--    • gap = |niveau proposé − niveau déclaré de l'évalué|
--    • gap ≤ 0.5 → +5 | ≤ 1.0 → +2 | > 1.0 → 0 (stagne)
--    • cooldown 30 jours par paire ; les deux joueurs doivent être dans le match
-- ─────────────────────────────────────────────────────────────────────────────
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
  v_evaluator_id   UUID := auth.uid();
  v_current_level  NUMERIC(3,1);
  v_evaluator_name TEXT;
  v_gap            NUMERIC(4,2);
  v_amount         NUMERIC(5,2);
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

  -- Les DEUX joueurs doivent avoir partagé ce match
  IF NOT EXISTS (
    SELECT 1 FROM matches
    WHERE id = p_match_id
      AND (player1_id = v_evaluator_id OR player2_id = v_evaluator_id)
      AND (player1_id = p_evaluated_id OR player2_id = p_evaluated_id)
  ) THEN
    RAISE EXCEPTION 'evaluator_not_in_match';
  END IF;

  -- Anti-doublon : 1 évaluation par paire / 30 jours
  IF EXISTS (
    SELECT 1 FROM peer_evaluations
    WHERE evaluator_id = v_evaluator_id
      AND evaluated_id = p_evaluated_id
      AND created_at > NOW() - INTERVAL '30 days'
  ) THEN
    RAISE EXCEPTION 'already_evaluated_recently';
  END IF;

  SELECT COALESCE(level, 3.5) INTO v_current_level
  FROM profiles WHERE id = p_evaluated_id;

  SELECT COALESCE(name, 'Un joueur') INTO v_evaluator_name
  FROM profiles WHERE id = v_evaluator_id;

  -- Crédit selon l'accord (jamais négatif)
  v_gap := ABS(p_proposed_level - v_current_level);
  IF    v_gap <= 0.5 THEN v_amount := 5.0;
  ELSIF v_gap <= 1.0 THEN v_amount := 2.0;
  ELSE                    v_amount := 0.0;   -- trop loin → stagne
  END IF;

  -- Enregistre l'évaluation (pour le cooldown + traçabilité)
  INSERT INTO peer_evaluations(match_id, evaluator_id, evaluated_id, proposed_level)
  VALUES (p_match_id, v_evaluator_id, p_evaluated_id, p_proposed_level)
  ON CONFLICT (match_id, evaluator_id, evaluated_id) DO NOTHING;

  -- Applique le crédit "peer" (borné +25, recalcule confidence_rate)
  PERFORM public.add_confidence_credit(
    p_evaluated_id, v_evaluator_id, 'peer', v_amount,
    'peer gap=' || v_gap::TEXT
  );

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
-- 4. confirm_match_result — stats via trigger (PAS de +1), ELO neutralisé,
--    + CANAL "play" (confiance si adversaire de niveau similaire)
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
  v_opponent_result TEXT;
  v_opponent_name   TEXT;
  v_level_gap       NUMERIC(4,2);
  v_play_amount     NUMERIC(5,2);
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

  v_opponent_result := CASE v_pending.submitter_result
    WHEN 'win'  THEN 'loss'
    WHEN 'loss' THEN 'win'
    ELSE 'draw'
  END;

  SELECT COALESCE(level, 3.5) INTO v_submitter_level FROM profiles WHERE id = v_pending.submitter_id;
  SELECT COALESCE(level, 3.5) INTO v_opponent_level  FROM profiles WHERE id = v_pending.opponent_id;
  SELECT COALESCE(name, 'Votre adversaire') INTO v_opponent_name FROM profiles WHERE id = v_caller_id;

  -- ELO neutralisé : le niveau ne bouge plus par match (décision produit 1).
  -- On garde la colonne elo_delta = 0 pour compatibilité.
  INSERT INTO match_history(player_id, opponent_id, result, score, elo_delta, played_at)
  VALUES
    (v_pending.submitter_id, v_pending.opponent_id, v_pending.submitter_result,
     v_pending.score, 0, v_pending.played_at),
    (v_pending.opponent_id, v_pending.submitter_id, v_opponent_result,
     v_pending.score, 0, v_pending.played_at);
  -- NB : matches_played / wins sont mis à jour par le SEUL trigger
  -- trg_sync_profile_stats (COUNT autoritatif). Pas de +1 explicite ici.

  UPDATE pending_match_results
  SET status = 'confirmed', confirmed_at = NOW()
  WHERE id = p_pending_id;

  -- CANAL "play" : si les deux joueurs sont de niveau similaire (≤ 0.5),
  -- chacun gagne en confiance (+5, borné +25 cumulés). Sinon stagne.
  v_level_gap := ABS(v_submitter_level - v_opponent_level);
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


-- ─────────────────────────────────────────────────────────────────────────────
-- 5. BACKFILL — réaligne les données existantes sur le nouveau modèle
--    (exclut les comptes démo b00000% dont les stats/confiance sont cosmétiques)
-- ─────────────────────────────────────────────────────────────────────────────

-- 5a. Le ledger ne doit contenir que des crédits ≥ 0 (l'ancien modèle "gap"
--     pouvait écrire des deltas négatifs).
UPDATE confidence_log SET delta = GREATEST(0, delta) WHERE delta < 0;

-- 5b. Amorce le canal "peer" depuis les évaluations déjà reçues, non encore
--     présentes dans le ledger (idempotent via NOT EXISTS).
INSERT INTO confidence_log(user_id, evaluator_id, delta, evaluator_weight, reason)
SELECT pe.evaluated_id, pe.evaluator_id,
       CASE
         WHEN ABS(pe.proposed_level - COALESCE(p.level, 3.5)) <= 0.5 THEN 5
         WHEN ABS(pe.proposed_level - COALESCE(p.level, 3.5)) <= 1.0 THEN 2
         ELSE 0
       END,
       1.00, 'peer (backfill)'
FROM peer_evaluations pe
JOIN profiles p ON p.id = pe.evaluated_id
WHERE NOT EXISTS (
  SELECT 1 FROM confidence_log cl
  WHERE cl.user_id = pe.evaluated_id
    AND cl.evaluator_id = pe.evaluator_id
    AND cl.reason LIKE 'peer%'
);

-- 5c. Corrige le double comptage matches_played/wins pour les users réels :
--     recale sur le COUNT autoritatif de match_history.
UPDATE profiles p SET
  matches_played = (SELECT COUNT(*) FROM match_history mh WHERE mh.player_id = p.id),
  wins           = (SELECT COUNT(*) FROM match_history mh WHERE mh.player_id = p.id AND result = 'win')
WHERE p.id::text NOT LIKE 'b00000%';

-- 5d. Recalcule confidence_rate (déterministe) pour tous les users réels.
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT id FROM profiles WHERE id::text NOT LIKE 'b00000%' LOOP
    PERFORM public.recompute_confidence_rate(r.id);
  END LOOP;
END $$;


-- ============================================================================
-- ✅ Migration 014 terminée
-- ============================================================================
