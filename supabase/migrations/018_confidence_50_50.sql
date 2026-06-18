-- ============================================================================
-- PADEL MEET — Migration 018 : Indice de confiance — retour au modèle 50/50
-- ============================================================================
-- Décision produit (RÉTABLIT le 50/50 de la migration 014, annule le 75/25 de
-- la migration 016) :
--   L'indice de confiance va de 50 (base) à 100. Les 50 points à gagner sont
--   répartis À PARTS ÉGALES :
--     • 50 %  → CANAL "play"  : jouer des matchs confirmés contre un adversaire
--               de niveau similaire (≤ 0.5).  Plafond  = +25
--     • 50 %  → CANAL "peer"  : accord des évaluations de pairs avec le niveau
--               déclaré.                         Plafond = +25
--   confidence_rate = 50 + LEAST(25, Σpeer) + LEAST(25, Σplay), borné [50,100].
--   MONOTONE : ne baisse jamais (on n'additionne que des crédits ≥ 0).
--
-- Ne touche PAS submit_peer_evaluation ni confirm_match_result : ils créditent
-- toujours +5/+2 (peer) et +5 (play) ; seuls les PLAFONDS changent, et ils sont
-- appliqués dans add_confidence_credit + recompute_confidence_rate (ci-dessous).
--
-- Corrige aussi 2 incohérences de données repérées en prod (audit 2026-06-15) :
--   • Résidus FRACTIONNAIRES dans confidence_log (legacy modèle pondéré
--     chantier8/14) → un user réel affichait 51.06. On arrondit les deltas pour
--     que confidence_rate redevienne entier (cohérent avec des crédits +5/+2).
--   • Profils DÉMO sous le plancher de 50 (seed 010 : 45, 48) → on applique le
--     plancher 50 (l'indice ne descend jamais sous 50, même pour les démos).
--
-- Idempotent — ré-exécutable.
-- ============================================================================


-- ─────────────────────────────────────────────────────────────────────────────
-- 1. recompute_confidence_rate — plafonds symétriques 25 (peer) / 25 (play)
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
-- 2. add_confidence_credit — plafond par canal = 25 (symétrique 50/50)
--    (annule le 12.5/37.5 de la migration 016). Toujours monotone (crédits ≥ 0).
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

  -- Plafond symétrique du canal (25 pour peer comme pour play)
  v_logged := LEAST(p_amount, GREATEST(0, 25 - v_sum));

  IF v_logged > 0 THEN
    INSERT INTO confidence_log(user_id, evaluator_id, delta, evaluator_weight, reason)
    VALUES (p_user, p_evaluator, v_logged, 1.00, p_reason);
  END IF;

  PERFORM public.recompute_confidence_rate(p_user);
END;
$$;


-- ─────────────────────────────────────────────────────────────────────────────
-- 3. NETTOYAGE — résidus fractionnaires de l'ancien modèle pondéré.
--    Les crédits doivent être entiers (+5/+2). On arrondit les deltas non
--    entiers (ex. 1.06) pour que confidence_rate redevienne un entier propre.
-- ─────────────────────────────────────────────────────────────────────────────
UPDATE confidence_log
SET delta = ROUND(delta)
WHERE delta <> ROUND(delta);


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


-- ─────────────────────────────────────────────────────────────────────────────
-- 5. Plancher 50 pour les profils DÉMO (seed 010 antérieur au modèle monotone).
--    L'indice ne descend jamais sous 50 ; on rend les données cosmétiques
--    cohérentes avec cet invariant (45 → 50, 48 → 50).
-- ─────────────────────────────────────────────────────────────────────────────
UPDATE profiles
SET confidence_rate = GREATEST(50, LEAST(100, confidence_rate))
WHERE id::text LIKE 'b00000%'
  AND (confidence_rate < 50 OR confidence_rate > 100);


-- ============================================================================
-- ✅ Migration 018 terminée — modèle 50/50 rétabli
-- ============================================================================
