-- ============================================================================
-- CHANTIER 9 — Enrichissement du chat
-- ============================================================================
-- Ajoute msg_type et metadata aux messages pour supporter :
--   • "match_proposal" : proposition de rendez-vous (date/heure/lieu)
--   • "score_card"     : lien visuel vers un pending_match_result
-- Les vrais scores restent dans pending_match_results (anti-fraude).
-- ============================================================================

-- ── 1. Colonnes supplémentaires sur messages ─────────────────────────────────
ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS msg_type  TEXT    NOT NULL DEFAULT 'text'
    CHECK (msg_type IN ('text', 'match_proposal', 'score_card')),
  ADD COLUMN IF NOT EXISTS metadata  JSONB;

COMMENT ON COLUMN public.messages.msg_type IS
  'Type du message : text | match_proposal | score_card';
COMMENT ON COLUMN public.messages.metadata IS
  'Données structurées selon msg_type (date, lieu, pending_id...)';

-- ── 2. Index sur msg_type pour filtrer efficacement ──────────────────────────
CREATE INDEX IF NOT EXISTS idx_messages_type
  ON public.messages(match_id, msg_type)
  WHERE msg_type <> 'text';

-- ── 3. Vérification ──────────────────────────────────────────────────────────
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'messages'
  AND table_schema = 'public'
ORDER BY ordinal_position;
