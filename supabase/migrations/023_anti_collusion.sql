-- ============================================================================
-- PADEL MEET — Migration 023 : anti-collusion (plafond de vitesse + poids
-- d'évaluateur sur le canal « peer »)
-- ============================================================================
-- Le confidence rate est saturable en une semaine par un groupe de joueurs
-- complices, chiffres à l'appui :
--   • add_confidence_credit (018) plafonne le canal peer à +25
--   • submit_peer_evaluation (014) crédite +5 pour un écart ≤ 0.5
--   • donc 5 évaluations complices suffisent à saturer le canal peer
--   • confidence_log.evaluator_weight existe depuis la 001 mais est toujours
--     inséré à 1.00 : aucune pondération n'est réellement appliquée
--   • le seul garde-fou temporel est un cooldown de 30 jours PAR PAIRE
--     (014/008) — il n'empêche pas 5 évaluateurs DIFFÉRENTS d'agir le même
--     jour, puisqu'il ne compte que les répétitions d'une même paire
--   • le modèle est monotone : un score obtenu par collusion est définitif
--
-- Le Lean Canvas du produit annonce « plafond de vitesse, poids par
-- évaluateur, vérification de présence » comme avantage déloyal. Seule la
-- vérification de présence existe (evaluator_not_in_match, migration 014).
-- Cette migration construit les deux autres, sur le canal peer uniquement —
-- le canal play exige déjà l'accord des deux joueurs + une soumission de
-- score, bien plus coûteux à fabriquer qu'une évaluation.
--
-- 1) PLAFOND DE VITESSE : au plus 2 évaluations peer CRÉDITÉES par
--    utilisateur évalué sur une fenêtre glissante de 7 jours, quel que soit
--    le nombre d'évaluateurs distincts qui tentent (le compteur filtre sur
--    user_id = p_user, pas sur evaluator_id — c'est précisément ce qui
--    bloque un anneau de complices, par opposition au cooldown 30j/paire
--    existant qui ne voit qu'une seule paire à la fois). Au-delà, AUCUN
--    crédit n'est accordé, mais le refus est tracé (delta=0) pour audit.
--
--    Le préfixe du refus est `throttled_peer`, PAS `peer_throttled` :
--    recompute_confidence_rate somme WHERE reason LIKE 'peer%', et ce même
--    plafond de vitesse filtre aussi sur 'peer%'. Un préfixe commençant par
--    `peer` ferait donc compter les refus (delta=0, sans effet immédiat sur
--    la somme, mais dans LE COMPTEUR de vélocité lui-même via le filtre
--    `reason LIKE 'peer%'`) — un refus deviendrait auto-renforçant en
--    gonflant indéfiniment le compte de tentatives « peer% ». Défense en
--    profondeur : le filtre `delta > 0` du compteur suffirait seul, le
--    préfixe distinct est une seconde barrière indépendante.
--
-- 2) POIDS D'ÉVALUATEUR, dans [0.5, 1.0] :
--      poids = 0.5 + 0.5 × (confidence_rate_évaluateur − 50) / 50
--    Pourquoi [0.5, 1.0] et pas [0, 1] : au lancement, TOUS les utilisateurs
--    sont à confidence_rate = 50 (défaut). Une borne basse à 0 donnerait un
--    poids de 0 à tout le monde — aucun crédit peer ne pourrait jamais être
--    accordé, le système serait gelé dès le premier jour. Un plancher à 0.5
--    fait qu'un évaluateur neuf compte moitié : le démarrage reste possible,
--    et un évaluateur mécaniquement peu fiable (confidence basse) devient
--    moins rentable à mobiliser dans un anneau de complices, sans jamais
--    être totalement neutralisé.
--
--    Calculé et stocké dans add_confidence_credit plutôt que dans
--    submit_peer_evaluation : add_confidence_credit reçoit déjà p_evaluator
--    en paramètre et c'est l'unique point qui écrit la ligne confidence_log
--    (peer ET play), donc l'unique point qui a besoin d'écrire
--    evaluator_weight. Dupliquer ce calcul côté appelant aurait exigé de
--    changer la signature de add_confidence_credit pour lui faire accepter
--    un poids déjà calculé, sans bénéfice. Gate sur p_channel = 'peer' :
--    le canal play garde evaluator_weight = 1.00 (comportement inchangé),
--    puisque lui seul est visé par cette migration.
--
-- 3) confidence_rate garde une valeur ENTIÈRE. L'introduction de poids
--    fractionnaires réintroduit le problème que la migration 018 avait
--    explicitement corrigé (un utilisateur affichait 51.06) : un crédit peut
--    désormais valoir 5 × 0.75 = 3.75. recompute_confidence_rate arrondit le
--    résultat FINAL (ROUND(50 + v_peer + v_play)), pas chaque ligne de
--    confidence_log — les deltas individuels restent fractionnaires (c'est
--    voulu, NUMERIC(5,2) les supporte déjà), seul l'agrégat est arrondi.
--    Précision : profiles.confidence_rate est NUMERIC(5,2), pas INTEGER —
--    ROUND() n'en change pas le TYPE, il garantit que la valeur stockée est
--    un entier (51.00, jamais 51.06). C'est bien ce que 018 cherchait.
--    Aucun backfill nécessaire : dans le modèle 50/50 actuel, tous les
--    deltas existants sont déjà entiers (018 les a arrondis), donc
--    ROUND(50 + v_peer + v_play) ne change aucune valeur déjà calculée —
--    seuls les FUTURS crédits pondérés produiront des fractions.
--
-- 4) INDEX : idx_confidence_log_user_date sur (user_id, created_at) existe
--    depuis la migration 001. Le compteur de vélocité filtre
--    user_id = p_user AND created_at > NOW() - INTERVAL '7 days' (les
--    prédicats restants, reason LIKE et delta > 0, s'appliquent en filtre
--    sur le résultat) — cet index suffit très largement au volume attendu
--    d'une table d'évaluations peer. AUCUN nouvel index ajouté.
--
-- Ne modifie PAS submit_peer_evaluation, confirm_match_result : ils
-- continuent de créditer +5/+2 (peer) et +5 (play) à la source — seuls le
-- plafond de vitesse et la pondération changent, tous deux appliqués dans
-- add_confidence_credit. Ne modifie PAS les migrations 014/016/018. Ne
-- change PAS les plafonds de canal (25/25). Ne touche PAS au cooldown de
-- 30 jours par paire, qui reste un garde-fou distinct et complémentaire.
-- N'introduit AUCUN decay : le modèle reste monotone (décision produit
-- séparée, non tranchée par cette migration).
--
-- Idempotent — ré-exécutable (CREATE OR REPLACE, aucun DML de backfill).
-- ============================================================================


-- ─────────────────────────────────────────────────────────────────────────────
-- 1. recompute_confidence_rate — identique à la 018, ROUND() ajouté sur le
--    résultat final (les deltas pondérés peuvent désormais être fractionnaires).
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
  SET confidence_rate = LEAST(100, ROUND(50 + v_peer + v_play)),
      updated_at      = NOW()
  WHERE id = p_user;
END;
$$;


-- ─────────────────────────────────────────────────────────────────────────────
-- 2. add_confidence_credit — plafond de vitesse + poids d'évaluateur sur le
--    canal peer (le canal play est inchangé : pas de plafond de vitesse, pas
--    de pondération, evaluator_weight reste 1.00).
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
      -- compteur de vélocité ci-dessus (delta>0 aussi, mais défense en
      -- profondeur : le préfixe seul suffirait déjà à l'exclure).
      INSERT INTO confidence_log(user_id, evaluator_id, delta, evaluator_weight, reason)
      VALUES (p_user, p_evaluator, 0, 1.00, 'throttled_' || p_reason);
      RETURN;  -- aucun crédit accordé, recompute inutile (rien n'a changé)
    END IF;

    -- Poids d'évaluateur ∈ [0.5, 1.0] — voir le raisonnement chiffré en
    -- en-tête de cette migration. COALESCE(..., 50) : un évaluateur sans
    -- profil résolvable (cas théorique, FK ON DELETE SET NULL) retombe sur
    -- le poids par défaut plutôt que d'échouer.
    SELECT confidence_rate INTO v_evaluator_cr FROM profiles WHERE id = p_evaluator;
    v_weight := GREATEST(0.5, LEAST(1.0, 0.5 + 0.5 * (COALESCE(v_evaluator_cr, 50) - 50) / 50));
  END IF;

  SELECT COALESCE(SUM(delta), 0)
  INTO v_sum
  FROM confidence_log
  WHERE user_id = p_user AND reason LIKE p_channel || '%';

  -- Le montant pondéré respecte le même plafond de canal (25) que l'ancien
  -- montant brut — seule la base de calcul change (p_amount × v_weight).
  v_logged := LEAST(ROUND(p_amount * v_weight, 1), GREATEST(0, 25 - v_sum));

  IF v_logged > 0 THEN
    INSERT INTO confidence_log(user_id, evaluator_id, delta, evaluator_weight, reason)
    VALUES (p_user, p_evaluator, v_logged, v_weight, p_reason);
  END IF;

  PERFORM public.recompute_confidence_rate(p_user);
END;
$$;

-- ============================================================================
-- ✅ Migration 023 terminée — plafond de vitesse + poids d'évaluateur actifs
--    sur le canal peer. Aucun backfill de données (voir point 3 en en-tête).
-- ============================================================================
