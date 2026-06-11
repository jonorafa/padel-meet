-- ============================================================
-- PADEL MEET — Migration propre v3
-- Supprime et recrée les tables (sauf profiles)
-- ============================================================

-- ─── 0. Suppression dans l'ordre (dépendances d'abord) ───────
DROP TABLE IF EXISTS notifications  CASCADE;
DROP TABLE IF EXISTS messages       CASCADE;
DROP TABLE IF EXISTS match_history  CASCADE;
DROP TABLE IF EXISTS matches        CASCADE;
DROP TABLE IF EXISTS swipes         CASCADE;

-- ─── 1. PROFILES — ajoute les colonnes manquantes ─────────────
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS username       VARCHAR(50)  UNIQUE;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS full_name      VARCHAR(255);
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS photo_url      TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS dominant_hand  VARCHAR(20);
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS preferred_side VARCHAR(20);
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS play_style     VARCHAR(50);
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS region         VARCHAR(100);
-- NB : état réel en prod (cf. migrations) — `level` NUMERIC sans défaut (null
-- tant que le quiz n'est pas fait) ; la confiance est `confidence_rate` NUMERIC
-- DEFAULT 50 (l'ancienne colonne `confidence INT` a été remplacée).
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS level          FLOAT   DEFAULT 3.5;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS confidence     INT     DEFAULT 50;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS online         BOOLEAN DEFAULT FALSE;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS last_seen      TIMESTAMP WITH TIME ZONE;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS bio_fr         TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS bio_en         TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS bio_he         TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS matches_played INT     DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS wins           INT     DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS city           VARCHAR(100);
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS age            INT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS created_at     TIMESTAMP WITH TIME ZONE DEFAULT NOW();
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS updated_at     TIMESTAMP WITH TIME ZONE DEFAULT NOW();

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON profiles;
DROP POLICY IF EXISTS "Users can insert own profile"      ON profiles;
DROP POLICY IF EXISTS "Users can update own profile"      ON profiles;

CREATE POLICY "Profiles are viewable by everyone"
  ON profiles FOR SELECT USING (true);
CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);


-- ─── 2. SWIPES ───────────────────────────────────────────────
CREATE TABLE swipes (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  swiper_id  UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  target_id  UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  direction  VARCHAR(10) NOT NULL CHECK (direction IN ('left', 'right')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(swiper_id, target_id)
);
ALTER TABLE swipes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can insert swipes"
  ON swipes FOR INSERT WITH CHECK (auth.uid() = swiper_id);
CREATE POLICY "Users can read swipes involving them"
  ON swipes FOR SELECT USING (auth.uid() = swiper_id OR auth.uid() = target_id);


-- ─── 3. MATCHES ──────────────────────────────────────────────
CREATE TABLE matches (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player1_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  player2_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(player1_id, player2_id)
);
ALTER TABLE matches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Players can see their matches"
  ON matches FOR SELECT
  USING (auth.uid() = player1_id OR auth.uid() = player2_id);
CREATE POLICY "Players can create matches"
  ON matches FOR INSERT
  WITH CHECK (auth.uid() = player1_id OR auth.uid() = player2_id);


-- ─── 4. MESSAGES ─────────────────────────────────────────────
CREATE TABLE messages (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id   UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  sender_id  UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  content    TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Match participants can read messages"
  ON messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM matches m
      WHERE m.id = messages.match_id
        AND (m.player1_id = auth.uid() OR m.player2_id = auth.uid())
    )
  );
CREATE POLICY "Match participants can send messages"
  ON messages FOR INSERT
  WITH CHECK (
    auth.uid() = sender_id AND
    EXISTS (
      SELECT 1 FROM matches m
      WHERE m.id = messages.match_id
        AND (m.player1_id = auth.uid() OR m.player2_id = auth.uid())
    )
  );


-- ─── 5. NOTIFICATIONS ────────────────────────────────────────
CREATE TABLE notifications (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type       VARCHAR(50) NOT NULL,
  from_id    UUID REFERENCES profiles(id) ON DELETE SET NULL,
  text_fr    TEXT,
  text_en    TEXT,
  text_he    TEXT,
  read       BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read their notifications"
  ON notifications FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Anyone can insert notifications"
  ON notifications FOR INSERT WITH CHECK (true);
CREATE POLICY "Users can update their notifications"
  ON notifications FOR UPDATE USING (auth.uid() = user_id);


-- ─── 6. MATCH HISTORY ────────────────────────────────────────
CREATE TABLE match_history (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id   UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  opponent_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  result      VARCHAR(10) NOT NULL CHECK (result IN ('win', 'loss', 'draw')),
  score       VARCHAR(50),
  elo_delta   FLOAT DEFAULT 0,
  played_at   TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
ALTER TABLE match_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Players can see their match history"
  ON match_history FOR SELECT USING (auth.uid() = player_id);
CREATE POLICY "Players can insert match history"
  ON match_history FOR INSERT WITH CHECK (auth.uid() = player_id);


-- ─── 7. REALTIME ─────────────────────────────────────────────
ALTER PUBLICATION supabase_realtime ADD TABLE messages;
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
