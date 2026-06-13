-- ============================================================================
-- PADEL MEET — Migration 016 : Indice de confiance pondéré 75% play / 25% peer
-- ============================================================================
-- Décision produit (remplace le 50/50 de la migration 014) :
--   L'indice de confiance va de 50 (base) à 100. Les 50 points à gagner sont
--   répartis :
--     • 75 %  → CANAL "play"  : jouer des matchs confirmés contre un adversaire
--               de niveau similaire (≤ 0.5).  Plafond  = +37.5
--     • 25 %  → CANAL "peer"  : accord des évaluations de pairs avec le niveau
--               déclaré.                         Plafond = +12.5
--   confidence_rate = 50 + LEAST(12.5, Σpeer) + LEAST(37.5, Σplay), borné [50,100].
--   MONOTONE : ne baisse jamais (on n'additionne que des crédits ≥ 0).
--
-- Corrige aussi un OUBLI de la migration 014 : le backfill n'avait réamorcé que
-- le canal "peer". Les matchs déjà confirmés (gap ≤ 0.5) n'avaient JAMAIS reçu
-- de crédit "play" → jouer avec quelqu'un de son niveau ne bougeait pas l'indice.
-- On réamorce ici le canal "play" depuis match_history.
--
-- Idempotent — ré-exécutable.
-- ============================================================================


-- ─────────────────────────────────────────────────────────────────────────────
-- 1. recompute_confidence_rate — nouveaux plafonds 12.5 (peer) / 37.5 (play)
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
    GREATEST(0, LEAST(12.5, COALESCE(SUM(delta) FILTER (WHERE reason LIKE 'peer%'), 0))),
    GREATEST(0, LEAST(37.5, COALESCE(SUM(delta) FILTER (WHERE reason LIKE 'play%'), 0)))
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
-- 2. add_confidence_credit — plafond par canal (peer=12.5, play=37.5)
--    (avant : 25 en dur pour les deux). Toujours monotone (crédits ≥ 0).
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
  v_cap    NUMERIC;
  v_logged NUMERIC;
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RETURN;  -- "stagne" : aucun crédit, aucune ligne
  END IF;

  -- Plafond selon le canal (75/25)
  v_cap := CASE WHEN p_channel = 'play' THEN 37.5 ELSE 12.5 END;

  SELECT COALESCE(SUM(delta), 0)
  INTO v_sum
  FROM confidence_log
  WHERE user_id = p_user AND reason LIKE p_channel || '%';

  v_logged := LEAST(p_amount, GREATEST(0, v_cap - v_sum));

  IF v_logged > 0 THEN
    INSERT INTO confidence_log(user_id, evaluator_id, delta, evaluator_weight, reason)
    VALUES (p_user, p_evaluator, v_logged, 1.00, p_reason);
  END IF;

  PERFORM public.recompute_confidence_rate(p_user);
END;
$$;


-- ─────────────────────────────────────────────────────────────────────────────
-- 3. BACKFILL CANAL "play" — crédite les matchs déjà confirmés (gap ≤ 0.5)
--    qui n'ont jamais reçu de crédit play (oubli de la migration 014).
--    +5 par match et par joueur. Le plafond est appliqué au recalcul (étape 4),
--    donc un INSERT direct ici est sûr. Idempotent via NOT EXISTS (reason taggé
--    par played_at → pas de doublon en cas de ré-exécution).
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO confidence_log(user_id, evaluator_id, delta, evaluator_weight, reason)
SELECT mh.player_id, mh.opponent_id, 5, 1.00,
       'play (backfill ' || mh.played_at::text || ')'
FROM match_history mh
JOIN profiles p1 ON p1.id = mh.player_id
JOIN profiles p2 ON p2.id = mh.opponent_id
WHERE ABS(COALESCE(p1.level, 3.5) - COALESCE(p2.level, 3.5)) <= 0.5
  AND p1.id::text NOT LIKE 'b00000%'
  AND NOT EXISTS (
    SELECT 1 FROM confidence_log cl
    WHERE cl.user_id      = mh.player_id
      AND cl.evaluator_id = mh.opponent_id
      AND cl.reason       = 'play (backfill ' || mh.played_at::text || ')'
  );


-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Recalcule confidence_rate (déterministe) pour tous les users réels.
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT id FROM profiles WHERE id::text NOT LIKE 'b00000%' LOOP
    PERFORM public.recompute_confidence_rate(r.id);
  END LOOP;
END $$;


-- ============================================================================
-- ✅ Migration 016 terminée
-- ============================================================================
