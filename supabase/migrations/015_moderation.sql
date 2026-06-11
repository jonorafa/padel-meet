-- ============================================================================
-- PADEL MEET — Migration 015 : Modération (blocage + signalement)
-- ============================================================================
-- Requis par l'App Store (Guideline 1.2) et Google Play pour toute app à
-- contenu généré par les utilisateurs (profils + chat) :
--   • bloquer un utilisateur abusif
--   • signaler un utilisateur / un contenu
--   • consentement explicite aux CGU (EULA tolérance zéro)
--
-- Idempotent — ré-exécutable.
-- ============================================================================


-- ─────────────────────────────────────────────────────────────────────────────
-- 1. BLOCKS — un utilisateur en bloque un autre (invisibilité mutuelle côté UI)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.blocks (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  blocker_id  UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  blocked_id  UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (blocker_id, blocked_id),
  CHECK (blocker_id <> blocked_id)
);

CREATE INDEX IF NOT EXISTS idx_blocks_blocker ON public.blocks(blocker_id);
CREATE INDEX IF NOT EXISTS idx_blocks_blocked ON public.blocks(blocked_id);

ALTER TABLE public.blocks ENABLE ROW LEVEL SECURITY;

-- Je crée mes propres blocages
DROP POLICY IF EXISTS blocks_insert_own ON public.blocks;
CREATE POLICY blocks_insert_own ON public.blocks
  FOR INSERT WITH CHECK (auth.uid() = blocker_id);

-- Je vois les blocages qui me concernent (dans un sens ou l'autre) → permet de
-- masquer l'autre des deux côtés.
DROP POLICY IF EXISTS blocks_select_involved ON public.blocks;
CREATE POLICY blocks_select_involved ON public.blocks
  FOR SELECT USING (auth.uid() = blocker_id OR auth.uid() = blocked_id);

-- Je peux annuler mes propres blocages
DROP POLICY IF EXISTS blocks_delete_own ON public.blocks;
CREATE POLICY blocks_delete_own ON public.blocks
  FOR DELETE USING (auth.uid() = blocker_id);


-- ─────────────────────────────────────────────────────────────────────────────
-- 2. REPORTS — signalement d'un utilisateur (modération a posteriori)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.reports (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id  UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reported_id  UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reason       TEXT NOT NULL,              -- ex: 'harassment','fake','inappropriate','spam','other'
  details      TEXT,
  status       TEXT NOT NULL DEFAULT 'open', -- 'open' | 'reviewed' | 'actioned' | 'dismissed'
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (reporter_id <> reported_id)
);

CREATE INDEX IF NOT EXISTS idx_reports_reported ON public.reports(reported_id);
CREATE INDEX IF NOT EXISTS idx_reports_status   ON public.reports(status);

ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

-- Je crée mes propres signalements
DROP POLICY IF EXISTS reports_insert_own ON public.reports;
CREATE POLICY reports_insert_own ON public.reports
  FOR INSERT WITH CHECK (auth.uid() = reporter_id);

-- Je relis uniquement mes propres signalements (la modération se fait via
-- la service_role côté back-office, qui contourne la RLS).
DROP POLICY IF EXISTS reports_select_own ON public.reports;
CREATE POLICY reports_select_own ON public.reports
  FOR SELECT USING (auth.uid() = reporter_id);


-- ─────────────────────────────────────────────────────────────────────────────
-- 3. CONSENTEMENT CGU/EULA — horodatage de l'acceptation
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS accepted_terms_at TIMESTAMPTZ;


-- ============================================================================
-- ✅ Migration 015 terminée
-- ============================================================================
