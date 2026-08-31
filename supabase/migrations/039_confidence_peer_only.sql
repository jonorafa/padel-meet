-- ═══════════════════════════════════════════════════════════════════════════
-- 039 — L'indice de confiance ne mesure plus que l'accord des pairs.
--
-- POURQUOI
-- Le modèle 50/50 (018) créditait deux canaux : « peer » (un partenaire estime
-- ton niveau, et l'écart avec ton niveau déclaré est faible) et « play » (un
-- match confirmé contre quelqu'un de niveau proche, ±0.5). Or l'indice répond
-- à UNE question — « ce niveau déclaré est-il honnête ? » — et seul le canal
-- peer y répond. Le canal play mesure avec QUI on joue, pas si notre niveau
-- est juste : deux joueurs qui se trompent tous les deux de la même façon
-- gagnaient de la confiance en jouant l'un contre l'autre.
--
-- Le canal peer absorbe donc la totalité des 50 points disponibles (50 → 100)
-- au lieu de 25, et le canal play disparaît du calcul.
--
-- LES TROIS CHANGEMENTS SONT DANS CETTE SEULE MIGRATION, VOLONTAIREMENT.
-- Les livrer séparément recréerait exactement l'incohérence qu'on corrige :
-- un plafond relevé dans add_confidence_credit sans le relèvement
-- correspondant dans recompute_confidence_rate ferait accumuler des crédits
-- au journal qui ne seraient jamais reflétés dans le score affiché.
--
-- SÉPARÉE DE 038 : le verrouillage de `level` et le modèle de confiance sont
-- deux sujets sans dépendance mutuelle. Les garder distincts permet d'annuler
-- l'un sans toucher l'autre, comme les 37 migrations précédentes qui ont
-- chacune une portée unique et étroite.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. Le calcul ne lit plus que le canal peer ─────────────────────────────
CREATE OR REPLACE FUNCTION public.recompute_confidence_rate(p_user uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_peer NUMERIC;
BEGIN
  -- Plafond 25 → 50 : le canal peer récupère la totalité de la marge, le
  -- canal play n'étant plus alimenté ni compté. Les anciennes lignes
  -- 'play ...' restent au journal comme trace d'audit, simplement ignorées.
  SELECT GREATEST(0, LEAST(50, COALESCE(SUM(delta) FILTER (WHERE reason LIKE 'peer%'), 0)))
  INTO v_peer
  FROM confidence_log
  WHERE user_id = p_user;

  UPDATE profiles
  SET confidence_rate = LEAST(100, ROUND(50 + v_peer)),
      updated_at      = NOW()
  WHERE id = p_user;
END;
$$;

-- ── 2. Le plafond d'accumulation suit ──────────────────────────────────────
-- Seule la borne change (25 → 50). Le throttle anti-collusion (2 crédits peer
-- max sur 7 jours glissants) et la pondération par la fiabilité de
-- l'évaluateur sont conservés à l'identique.
CREATE OR REPLACE FUNCTION public.add_confidence_credit(
  p_user uuid, p_evaluator uuid, p_channel text, p_amount numeric, p_reason text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_sum          NUMERIC;
  v_logged       NUMERIC;
  v_weight       NUMERIC := 1.00;
  v_evaluator_cr NUMERIC;
  v_recent_peer  INTEGER;
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RETURN;  -- "stagne" : aucun crédit, aucune ligne
  END IF;

  IF p_channel = 'peer' THEN
    -- Plafond de vitesse : compte les évaluations peer déjà CRÉDITÉES
    -- (delta > 0) à p_user sur les 7 derniers jours, tous évaluateurs
    -- confondus. C'est ce qui bloque un anneau de complices : le cooldown
    -- 30j existant ne voit qu'une paire (évaluateur, évalué) à la fois.
    SELECT COUNT(*) INTO v_recent_peer
    FROM confidence_log
    WHERE user_id = p_user
      AND reason LIKE 'peer%'
      AND delta > 0
      AND created_at > NOW() - INTERVAL '7 days';

    IF v_recent_peer >= 2 THEN
      -- p_reason vaut déjà 'peer gap=...' (submit_peer_evaluation) : préfixer
      -- par 'throttled_' donne 'throttled_peer gap=...', qui NE COMMENCE PAS
      -- par 'peer' — exclu à la fois de Σpeer (delta=0 de toute façon) et du
      -- compteur de vélocité ci-dessus.
      INSERT INTO confidence_log(user_id, evaluator_id, delta, evaluator_weight, reason)
      VALUES (p_user, p_evaluator, 0, 1.00, 'throttled_' || p_reason);
      RETURN;  -- aucun crédit accordé, recompute inutile (rien n'a changé)
    END IF;

    -- Poids d'évaluateur ∈ [0.5, 1.0]. COALESCE(..., 50) : un évaluateur sans
    -- profil résolvable (cas théorique, FK ON DELETE SET NULL) retombe sur le
    -- poids par défaut plutôt que d'échouer.
    SELECT confidence_rate INTO v_evaluator_cr FROM profiles WHERE id = p_evaluator;
    v_weight := GREATEST(0.5, LEAST(1.0, 0.5 + 0.5 * (COALESCE(v_evaluator_cr, 50) - 50) / 50));
  END IF;

  SELECT COALESCE(SUM(delta), 0)
  INTO v_sum
  FROM confidence_log
  WHERE user_id = p_user AND reason LIKE p_channel || '%';

  -- Plafond de canal 25 → 50 (039). Cohérent avec recompute_confidence_rate
  -- ci-dessus, modifié dans la même migration.
  v_logged := LEAST(ROUND(p_amount * v_weight, 1), GREATEST(0, 50 - v_sum));

  IF v_logged > 0 THEN
    INSERT INTO confidence_log(user_id, evaluator_id, delta, evaluator_weight, reason)
    VALUES (p_user, p_evaluator, v_logged, v_weight, p_reason);
  END IF;

  PERFORM public.recompute_confidence_rate(p_user);
END;
$$;

-- ── 3. Confirmer un match ne crédite plus la confiance ─────────────────────
-- Identique à la version 017 SAUF le retrait des deux PERFORM
-- add_confidence_credit(..., 'play', ...) et des variables devenues inutiles.
-- Le reste (mode coéquipier, ELO neutralisé, stats par trigger, notification)
-- est inchangé mot pour mot.
CREATE OR REPLACE FUNCTION public.confirm_match_result(p_pending_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_caller_id        UUID := auth.uid();
  v_pending          pending_match_results%ROWTYPE;
  v_submitter_stored TEXT;
  v_opponent_result  TEXT;
  v_opponent_name    TEXT;
BEGIN
  -- (032) : sans session, auth.uid() est NULL et la comparaison plus bas
  -- renverrait NULL — donc aucune exception. On refuse d'emblée.
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT * INTO v_pending FROM pending_match_results WHERE id = p_pending_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pending match result not found';
  END IF;
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
    v_submitter_stored := v_pending.submitter_result;            -- 'win' | 'loss' | 'draw'
    v_opponent_result  := CASE v_pending.submitter_result
      WHEN 'win'  THEN 'loss'
      WHEN 'loss' THEN 'win'
      ELSE 'draw'
    END;
  END IF;

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

  -- RETRAIT 039 : le canal "play" (+5 chacun si écart de niveau ≤ 0.5) est
  -- supprimé. Jouer contre quelqu'un de son niveau ne dit rien sur l'honnêteté
  -- du niveau déclaré — deux joueurs qui surestiment le leur de la même façon
  -- se créditaient mutuellement. Seul l'accord explicite d'un pair compte
  -- désormais (submit_peer_evaluation).

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

-- ── 4. Backfill ────────────────────────────────────────────────────────────
-- Sans recalcul, les confidence_rate déjà stockés restent figés sur l'ancienne
-- formule (50 + peer + play) jusqu'au prochain événement qui les touche —
-- incohérent avec la nouvelle règle dès le déploiement.
--
-- EXCLUSION DES COMPTES DÉMO (b00000%) : mesuré avant écriture — les 30
-- profils démo portent des confidence_rate COSMÉTIQUES codés en dur (jusqu'à
-- 98) et ZÉRO ligne dans confidence_log. Un recalcul les ramènerait tous à 50,
-- aplatissant visiblement la pile de swipe, où ils représentent l'essentiel de
-- ce qu'un utilisateur voit. Même exclusion que les migrations 014, 016 et 018.
--
-- Volume : 35 profils au total, dont 5 réels — coût négligeable.
--
-- ⚠️ Conséquence ATTENDUE sur les comptes réels : leur indice BAISSE, puisque
-- les crédits 'play' ne comptent plus. Ce n'est pas une régression mais le
-- passage à la nouvelle définition.
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT id FROM profiles WHERE id::text NOT LIKE 'b00000%' LOOP
    PERFORM public.recompute_confidence_rate(r.id);
  END LOOP;
END $$;
