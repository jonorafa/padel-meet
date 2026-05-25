-- ============================================================================
-- PADEL MEET — Migration 001 : Schéma complet
-- ============================================================================
-- Toutes les tables dans l'ordre des dépendances.
-- Idempotent : ré-exécutable sans erreur (IF NOT EXISTS partout).
-- ============================================================================


-- ─────────────────────────────────────────────────────────────────────────────
-- TABLE : profiles
-- ─────────────────────────────────────────────────────────────────────────────
-- Note : Supabase crée profiles via le Dashboard avec juste id + email.
-- Ce script ajoute toutes les colonnes métier.

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS username       VARCHAR(50);
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS name           VARCHAR(255);
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS full_name      VARCHAR(255);
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email          TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS photo_url      TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS dominant_hand  VARCHAR(20);
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS preferred_side VARCHAR(20);
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS play_style     VARCHAR(50);
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS region         VARCHAR(100);
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS city           VARCHAR(100);
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS age            INT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS level          FLOAT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS confidence_rate NUMERIC(5,2) DEFAULT 50.00;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS online         BOOLEAN DEFAULT FALSE;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_seen      TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS bio_fr         TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS bio_en         TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS bio_he         TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS matches_played INT DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS wins           INT DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS motivation     VARCHAR(50)
  CHECK (motivation IN ('fun', 'improve', 'compete'));
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS frequency      INT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS partner_prefs  JSONB DEFAULT '{}'::jsonb;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_demo        BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS created_at     TIMESTAMP WITH TIME ZONE DEFAULT NOW();
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS updated_at     TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Contrainte unique sur username (idempotent via IF NOT EXISTS sur l'index)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'profiles_username_unique' AND conrelid = 'public.profiles'::regclass
  ) THEN
    ALTER TABLE public.profiles ADD CONSTRAINT profiles_username_unique UNIQUE (username);
  END IF;
END$$;

-- Index pour les démos
CREATE INDEX IF NOT EXISTS idx_profiles_is_demo
  ON public.profiles(is_demo) WHERE is_demo = TRUE;

-- Index GIN pour partner_prefs
CREATE INDEX IF NOT EXISTS idx_profiles_partner_prefs
  ON public.profiles USING GIN (partner_prefs);

-- RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile"      ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile"      ON public.profiles;

CREATE POLICY "Profiles are viewable by everyone"
  ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users can insert own profile"
  ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id) WITH CHECK (auth.uid() = id);


-- ─────────────────────────────────────────────────────────────────────────────
-- TABLE : swipes
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.swipes (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  swiper_id  UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  target_id  UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  direction  VARCHAR(10) NOT NULL CHECK (direction IN ('left', 'right')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(swiper_id, target_id)
);

ALTER TABLE public.swipes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can insert swipes"               ON public.swipes;
DROP POLICY IF EXISTS "Users can read swipes involving them"  ON public.swipes;

CREATE POLICY "Users can insert swipes"
  ON public.swipes FOR INSERT WITH CHECK (auth.uid() = swiper_id);
CREATE POLICY "Users can read swipes involving them"
  ON public.swipes FOR SELECT
  USING (auth.uid() = swiper_id OR auth.uid() = target_id);


-- ─────────────────────────────────────────────────────────────────────────────
-- TABLE : matches
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.matches (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player1_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  player2_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  score_attempts INT     NOT NULL DEFAULT 0,
  score_locked   BOOLEAN NOT NULL DEFAULT FALSE,
  created_at     TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(player1_id, player2_id)
);

-- Colonnes ajoutées progressivement (idempotent)
ALTER TABLE public.matches ADD COLUMN IF NOT EXISTS score_attempts INT     NOT NULL DEFAULT 0;
ALTER TABLE public.matches ADD COLUMN IF NOT EXISTS score_locked   BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Players can see their matches"   ON public.matches;
DROP POLICY IF EXISTS "Players can create matches"      ON public.matches;

CREATE POLICY "Players can see their matches"
  ON public.matches FOR SELECT
  USING (auth.uid() = player1_id OR auth.uid() = player2_id);
CREATE POLICY "Players can create matches"
  ON public.matches FOR INSERT
  WITH CHECK (auth.uid() = player1_id OR auth.uid() = player2_id);


-- ─────────────────────────────────────────────────────────────────────────────
-- TABLE : messages
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.messages (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id   UUID NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  sender_id  UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content    TEXT NOT NULL,
  msg_type   TEXT NOT NULL DEFAULT 'text'
    CHECK (msg_type IN ('text', 'match_proposal', 'score_card')),
  metadata   JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Colonnes ajoutées progressivement (idempotent)
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS msg_type TEXT NOT NULL DEFAULT 'text'
  CHECK (msg_type IN ('text', 'match_proposal', 'score_card'));
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS metadata JSONB;

CREATE INDEX IF NOT EXISTS idx_messages_type
  ON public.messages(match_id, msg_type) WHERE msg_type <> 'text';

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Match participants can read messages" ON public.messages;
DROP POLICY IF EXISTS "Match participants can send messages" ON public.messages;

CREATE POLICY "Match participants can read messages"
  ON public.messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.matches m
      WHERE m.id = messages.match_id
        AND (m.player1_id = auth.uid() OR m.player2_id = auth.uid())
    )
  );
CREATE POLICY "Match participants can send messages"
  ON public.messages FOR INSERT
  WITH CHECK (
    auth.uid() = sender_id AND
    EXISTS (
      SELECT 1 FROM public.matches m
      WHERE m.id = messages.match_id
        AND (m.player1_id = auth.uid() OR m.player2_id = auth.uid())
    )
  );


-- ─────────────────────────────────────────────────────────────────────────────
-- TABLE : notifications
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.notifications (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type       VARCHAR(50) NOT NULL,
  from_id    UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  text_fr    TEXT,
  text_en    TEXT,
  text_he    TEXT,
  read       BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read their notifications"   ON public.notifications;
DROP POLICY IF EXISTS "Anyone can insert notifications"      ON public.notifications;
DROP POLICY IF EXISTS "Users can update their notifications" ON public.notifications;

CREATE POLICY "Users can read their notifications"
  ON public.notifications FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Anyone can insert notifications"
  ON public.notifications FOR INSERT WITH CHECK (true);
CREATE POLICY "Users can update their notifications"
  ON public.notifications FOR UPDATE USING (auth.uid() = user_id);


-- ─────────────────────────────────────────────────────────────────────────────
-- TABLE : match_history
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.match_history (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id   UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  opponent_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  result      VARCHAR(10) NOT NULL CHECK (result IN ('win', 'loss', 'draw')),
  score       VARCHAR(50),
  elo_delta   FLOAT DEFAULT 0,
  played_at   TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.match_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read their matches"             ON public.match_history;
DROP POLICY IF EXISTS "Players can see their match history"      ON public.match_history;
DROP POLICY IF EXISTS "Players can insert match history"         ON public.match_history;

-- Lecture uniquement (INSERT bloqué côté client → uniquement via fonctions SECURITY DEFINER)
CREATE POLICY "Users can read their matches"
  ON public.match_history FOR SELECT
  USING (auth.uid() = player_id OR auth.uid() = opponent_id);


-- ─────────────────────────────────────────────────────────────────────────────
-- TABLE : peer_evaluations
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.peer_evaluations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id        UUID NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  evaluator_id    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  evaluated_id    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  proposed_level  NUMERIC(3,1) NOT NULL
    CHECK (proposed_level >= 1.0 AND proposed_level <= 7.0),
  created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(match_id, evaluator_id, evaluated_id)
);

ALTER TABLE public.peer_evaluations ADD COLUMN IF NOT EXISTS proposed_level NUMERIC(3,1)
  CHECK (proposed_level >= 1.0 AND proposed_level <= 7.0);

ALTER TABLE public.peer_evaluations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can insert their own evaluations"      ON public.peer_evaluations;
DROP POLICY IF EXISTS "Users can read evaluations involving them"   ON public.peer_evaluations;

CREATE POLICY "Users can insert their own evaluations"
  ON public.peer_evaluations FOR INSERT
  WITH CHECK (auth.uid() = evaluator_id);
CREATE POLICY "Users can read evaluations involving them"
  ON public.peer_evaluations FOR SELECT
  USING (auth.uid() = evaluator_id OR auth.uid() = evaluated_id);


-- ─────────────────────────────────────────────────────────────────────────────
-- TABLE : pending_match_results
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.pending_match_results (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submitter_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  opponent_id      UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  match_id         UUID REFERENCES public.matches(id) ON DELETE CASCADE,
  submitter_result TEXT NOT NULL CHECK (submitter_result IN ('win', 'loss', 'draw')),
  score            TEXT NOT NULL,
  played_at        TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  status           TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'confirmed', 'rejected', 'expired')),
  confirmed_at     TIMESTAMP WITH TIME ZONE,
  created_at       TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at       TIMESTAMP WITH TIME ZONE DEFAULT NOW() + INTERVAL '72 hours',
  CONSTRAINT unique_pending_per_pair UNIQUE (submitter_id, opponent_id, status)
);

CREATE INDEX IF NOT EXISTS idx_pending_opponent   ON public.pending_match_results(opponent_id, status);
CREATE INDEX IF NOT EXISTS idx_pending_submitter  ON public.pending_match_results(submitter_id, status);
CREATE INDEX IF NOT EXISTS idx_pending_expires    ON public.pending_match_results(expires_at) WHERE status = 'pending';

ALTER TABLE public.pending_match_results ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read pending results involving them" ON public.pending_match_results;

CREATE POLICY "Users can read pending results involving them"
  ON public.pending_match_results FOR SELECT
  USING (auth.uid() = submitter_id OR auth.uid() = opponent_id);


-- ─────────────────────────────────────────────────────────────────────────────
-- TABLE : confidence_log
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.confidence_log (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  evaluator_id     UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  delta            NUMERIC(5,2) NOT NULL,
  evaluator_weight NUMERIC(3,2) NOT NULL DEFAULT 1.00,
  reason           TEXT,
  created_at       TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_confidence_log_user_date
  ON public.confidence_log(user_id, created_at);

ALTER TABLE public.confidence_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read their own confidence log" ON public.confidence_log;

CREATE POLICY "Users can read their own confidence log"
  ON public.confidence_log FOR SELECT USING (auth.uid() = user_id);


-- ─────────────────────────────────────────────────────────────────────────────
-- TABLE : profile_photos
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.profile_photos (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  url           TEXT NOT NULL,
  storage_path  TEXT NOT NULL,
  is_primary    BOOLEAN DEFAULT FALSE,
  display_order INT DEFAULT 0,
  created_at    TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, storage_path)
);

CREATE INDEX IF NOT EXISTS idx_profile_photos_user_id       ON public.profile_photos(user_id);
CREATE INDEX IF NOT EXISTS idx_profile_photos_is_primary    ON public.profile_photos(user_id, is_primary);
CREATE INDEX IF NOT EXISTS idx_profile_photos_display_order ON public.profile_photos(user_id, display_order);

ALTER TABLE public.profile_photos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Profile photos are public"     ON public.profile_photos;
DROP POLICY IF EXISTS "Users can insert own photos"   ON public.profile_photos;
DROP POLICY IF EXISTS "Users can update own photos"   ON public.profile_photos;
DROP POLICY IF EXISTS "Users can delete own photos"   ON public.profile_photos;

CREATE POLICY "Profile photos are public"
  ON public.profile_photos FOR SELECT USING (true);
CREATE POLICY "Users can insert own photos"
  ON public.profile_photos FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own photos"
  ON public.profile_photos FOR UPDATE
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own photos"
  ON public.profile_photos FOR DELETE USING (auth.uid() = user_id);


-- ─────────────────────────────────────────────────────────────────────────────
-- REALTIME
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
BEGIN
  -- Ajoute les tables à la publication realtime si elles n'y sont pas déjà
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
  EXCEPTION WHEN duplicate_object THEN NULL; END;

  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
  EXCEPTION WHEN duplicate_object THEN NULL; END;

  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.pending_match_results;
  EXCEPTION WHEN duplicate_object THEN NULL; END;

  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.peer_evaluations;
  EXCEPTION WHEN duplicate_object THEN NULL; END;
END$$;


-- ─────────────────────────────────────────────────────────────────────────────
-- VUE : match_score_status
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW public.match_score_status AS
SELECT
  m.id           AS match_id,
  m.player1_id,
  m.player2_id,
  m.score_attempts,
  m.score_locked,
  3 - m.score_attempts AS remaining_attempts,
  (SELECT id FROM public.pending_match_results pmr
   WHERE pmr.match_id = m.id AND pmr.status = 'pending'
   LIMIT 1)      AS current_pending_id
FROM public.matches m;

GRANT SELECT ON public.match_score_status TO authenticated;


-- ============================================================================
-- ✅ Migration 001 terminée
-- ============================================================================
