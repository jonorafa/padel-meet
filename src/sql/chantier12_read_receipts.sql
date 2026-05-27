-- ============================================================================
-- Chantier 12 : Accusés de lecture style WhatsApp
-- ============================================================================
-- Ajoute read_at sur messages + politique UPDATE pour que le destinataire
-- puisse marquer les messages comme lus.
-- Idempotent — ré-exécutable sans erreur.
-- ============================================================================

-- 1. Colonne read_at (null = non lu, valeur = timestamp de lecture)
ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS read_at TIMESTAMPTZ;

-- 2. Index pour retrouver rapidement les messages non lus d'une conversation
CREATE INDEX IF NOT EXISTS idx_messages_unread
  ON public.messages (match_id, sender_id)
  WHERE read_at IS NULL;

-- 3. Politique UPDATE : le destinataire (participant != expéditeur) peut marquer lu
--    Seul read_at peut être modifié — l'expéditeur ne peut pas effacer la lecture.
DROP POLICY IF EXISTS "Recipients can mark messages as read" ON public.messages;
CREATE POLICY "Recipients can mark messages as read"
  ON public.messages FOR UPDATE
  USING (
    auth.uid() != sender_id AND
    EXISTS (
      SELECT 1 FROM public.matches m
      WHERE m.id = messages.match_id
        AND (m.player1_id = auth.uid() OR m.player2_id = auth.uid())
    )
  )
  WITH CHECK (
    auth.uid() != sender_id AND
    EXISTS (
      SELECT 1 FROM public.matches m
      WHERE m.id = messages.match_id
        AND (m.player1_id = auth.uid() OR m.player2_id = auth.uid())
    )
  );
