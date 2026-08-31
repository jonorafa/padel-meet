-- ═══════════════════════════════════════════════════════════════════════════
-- 038 — Verrouillage de `level` / `last_self_eval_date` + quiz de niveau côté
--       serveur.
--
-- CE QUE ÇA FERME
-- La policy « Users can update own profile » autorise l'écriture de n'importe
-- quelle colonne de son propre profil, et le trigger de protection existant ne
-- rétablissait que is_admin, confidence_rate, matches_played et wins. `level`
-- et `last_self_eval_date` restaient donc librement modifiables par un PATCH
-- REST direct : n'importe qui pouvait se fixer level = 7.0, ou remettre
-- last_self_eval_date à NULL pour contourner le cooldown mensuel et relancer
-- l'auto-évaluation en boucle jusqu'au niveau qui l'arrange. Le garde-fou de
-- cooldown était purement client (MatchScreen), donc sans effet sur l'API.
--
-- PORTÉE VOLONTAIREMENT LIMITÉE À `UPDATE` (option retenue)
-- Sur INSERT, `level` et `last_self_eval_date` ne sont PAS touchés. Raison :
-- la ligne `profiles` n'existe pas encore pendant le quiz d'onboarding
-- (isOnboarding = !user.profile), donc une RPC qui ferait SELECT ... FOR UPDATE
-- puis UPDATE sur profiles ne trouverait rien, et l'INSERT dans
-- level_quiz_submissions violerait sa FK. Forcer level := NULL sur INSERT
-- aurait fait perdre SILENCIEUSEMENT le niveau d'inscription.
-- La vulnérabilité réelle — rejouer/patcher le niveau APRÈS l'inscription, en
-- boucle — est fermée par le verrou sur UPDATE. Le niveau fixé une seule fois
-- à l'inscription reste non protégé, ce qui est exactement le statu quo : zéro
-- régression.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. Trigger de protection étendu ────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.protect_sensitive_profile_columns()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF current_user IN ('authenticated', 'anon') THEN
    IF TG_OP = 'UPDATE' THEN
      NEW.is_admin            := OLD.is_admin;
      NEW.confidence_rate     := OLD.confidence_rate;
      NEW.matches_played      := OLD.matches_played;
      NEW.wins                := OLD.wins;
      -- AJOUT 038 : le niveau et son cooldown ne se modifient plus que par
      -- submit_level_quiz(), qui tourne en SECURITY DEFINER (donc sous
      -- `postgres`, non concerné par ce garde-fou).
      NEW.level               := OLD.level;
      NEW.last_self_eval_date := OLD.last_self_eval_date;
    ELSIF TG_OP = 'INSERT' THEN
      NEW.is_admin            := FALSE;
      NEW.confidence_rate     := 50;
      NEW.matches_played      := 0;
      NEW.wins                := 0;
      -- level / last_self_eval_date volontairement NON touchés ici :
      -- l'onboarding les écrit à la création du profil. Cf. en-tête.
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- ── 2. Journal des soumissions de quiz ─────────────────────────────────────
-- Garder les réponses brutes permet de recalculer un niveau après un
-- changement de barème, et de repérer un profil qui rejouerait le quiz de
-- façon anormale. `answers` stocke le format BRUT (index d'option 0-3, ou
-- entier 1-10 pour les curseurs), jamais une valeur déjà pondérée.
CREATE TABLE IF NOT EXISTS public.level_quiz_submissions (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  quiz_version   INT  NOT NULL,
  kind           TEXT NOT NULL CHECK (kind IN ('initial', 'reeval')),
  answers        JSONB NOT NULL,
  computed_level NUMERIC(3,1) NOT NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS level_quiz_submissions_user_time_idx
  ON public.level_quiz_submissions (user_id, created_at DESC);

ALTER TABLE public.level_quiz_submissions ENABLE ROW LEVEL SECURITY;

-- Lecture de ses propres soumissions uniquement. Aucune policy INSERT :
-- seule la RPC ci-dessous écrit, en SECURITY DEFINER.
DROP POLICY IF EXISTS level_quiz_submissions_select_own ON public.level_quiz_submissions;
CREATE POLICY level_quiz_submissions_select_own ON public.level_quiz_submissions
  FOR SELECT USING (auth.uid() = user_id);

-- ── 3. Calcul du niveau côté serveur ───────────────────────────────────────
-- Miroir exact de computeLevel() dans src/data/courtData.js. Les deux tables
-- de référence DOIVENT rester identiques des deux côtés :
--   • option_values [1, 2, 3.5, 7]  ← valeurs des options des questions à choix
--   • scaleToLevel  0.5 + 6.5 * ((raw-1)/9)^1.8  ← curseurs 1-10 (Q1-3)
--   • poids : 1 pour Q1-14, 2 pour les ancres Q15-16, 0.3 pour les bonus Q17-19
CREATE OR REPLACE FUNCTION public.submit_level_quiz(p_answers JSONB, p_quiz_version INT)
RETURNS NUMERIC
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_id       UUID := auth.uid();
  v_current_level NUMERIC(3,1);
  v_last_eval     DATE;
  v_kind          TEXT;
  v_sum           NUMERIC := 0;
  v_wsum          NUMERIC := 0;
  v_level         NUMERIC(3,1);
  k               TEXT;
  idx             INT;
  raw             INT;
  v_val           NUMERIC;
  v_weight        NUMERIC;
  option_values   CONSTANT NUMERIC[] := ARRAY[1, 2, 3.5, 7];
  weights         CONSTANT JSONB := '{
    "1":1,"2":1,"3":1,"4":1,"5":1,"6":1,"7":1,"8":1,"9":1,"10":1,
    "11":1,"12":1,"13":1,"14":1,"15":2,"16":2,"17":0.3,"18":0.3,"19":0.3}'::JSONB;
  -- Index de la bonne réponse pour chaque question bonus. L'interface n'envoie
  -- JAMAIS un mauvais index : elle OMET la question quand la réponse est
  -- fausse (ScoreScreen : `opt.correct ? 7 : undefined`, et `advance` supprime
  -- alors la clé). Une mauvaise réponse doit être strictement neutre, pas
  -- pénalisante — d'où le rejet d'un index bonus incorrect plutôt que son
  -- acceptation à 0.
  bonus_correct   CONSTANT JSONB := '{"17":2,"18":1,"19":1}'::JSONB;
  required_ids    CONSTANT TEXT[] := ARRAY[
    '1','2','3','4','5','6','7','8','9','10','11','12','13','14','15','16'];
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;
  IF p_quiz_version IS DISTINCT FROM 1 THEN
    RAISE EXCEPTION 'unsupported_quiz_version';
  END IF;

  SELECT level, last_self_eval_date
  INTO v_current_level, v_last_eval
  FROM profiles WHERE id = v_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'profile_not_found';
  END IF;

  -- Premier passage (niveau jamais évalué, ex. quiz sauté à l'inscription) :
  -- pas de cooldown, c'est un rattrapage et non une réévaluation.
  v_kind := CASE WHEN v_current_level IS NULL THEN 'initial' ELSE 'reeval' END;

  IF v_kind = 'reeval'
     AND v_last_eval IS NOT NULL
     AND v_last_eval > CURRENT_DATE - INTERVAL '30 days' THEN
    RAISE EXCEPTION 'cooldown_active';
  END IF;

  -- Toutes les questions non-bonus sont obligatoires : un quiz partiel
  -- produirait un niveau calculé sur une base arbitrairement réduite.
  FOREACH k IN ARRAY required_ids LOOP
    IF NOT (p_answers ? k) THEN
      RAISE EXCEPTION 'missing_required_answer_%', k;
    END IF;
  END LOOP;

  FOR k IN SELECT jsonb_object_keys(p_answers) LOOP
    -- Fail-closed sur une clé inconnue : une réponse hors barème ne doit pas
    -- être ignorée en silence, elle signale un client désynchronisé.
    IF k !~ '^[0-9]+$' OR k::INT NOT BETWEEN 1 AND 19 THEN
      RAISE EXCEPTION 'unknown_answer_key_%', k;
    END IF;

    IF k IN ('1','2','3') THEN
      -- Curseurs : le client envoie l'entier brut, le serveur applique
      -- scaleToLevel lui-même. Accepter un flottant libre serait plus large
      -- que ce qu'un vrai parcours peut produire (10 positions discrètes).
      raw := (p_answers ->> k)::INT;
      IF raw NOT BETWEEN 1 AND 10 THEN
        RAISE EXCEPTION 'invalid_value_%', k;
      END IF;
      v_val    := 0.5 + 6.5 * POWER((raw - 1)::NUMERIC / 9, 1.8);
      v_weight := (weights ->> k)::NUMERIC;

    ELSIF k IN ('17','18','19') THEN
      idx := (p_answers ->> k)::INT;
      IF idx IS DISTINCT FROM (bonus_correct ->> k)::INT THEN
        RAISE EXCEPTION 'invalid_value_%', k;
      END IF;
      v_val    := 7;
      v_weight := (weights ->> k)::NUMERIC;

    ELSE
      -- Questions à choix : index d'option, barème appliqué côté serveur.
      idx := (p_answers ->> k)::INT;
      IF idx NOT BETWEEN 0 AND 3 THEN
        RAISE EXCEPTION 'invalid_value_%', k;
      END IF;
      v_val    := option_values[idx + 1];
      v_weight := (weights ->> k)::NUMERIC;
    END IF;

    v_sum  := v_sum  + v_val * v_weight;
    v_wsum := v_wsum + v_weight;
  END LOOP;

  IF v_wsum = 0 THEN
    RAISE EXCEPTION 'no_answers';
  END IF;

  v_level := ROUND(GREATEST(0.5, LEAST(7.0, v_sum / v_wsum)), 1);

  UPDATE profiles
  SET level               = v_level,
      last_self_eval_date = CURRENT_DATE,
      updated_at          = NOW()
  WHERE id = v_user_id;

  INSERT INTO level_quiz_submissions(user_id, kind, quiz_version, answers, computed_level)
  VALUES (v_user_id, v_kind, p_quiz_version, p_answers, v_level);

  RETURN v_level;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.submit_level_quiz(JSONB, INT) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.submit_level_quiz(JSONB, INT) TO authenticated;
