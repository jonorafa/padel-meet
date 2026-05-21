-- ============================================================
-- PADEL MEET — Chantier 1 : Cohérence des chiffres
-- ============================================================
-- À exécuter dans Supabase SQL Editor (onglet + → New query)
-- ============================================================

-- ─── 1. PROFILES : renommage confidence → confidence_rate ────
ALTER TABLE profiles
  RENAME COLUMN confidence TO confidence_rate;

ALTER TABLE profiles
  ALTER COLUMN confidence_rate TYPE NUMERIC(5,2)
    USING confidence_rate::NUMERIC(5,2),
  ALTER COLUMN confidence_rate SET DEFAULT 50.00;

-- Autorise level = NULL (quiz non effectué)
ALTER TABLE profiles
  ALTER COLUMN level DROP DEFAULT;
-- Note: la colonne level peut déjà être nullable ; si une erreur apparaît,
-- ignorer cette ligne.

-- Réinitialise tous les confidence_rate existants à 50 (base neutre)
UPDATE profiles SET confidence_rate = 50.00;


-- ─── 2. TABLE peer_evaluations ───────────────────────────────
DROP TABLE IF EXISTS peer_evaluations CASCADE;

CREATE TABLE peer_evaluations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id        UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  evaluator_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  evaluated_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  proposed_level  NUMERIC(3,1) NOT NULL
    CHECK (proposed_level >= 1.0 AND proposed_level <= 7.0),
  created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(match_id, evaluator_id, evaluated_id)
);

ALTER TABLE peer_evaluations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert their own evaluations"
  ON peer_evaluations FOR INSERT
  WITH CHECK (auth.uid() = evaluator_id);

CREATE POLICY "Users can read evaluations involving them"
  ON peer_evaluations FOR SELECT
  USING (auth.uid() = evaluator_id OR auth.uid() = evaluated_id);


-- ─── 3. FUNCTION submit_peer_evaluation (SECURITY DEFINER) ───
-- Anti-cheat : max 1 évaluation par paire évaluateur↔évalué dans les 7 jours
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
  v_evaluator_id UUID := auth.uid();
  v_current_level NUMERIC(3,1);
  v_gap           NUMERIC(3,2);
  v_delta         NUMERIC(5,2);
BEGIN
  -- Vérifie que l'évaluateur est différent de l'évalué
  IF v_evaluator_id = p_evaluated_id THEN
    RAISE EXCEPTION 'Cannot evaluate yourself';
  END IF;

  -- Anti-cheat : 1 seule évaluation par paire par 7 jours
  IF EXISTS (
    SELECT 1 FROM peer_evaluations
    WHERE evaluator_id = v_evaluator_id
      AND evaluated_id = p_evaluated_id
      AND created_at > NOW() - INTERVAL '7 days'
  ) THEN
    RAISE EXCEPTION 'Already evaluated this player in the last 7 days';
  END IF;

  -- Récupère le niveau actuel de l'évalué (3.5 si null)
  SELECT COALESCE(level, 3.5)
  INTO v_current_level
  FROM profiles
  WHERE id = p_evaluated_id;

  -- Calcule le delta selon l'écart entre niveau proposé et niveau actuel
  v_gap := ABS(p_proposed_level - v_current_level);

  IF    v_gap <= 0.25 THEN v_delta :=  3.00;
  ELSIF v_gap <= 0.50 THEN v_delta :=  1.00;
  ELSIF v_gap <= 1.00 THEN v_delta := -2.00;
  ELSE                     v_delta := -5.00;
  END IF;

  -- Enregistre l'évaluation
  INSERT INTO peer_evaluations(match_id, evaluator_id, evaluated_id, proposed_level)
  VALUES (p_match_id, v_evaluator_id, p_evaluated_id, p_proposed_level);

  -- Met à jour le confidence_rate (borné 0–100)
  UPDATE profiles
  SET
    confidence_rate = GREATEST(0, LEAST(100, confidence_rate + v_delta)),
    updated_at      = NOW()
  WHERE id = p_evaluated_id;
END;
$$;


-- ─── 4. FUNCTION get_player_stats ────────────────────────────
CREATE OR REPLACE FUNCTION get_player_stats(p_player_id UUID)
RETURNS TABLE(
  matches_played INT,
  wins           INT,
  streak         INT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_streak INT := 0;
  rec      RECORD;
BEGIN
  -- Total matchs et victoires
  SELECT
    COUNT(*)::INT,
    COUNT(*) FILTER (WHERE result = 'win')::INT
  INTO matches_played, wins
  FROM match_history
  WHERE player_id = p_player_id;

  -- Série actuelle : victoires consécutives depuis le plus récent
  FOR rec IN
    SELECT result
    FROM match_history
    WHERE player_id = p_player_id
    ORDER BY played_at DESC
  LOOP
    IF rec.result = 'win' THEN
      v_streak := v_streak + 1;
    ELSE
      EXIT;
    END IF;
  END LOOP;

  streak := v_streak;
  RETURN NEXT;
END;
$$;


-- ─── 5. TRIGGER : sync matches_played + wins depuis match_history ─
CREATE OR REPLACE FUNCTION sync_profile_stats()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE profiles
  SET
    matches_played = (
      SELECT COUNT(*) FROM match_history WHERE player_id = NEW.player_id
    ),
    wins = (
      SELECT COUNT(*) FROM match_history WHERE player_id = NEW.player_id AND result = 'win'
    ),
    updated_at = NOW()
  WHERE id = NEW.player_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_profile_stats ON match_history;
CREATE TRIGGER trg_sync_profile_stats
  AFTER INSERT OR UPDATE ON match_history
  FOR EACH ROW EXECUTE FUNCTION sync_profile_stats();


-- ─── 6. REALTIME : exposer peer_evaluations ──────────────────
ALTER PUBLICATION supabase_realtime ADD TABLE peer_evaluations;
